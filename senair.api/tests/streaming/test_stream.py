"""Messages IA du flux (forecast.v1, model.v1, interpolation.v1) et boucle de consommation (commit, dead-letter, reprise)."""

import json
from collections import namedtuple
from datetime import timedelta
from unittest import mock

import pytest
from django.conf import settings
from django.db import OperationalError
from django.utils import timezone

from senair.forecasts.models import AiModel, ForecastRun, InterpolationGrid
from senair.measurements.ingestion import samples
from senair.measurements.ingestion.base import InvalidMessage
from senair.measurements.ingestion.registry import build_registry
from senair.measurements.ingestion.service import IngestionService
from senair.measurements.ingestion.stream import StreamRunner
from senair.measurements.models import Reading
from tests.air_quality.helpers import make_model

pytestmark = pytest.mark.django_db
T = settings.SENAIR


def dispatch(topic_key: str, payload) -> str:
    return build_registry().dispatch(T[topic_key], json.dumps(payload)).outcome


def test_forecast_from_unknown_model_is_stored_as_candidate(reference):
    assert dispatch("TOPIC_FORECASTS", samples.forecast_v1(model_id="lstm-demo")) == "accepted"
    model = AiModel.objects.get(pk="lstm-demo")
    assert model.status == "candidate" and model.task == "forecast" and model.algorithm == "XGBoost"
    run = ForecastRun.objects.get()
    assert run.points.count() == 6
    point = run.points.get(horizon="1h")
    assert (point.aqi, point.level, point.confidence, point.interval_low) == (118, "unhealthy_sensitive", 0.92, 112)
    assert dispatch("TOPIC_FORECASTS", samples.forecast_v1(model_id="lstm-demo")) == "duplicate"


def test_forecast_rejects_unknown_scope_and_duplicate_horizons(reference):
    payload = samples.forecast_v1()
    payload.update(scope="zone", scopeId="inconnue")
    with pytest.raises(InvalidMessage, match="Zone inconnue"):
        dispatch("TOPIC_FORECASTS", payload)
    payload = samples.forecast_v1()
    payload["forecasts"].append(dict(payload["forecasts"][0]))
    with pytest.raises(InvalidMessage, match="double"):
        dispatch("TOPIC_FORECASTS", payload)
    payload = samples.forecast_v1()
    payload["forecasts"][0]["horizon"] = "4h"
    with pytest.raises(InvalidMessage, match="forecast.v1"):
        dispatch("TOPIC_FORECASTS", payload)


def test_model_declaration_never_activates(reference):
    assert dispatch("TOPIC_MODELS", samples.model_v1()) == "accepted"
    model = AiModel.objects.get(pk="xgboost-forecast")
    assert (model.status, model.r2, model.rmse, model.mae) == ("candidate", 0.82, 9.4, 6.8)
    AiModel.objects.filter(pk=model.pk).update(status="active")
    newer = samples.model_v1()
    newer.update(version="1.1.0", metrics={"r2": 0.9})
    dispatch("TOPIC_MODELS", newer)
    model.refresh_from_db()
    assert (model.status, model.version, model.r2, model.rmse) == ("active", "1.1.0", 0.9, None)


def test_interpolation_grids_are_capped_per_layer(reference):
    make_model("kriging-demo", task="interpolation")
    start = timezone.now() - timedelta(hours=10)
    for hour in range(InterpolationGrid.KEPT_PER_LAYER + 2):
        assert dispatch("TOPIC_INTERPOLATIONS", samples.interpolation_v1(start + timedelta(hours=hour), resolution_m=2000)) == "accepted"
    grids = InterpolationGrid.objects.filter(layer="aqi")
    assert grids.count() == InterpolationGrid.KEPT_PER_LAYER
    assert grids.first().cells[0].keys() == {"latitude", "longitude", "value", "aqi", "uncertainty"}


def test_interpolation_for_model_of_other_task_is_rejected(reference):
    make_model("xgboost-forecast")
    payload = samples.interpolation_v1(resolution_m=3000)
    payload["model"]["id"] = "xgboost-forecast"
    with pytest.raises(InvalidMessage, match="tâche"):
        dispatch("TOPIC_INTERPOLATIONS", payload)


