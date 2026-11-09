"""
Registre des traitements par topic (ouvert à l'extension) : un topic = un MessageHandler.
Les topics viennent de settings.SENAIR ; un nouveau format s'ajoute avec `registry.register(topic, handler)`.
"""

import json
from typing import Any

from django.conf import settings

from .adapters import AirGradientRawAdapter, MeasurementV1Adapter
from .base import HandleResult, InvalidMessage, MeasurementAdapter, MessageContext, MessageHandler
from .service import IngestionService


class MeasurementHandler:
    """Mesures : adaptateur de format, puis service d'ingestion commun."""

    def __init__(self, adapter: MeasurementAdapter, service: IngestionService):
        self.adapter = adapter
        self.service = service
        self.name = adapter.message_format

    def handle(self, payload: Any, context: MessageContext) -> HandleResult:
        try:
            measurement = self.adapter.parse(payload)
        except InvalidMessage as error:
            self.service.reject(self.adapter.data_source, error.reason)
            raise
        outcome = self.service.ingest(measurement, context)
        detail = f"{len(measurement.partial_rejections)} valeur(s) écartée(s)" if measurement.partial_rejections else ""
        return HandleResult(outcome, detail)


class HandlerRegistry:
    def __init__(self):
        self._handlers: dict[str, MessageHandler] = {}

    def register(self, topic: str, handler: MessageHandler) -> None:
        self._handlers[topic] = handler

    def topics(self) -> list[str]:
        return list(self._handlers)

    def handler_for(self, topic: str) -> MessageHandler:
        try:
            return self._handlers[topic]
        except KeyError as error:
            raise InvalidMessage(f"Aucun traitement déclaré pour le topic {topic}.") from error

    def dispatch(self, topic: str, raw: bytes | str | Any, context: MessageContext | None = None) -> HandleResult:
        """Décode le JSON si besoin et confie le message au traitement du topic. Lève InvalidMessage."""
        handler = self.handler_for(topic)
        try:
            payload = decode(raw)
        except InvalidMessage as error:
            if isinstance(handler, MeasurementHandler):  # compté dans le taux de rejet de la source
                handler.service.reject(handler.adapter.data_source, error.reason)
            raise
        return handler.handle(payload, context or MessageContext(topic=topic))


def decode(raw: bytes | str | Any) -> Any:
    if isinstance(raw, bytes | bytearray):
        try:
            raw = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise InvalidMessage("Message non encodé en UTF-8.") from error
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as error:
            raise InvalidMessage("JSON invalide.") from error
    return raw


def build_registry(service: IngestionService | None = None) -> HandlerRegistry:
    """Registre par défaut des topics du pipeline (docs/14-integration-donnees-ia.md)."""
    from senair.forecasts.stream import ForecastHandler, InterpolationHandler, ModelHandler

    service = service or IngestionService()
    conf = settings.SENAIR
    registry = HandlerRegistry()
    registry.register(conf["TOPIC_MEASUREMENTS_RAW"], MeasurementHandler(AirGradientRawAdapter(), service))
    registry.register(conf["TOPIC_MEASUREMENTS"], MeasurementHandler(MeasurementV1Adapter(), service))
    registry.register(conf["TOPIC_FORECASTS"], ForecastHandler())
    registry.register(conf["TOPIC_MODELS"], ModelHandler())
    registry.register(conf["TOPIC_INTERPOLATIONS"], InterpolationHandler())
    return registry
