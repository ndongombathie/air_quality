"""
Intégration avec un vrai broker Kafka : exécuté seulement si KAFKA_TEST_BOOTSTRAP est défini (ex. localhost:29092).
Topics uniques par exécution : aucun effet sur d'autres consommateurs.
"""

import io
import json
import os
import uuid

import pytest
from django.core.management import call_command

from senair.measurements.ingestion import samples
from senair.measurements.models import Reading

BOOTSTRAP = os.environ.get("KAFKA_TEST_BOOTSTRAP")
pytestmark = [
    pytest.mark.kafka,
    pytest.mark.django_db,
    pytest.mark.skipif(not BOOTSTRAP, reason="KAFKA_TEST_BOOTSTRAP non défini"),
]


@pytest.fixture
def kafka_settings(settings):
    run = uuid.uuid4().hex[:8]
    conf = dict(settings.SENAIR)
    conf.update(
        KAFKA_BOOTSTRAP_SERVERS=[BOOTSTRAP],
        KAFKA_GROUP_ID=f"senair-api-test-{run}",
        TOPIC_MEASUREMENTS_RAW=f"test-{run}.air-quality",
        TOPIC_MEASUREMENTS=f"test-{run}.measurements.v1",
        TOPIC_FORECASTS=f"test-{run}.forecasts.v1",
        TOPIC_MODELS=f"test-{run}.models.v1",
        TOPIC_INTERPOLATIONS=f"test-{run}.interpolations.v1",
        TOPIC_DEAD_LETTER=f"test-{run}.dead-letter.v1",
    )
    settings.SENAIR = conf
    return conf


def test_consume_stream_with_real_broker(reference, kafka_settings):
    from kafka import KafkaConsumer, KafkaProducer
    from kafka.admin import KafkaAdminClient, NewTopic

    conf = kafka_settings
    topics = [
        conf[k]
        for k in (
            "TOPIC_MEASUREMENTS_RAW",
            "TOPIC_MEASUREMENTS",
            "TOPIC_FORECASTS",
            "TOPIC_MODELS",
            "TOPIC_INTERPOLATIONS",
            "TOPIC_DEAD_LETTER",
        )
    ]
    admin = KafkaAdminClient(bootstrap_servers=BOOTSTRAP)
    admin.create_topics([NewTopic(name, num_partitions=1, replication_factor=1) for name in topics])
    admin.close()

    raw = samples.airgradient_raw()  # format exact de producer.py
    invalid = samples.measurement_v1()
    invalid.pop("observedAt")
    producer = KafkaProducer(bootstrap_servers=BOOTSTRAP, value_serializer=lambda v: json.dumps(v).encode("utf-8"))
    producer.send(conf["TOPIC_MEASUREMENTS_RAW"], raw).get(timeout=30)
    producer.send(conf["TOPIC_MEASUREMENTS"], invalid).get(timeout=30)
    producer.flush()
    producer.close()

    out = io.StringIO()
    call_command("consume_stream", "--max-messages", "2", "--timeout", "60", "--from-beginning", stdout=out)
    print(out.getvalue())
    assert "Messages traités : 2 (acceptés 1, doublons 0, ignorés 0, dead-letter 1" in out.getvalue()

    reading = Reading.objects.get(station_id="168373")
    assert reading.message_format == "airgradient.raw" and reading.kafka_topic == conf["TOPIC_MEASUREMENTS_RAW"]
    assert reading.kafka_offset == 0 and reading.pm25 == 20.5 and reading.aqi == 137

    dlq = KafkaConsumer(
        conf["TOPIC_DEAD_LETTER"],
        bootstrap_servers=BOOTSTRAP,
        auto_offset_reset="earliest",
        consumer_timeout_ms=15000,
        group_id=f"{conf['KAFKA_GROUP_ID']}-dlq",
    )
    letters = [json.loads(message.value) for message in dlq]
    dlq.close()
    assert len(letters) == 1
    letter = letters[0]
    assert letter["source"]["topic"] == conf["TOPIC_MEASUREMENTS"] and "observedAt" in letter["reason"]
    assert json.loads(letter["payload"])["messageId"] == invalid["messageId"]
    print("Dead-letter :", json.dumps({k: letter[k] for k in ("reason", "source", "consumerGroup")}, ensure_ascii=False))

    # Offsets validés : une seconde lecture du même groupe ne retraite rien.
    out = io.StringIO()
    call_command("consume_stream", "--timeout", "8", stdout=out)
    assert "Messages traités : 0" in out.getvalue()
    assert Reading.objects.count() == 1
