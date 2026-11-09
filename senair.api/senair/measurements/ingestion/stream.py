"""
Boucle de consommation Kafka : un message est validé, traité, puis son offset est validé (commit) ;
un message invalide part sur le topic dead-letter avec la raison et la charge d'origine, puis il est validé.
Une erreur de base de données (transitoire) ne valide rien : le message est relu après une pause.
Les journaux ne contiennent jamais la charge des messages (topic, partition, offset et raison seulement).
"""

import base64
import json
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from django.db import DatabaseError, close_old_connections
from django.utils import timezone

from senair.common.domain import iso

from .base import InvalidMessage, MessageContext
from .registry import HandlerRegistry
from .service import IngestionService

logger = logging.getLogger("senair.stream")

RETRY_PAUSE_SECONDS = 2.0


@dataclass
class StreamStats:
    processed: int = 0
    accepted: int = 0
    duplicates: int = 0
    skipped: int = 0
    dead_lettered: int = 0
    retries: int = 0


def dead_letter_payload(record: Any, reason: str, group_id: str) -> bytes:
    raw = record.value
    if isinstance(raw, bytes | bytearray):
        try:
            payload, encoding = raw.decode("utf-8"), "utf-8"
        except UnicodeDecodeError:
            payload, encoding = base64.b64encode(raw).decode("ascii"), "base64"
    else:
        payload, encoding = raw, "utf-8"
    body = {
        "schemaVersion": "1",
        "reason": reason,
        "failedAt": iso(timezone.now()),
        "consumerGroup": group_id,
        "source": {
            "topic": record.topic,
            "partition": record.partition,
            "offset": record.offset,
            "timestamp": getattr(record, "timestamp", None),
        },
        "payloadEncoding": encoding,
        "payload": payload,
    }
    return json.dumps(body, ensure_ascii=False).encode("utf-8")


class StreamRunner:
    def __init__(
        self,
        consumer: Any,
        registry: HandlerRegistry,
        service: IngestionService,
        producer_factory: Callable[[], Any],
        dead_letter_topic: str,
        group_id: str,
        max_messages: int | None = None,
        timeout: float | None = None,
    ):
        self.consumer = consumer
        self.registry = registry
        self.service = service
        self.producer_factory = producer_factory
        self._producer = None
        self.dead_letter_topic = dead_letter_topic
        self.group_id = group_id
        self.max_messages = max_messages
        self.timeout = timeout
        self.stats = StreamStats()
        self._stop = threading.Event()

    def stop(self, *_args) -> None:
        self._stop.set()

    @property
    def producer(self):
        if self._producer is None:
            self._producer = self.producer_factory()
        return self._producer

    def run(self) -> StreamStats:
        from kafka.structs import OffsetAndMetadata

        deadline = time.monotonic() + self.timeout if self.timeout else None
        try:
            while not self._stop.is_set():
                if deadline is not None and time.monotonic() >= deadline:
                    logger.info("Durée maximale atteinte.")
                    break
                remaining = None if self.max_messages is None else self.max_messages - self.stats.processed
                batches = self.consumer.poll(timeout_ms=1000, max_records=min(remaining or 100, 100))
                for partition, records in batches.items():
                    for record in records:
                        if self._stop.is_set():
                            break
                        if not self._process(record):
                            # Erreur transitoire : on relira ce message (et la suite de la partition) après une pause.
                            self.consumer.seek(partition, record.offset)
                            self.stats.retries += 1
                            self._stop.wait(RETRY_PAUSE_SECONDS)
                            break
                        self.consumer.commit({partition: OffsetAndMetadata(record.offset + 1, None, -1)})
                        self.stats.processed += 1
                        if self.max_messages is not None and self.stats.processed >= self.max_messages:
                            self._stop.set()
                            break
        finally:
            self.close()
        return self.stats

    def close(self) -> None:
        try:
            self.service.flush()
        finally:
            if self._producer is not None:
                self._producer.flush(timeout=10)
                self._producer.close(timeout=10)
            self.consumer.close()

    def _process(self, record: Any) -> bool:
        """True si le message est traité (accepté, doublon, ignoré ou mis en dead-letter) et peut être validé."""
        where = f"{record.topic}[{record.partition}]@{record.offset}"
        context = MessageContext(topic=record.topic, partition=record.partition, offset=record.offset)
        try:
            result = self.registry.dispatch(record.topic, record.value, context)
        except InvalidMessage as error:
            self._flush_safely()
            self._dead_letter(record, error.reason)
            logger.warning("Message %s refusé : %s", where, error.reason)
            return True
        except DatabaseError:
            logger.exception("Base de données indisponible pendant le traitement de %s : nouvel essai.", where)
            close_old_connections()
            return False
        except Exception:
            logger.exception("Erreur inattendue sur le message %s.", where)
            self._flush_safely()
            self._dead_letter(record, "Erreur de traitement inattendue.")
            return True
        self._flush_safely()
        if result.outcome == "accepted":
            self.stats.accepted += 1
        elif result.outcome == "duplicate":
            self.stats.duplicates += 1
        else:
            self.stats.skipped += 1
        logger.info("Message %s : %s%s", where, result.outcome, f" ({result.detail})" if result.detail else "")
        return True

    def _flush_safely(self) -> None:
        try:
            self.service.flush()
        except DatabaseError:
            logger.exception("Compteurs des sources non mis à jour.")
            close_old_connections()

    def _dead_letter(self, record: Any, reason: str) -> None:
        # .get() attend l'accusé de réception du broker : on ne valide jamais un message perdu.
        self.producer.send(self.dead_letter_topic, value=dead_letter_payload(record, reason, self.group_id), key=record.key).get(timeout=30)
        self.stats.dead_lettered += 1