# ─── Boucle de consommation (consommateur Kafka simulé) ───

Record = namedtuple("Record", "topic partition offset key value timestamp")


class FakeConsumer:
    def __init__(self, records):
        self.records = list(records)
        self.position = 0
        self.commits = []
        self.seeks = []
        self.closed = False

    def poll(self, timeout_ms=0, max_records=None):
        batch = self.records[self.position : self.position + (max_records or 100)]
        self.position += len(batch)
        return {("tp", 0): batch} if batch else {}

    def seek(self, partition, offset):
        self.seeks.append(offset)
        self.position = next(i for i, r in enumerate(self.records) if r.offset == offset)

    def commit(self, offsets):
        self.commits.extend(meta.offset for meta in offsets.values())

    def close(self):
        self.closed = True


class FakeProducer:
    def __init__(self):
        self.sent = []

    def send(self, topic, value=None, key=None):
        self.sent.append((topic, json.loads(value), key))
        return mock.Mock(get=lambda timeout=None: None)

    def flush(self, timeout=None):
        pass

    def close(self, timeout=None):
        pass


def runner_for(records, **options):
    service = IngestionService()
    producer = FakeProducer()
    consumer = FakeConsumer(records)
    runner = StreamRunner(consumer, build_registry(service), service, lambda: producer, T["TOPIC_DEAD_LETTER"], "senair-api", **options)
    return runner, consumer, producer


def test_runner_commits_after_processing_and_dead_letters_invalid(reference):
    raw = json.dumps(samples.airgradient_raw()).encode()
    invalid = json.dumps({**samples.measurement_v1(), "observedAt": "jamais"}).encode()
    records = [
        Record(T["TOPIC_MEASUREMENTS_RAW"], 0, 10, b"168373", raw, 1),
        Record(T["TOPIC_MEASUREMENTS"], 0, 11, None, invalid, 2),
        Record(T["TOPIC_MEASUREMENTS_RAW"], 0, 12, None, b"\xff\xfe", 3),
        Record(T["TOPIC_MEASUREMENTS_RAW"], 0, 13, b"168373", raw, 4),
    ]
    runner, consumer, producer = runner_for(records, max_messages=4)
    stats = runner.run()
    assert consumer.commits == [11, 12, 13, 14] and consumer.closed
    assert (stats.processed, stats.accepted, stats.duplicates, stats.dead_lettered) == (4, 1, 1, 2)
    assert Reading.objects.count() == 1
    topic, body, key = producer.sent[0]
    assert topic == T["TOPIC_DEAD_LETTER"] and key is None
    assert "measurement.v1" in body["reason"] and body["source"] == {
        "topic": T["TOPIC_MEASUREMENTS"],
        "partition": 0,
        "offset": 11,
        "timestamp": 2,
    }
    assert json.loads(body["payload"])["observedAt"] == "jamais"  # charge d'origine conservée
    assert producer.sent[1][1]["payloadEncoding"] == "base64"


# Transaction réelle : la boucle ferme la connexion après une erreur de base (comportement voulu en production) ;
# dans une transaction de test englobante, PostgreSQL perdrait les données du test et la relance tournerait en boucle.
@pytest.mark.django_db(transaction=True)
def test_runner_retries_on_database_error_without_commit(reference):
    raw = json.dumps(samples.airgradient_raw()).encode()
    runner, consumer, producer = runner_for([Record(T["TOPIC_MEASUREMENTS_RAW"], 0, 5, None, raw, 1)], max_messages=1)
    real = runner.registry.dispatch
    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise OperationalError("database is locked")
        return real(*args, **kwargs)

    runner.registry.dispatch = flaky
    with mock.patch("senair.measurements.ingestion.stream.RETRY_PAUSE_SECONDS", 0):
        stats = runner.run()
    assert consumer.seeks == [5] and consumer.commits == [6]
    assert stats.retries == 1 and stats.accepted == 1 and not producer.sent


def test_runner_stops_on_timeout(reference):
    runner, consumer, _ = runner_for([], timeout=0.01)
    assert runner.run().processed == 0 and consumer.closed
