"""Moteur d'alertes (evaluate_reading) et notifications push, avec un faux transport Expo (aucun appel réseau)."""

from datetime import UTC, datetime, time, timedelta

import pytest

from senair.accounts.models import Device, NotificationPreferences
from senair.accounts.services import in_quiet_hours
from senair.alerts import push, services
from senair.alerts.models import Alert, HealthGuidance, NotificationDelivery, Threshold
from senair.alerts.services import evaluate_reading, rolling_average
from senair.measurements.models import Reading
from tests.conftest import make_user

T0 = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
HOTEL_DE_VILLE = "168373"  # zone centre-ville
FAHU = "168401"


def reading(station=HOTEL_DE_VILLE, at=T0, **values) -> Reading:
    return Reading.objects.create(station_id=station, observed_at=at, message_format="test", **values)


class FakeTransport:
    def __init__(self, tickets=None, error: Exception | None = None):
        self.calls: list[list[dict]] = []
        self.tickets = tickets
        self.error = error

    def __call__(self, url, messages):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return self.tickets(messages) if self.tickets else [{"status": "ok", "id": f"ticket-{i}"} for i, _ in enumerate(messages)]


@pytest.fixture
def push_on(settings):
    settings.SENAIR = {**settings.SENAIR, "PUSH_ENABLED": True}


@pytest.fixture
def fake(monkeypatch):
    transport = FakeTransport()
    monkeypatch.setattr(push, "transport", transport)
    return transport


def follower(email, zones=("centre-ville",), token=None, **prefs):
    user = make_user("citizen", email=email)
    if prefs or zones is not None:
        p = NotificationPreferences.objects.create(user=user, **{"quiet_start": None, "quiet_end": None, **prefs})
        p.zones.set(zones or [])
    Device.objects.create(token=token or f"ExponentPushToken[{email}]", user=user, platform="android")
    return user


# ─────────────── Évaluation ───────────────


def test_exceedance_creates_alert(reference):
    created = evaluate_reading(reading(pm25=20))
    assert len(created) == 1
    alert = created[0]
    assert alert.title == "PM2.5 au-dessus du seuil OMS à Hôtel de Ville"
    assert alert.reference == "WHO_2021" and alert.threshold_value == 15 and alert.value == 20 and alert.unit == "µg/m³"
    assert alert.severity == "unhealthy_sensitive" and alert.status == "active" and alert.zone_id == "centre-ville"
    assert alert.started_at == T0 and alert.last_exceeded_at == T0
    assert "sur 24 heures" in alert.message and "20 µg/m³" in alert.message and "15 µg/m³" in alert.message
    assert alert.recommendations == HealthGuidance.objects.get(profile="general", level="unhealthy_sensitive").actions


def test_below_threshold_creates_nothing(reference):
    assert evaluate_reading(reading(pm25=10, pm10=20)) == []
    assert not Alert.objects.exists()


def test_open_alert_is_updated_not_duplicated(reference):
    first = evaluate_reading(reading(pm25=20))[0]
    later = T0 + timedelta(minutes=10)
    created = evaluate_reading(reading(at=later, pm25=40))  # moyenne 30 : NS 05-062 (25) dépassé à son tour
    assert [a.reference for a in created] == ["NS_05_062"]
    first.refresh_from_db()
    assert Alert.objects.filter(reference="WHO_2021").count() == 1
    assert first.value == 30 and first.last_exceeded_at == later and first.started_at == T0
    assert first.severity == "very_unhealthy"  # sous-indice de 40 µg/m³ = 267, plus grave que le niveau du seuil
    assert first.recommendations == HealthGuidance.objects.get(profile="general", level="very_unhealthy").actions


def test_acknowledged_alert_is_updated(reference):
    alert = evaluate_reading(reading(pm25=20))[0]
    Alert.objects.filter(pk=alert.pk).update(status="acknowledged")
    assert evaluate_reading(reading(at=T0 + timedelta(minutes=5), pm25=21)) == []
    alert.refresh_from_db()
    assert alert.status == "acknowledged" and alert.value == 20.5


def test_auto_resolution(reference):
    alert = evaluate_reading(reading(pm25=20))[0]
    resolved_at = T0 + timedelta(hours=25)  # la première mesure sort de la fenêtre de 24 h
    assert evaluate_reading(reading(at=resolved_at, pm25=5)) == []
    alert.refresh_from_db()
    assert alert.status == "resolved" and alert.resolved_at == resolved_at
    assert len(evaluate_reading(reading(at=resolved_at + timedelta(minutes=5), pm25=60))) == 2  # nouvel épisode


def test_resolution_when_threshold_disabled(reference):
    alert = evaluate_reading(reading(pm25=20))[0]
    Threshold.objects.filter(pollutant="pm25").update(enabled=False)
    evaluate_reading(reading(at=T0 + timedelta(minutes=5), pm25=30))
    alert.refresh_from_db()
    assert alert.status == "resolved"


def test_late_reading_does_not_change_alert(reference):
    alert = evaluate_reading(reading(pm25=20))[0]
    evaluate_reading(reading(at=T0 - timedelta(hours=30), pm25=1))
    alert.refresh_from_db()
    assert alert.status == "active" and alert.last_exceeded_at == T0


def test_silent_station_starts_a_new_alert(reference):
    old = next(a for a in evaluate_reading(reading(pm25=20)) if a.reference == "WHO_2021")
    later = T0 + timedelta(days=120)  # la station n'a rien envoyé pendant 4 mois
    new = next(a for a in evaluate_reading(reading(at=later, pm25=20)) if a.reference == "WHO_2021")
    old.refresh_from_db()
    assert old.status == "resolved" and old.resolved_at == T0
    assert new.pk != old.pk and new.started_at == later and new.status == "active"


def test_zone_threshold_overrides_city_threshold(reference):
    Threshold.objects.create(
        pollutant="pm25", reference="WHO_2021", period="24h", value=30, unit="µg/m³", zone_id="centre-ville", alert_level="unhealthy"
    )
    assert evaluate_reading(reading(pm25=20)) == []  # seuil de zone (30) prioritaire sur le seuil ville (15)
    elsewhere = evaluate_reading(reading(station=FAHU, pm25=20))
    assert len(elsewhere) == 1 and elsewhere[0].threshold_value == 15
    over = evaluate_reading(reading(at=T0 + timedelta(minutes=5), pm25=60))  # moyenne 40 > 30
    who = next(a for a in over if a.reference == "WHO_2021")
    assert who.threshold_value == 30 and who.threshold.zone_id == "centre-ville"


def test_rolling_average_window(reference):
    reading(at=T0 - timedelta(hours=30), no2=100)
    reading(at=T0 - timedelta(hours=2), no2=10)
    reading(at=T0 - timedelta(minutes=30), pm25=5)  # sans NO₂ : ignorée
    current = reading(at=T0, no2=30)
    assert rolling_average(current, "no2", "24h") == 20
    assert rolling_average(current, "no2", "1h") == 30
    assert rolling_average(current, "no2", "8h") == 20


def test_co_threshold_in_mg(reference):
    created = evaluate_reading(reading(co=5))
    assert [a.unit for a in created] == ["mg/m³"] and created[0].threshold_value == 4


def test_engine_never_raises(reference, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("panne")

    monkeypatch.setattr(services, "applicable_thresholds", boom)
    assert evaluate_reading(reading(pm25=99)) == []
    assert evaluate_reading(object()) == []  # objet invalide : journalisé, pas d'exception


# ─────────────── Notifications push ───────────────


def test_push_sent_on_creation(reference, push_on, fake, django_capture_on_commit_callbacks):
    user = follower("awa@test.sn")
    with django_capture_on_commit_callbacks(execute=True):
        alert = evaluate_reading(reading(pm25=20))[0]
    assert len(fake.calls) == 1
    message = fake.calls[0][0]
    assert message["to"] == "ExponentPushToken[awa@test.sn]" and message["title"] == alert.title
    assert message["data"] == {"alertId": str(alert.pk)} and "PM2.5" in message["body"]
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == "sent" and delivery.user == user and delivery.detail == "ticket-0"

    with django_capture_on_commit_callbacks(execute=True):
        evaluate_reading(reading(at=T0 + timedelta(minutes=5), pm25=21))  # mise à jour : pas de nouveau push
    assert len(fake.calls) == 1


def test_push_recipients_follow_preferences(reference, push_on, fake):
    alert = evaluate_reading(reading(pm25=20))[0]  # pm25, unhealthy_sensitive, centre-ville
    follower("ok@test.sn")
    follower("all-zones@test.sn", zones=())
    follower("other-zone@test.sn", zones=("fahu",))
    follower("level@test.sn", min_level="unhealthy")
    follower("pollutant@test.sn", pollutants=["pm10"])
    follower("disabled@test.sn", push_enabled=False)
    follower("quiet@test.sn", quiet_start=time(11, 0), quiet_end=time(13, 0))
    profile_zone = make_user("citizen", email="profile@test.sn")  # sans préférences : zones du profil, heures calmes par défaut
    profile_zone.zones.set(["centre-ville"])
    Device.objects.create(token="ExponentPushToken[profile]", user=profile_zone, platform="ios")
    inactive = follower("inactive@test.sn")
    inactive.status = "disabled"
    inactive.save()
    Device.objects.create(token="ExponentPushToken[stale]", user=make_user("citizen", email="stale@test.sn"), platform="ios", invalid_at=T0)

    push.notify_new_alert(alert.pk, now=T0)  # 12:00 UTC
    sent = sorted(m["to"] for m in fake.calls[0])
    assert sent == ["ExponentPushToken[all-zones@test.sn]", "ExponentPushToken[ok@test.sn]", "ExponentPushToken[profile]"]
    skipped = NotificationDelivery.objects.get(status="skipped")
    assert skipped.device_token == "ExponentPushToken[quiet@test.sn]" and skipped.detail == "Heures calmes"

    night = evaluate_reading(reading(station=FAHU, pm25=20))[0]
    profile_zone.zones.set([])
    fake.calls.clear()
    push.notify_new_alert(night.pk, now=T0.replace(hour=23))  # heures calmes par défaut 22:00 à 06:30
    assert "ExponentPushToken[profile]" not in [m["to"] for m in fake.calls[0]]


def test_push_deduplicated_per_alert_and_device(reference, push_on, fake):
    follower("awa@test.sn")
    alert = evaluate_reading(reading(pm25=20))[0]
    push.notify_new_alert(alert.pk, now=T0)
    push.notify_new_alert(alert.pk, now=T0)
    assert len(fake.calls) == 1 and NotificationDelivery.objects.count() == 1


def test_push_device_not_registered_marks_device_invalid(reference, push_on, monkeypatch):
    follower("awa@test.sn")
    follower("moussa@test.sn")
    transport = FakeTransport(
        tickets=lambda messages: [
            {"status": "error", "message": "absent", "details": {"error": "DeviceNotRegistered"}}
            if "awa" in m["to"]
            else {"status": "ok", "id": "x"}
            for m in messages
        ]
    )
    monkeypatch.setattr(push, "transport", transport)
    alert = evaluate_reading(reading(pm25=20))[0]
    push.notify_new_alert(alert.pk, now=T0)
    assert Device.objects.get(pk="ExponentPushToken[awa@test.sn]").invalid_at is not None
    assert Device.objects.get(pk="ExponentPushToken[moussa@test.sn]").invalid_at is None
    assert NotificationDelivery.objects.get(device_token="ExponentPushToken[awa@test.sn]").status == "failed"


def test_push_disabled_records_skipped(reference, fake):
    follower("awa@test.sn")
    alert = evaluate_reading(reading(pm25=20))[0]
    push.notify_new_alert(alert.pk, now=T0)  # PUSH_ENABLED faux dans les réglages de test
    assert fake.calls == []
    assert NotificationDelivery.objects.get().status == "skipped"


def test_push_network_failure_never_breaks_ingestion(reference, push_on, monkeypatch, django_capture_on_commit_callbacks):
    follower("awa@test.sn")
    monkeypatch.setattr(push, "transport", FakeTransport(error=OSError("réseau indisponible")))
    with django_capture_on_commit_callbacks(execute=True):
        created = evaluate_reading(reading(pm25=20))
    assert len(created) == 1
    assert NotificationDelivery.objects.get().status == "failed"


def test_push_batches_of_100(reference, push_on, fake):
    owner = make_user("citizen", email="multi@test.sn")
    Device.objects.bulk_create([Device(token=f"ExponentPushToken[{i}]", user=owner, platform="android") for i in range(150)])
    NotificationPreferences.objects.create(user=owner)
    alert = evaluate_reading(reading(pm25=20))[0]
    push.notify_new_alert(alert.pk, now=T0)
    assert [len(call) for call in fake.calls] == [100, 50]
    assert NotificationDelivery.objects.filter(status="sent").count() == 150


def test_push_non_expo_token_not_sent(reference, push_on, fake):
    follower("web@test.sn", token="fcm-web-token")
    alert = evaluate_reading(reading(pm25=20))[0]
    push.notify_new_alert(alert.pk, now=T0)
    assert fake.calls == [] and NotificationDelivery.objects.get().status == "failed"


@pytest.mark.parametrize(
    ("start", "end", "moment", "expected"),
    [
        ("22:00", "06:30", "23:15", True),
        ("22:00", "06:30", "05:00", True),
        ("22:00", "06:30", "06:30", False),
        ("22:00", "06:30", "12:00", False),
        ("12:00", "14:00", "13:00", True),
        ("08:00", "08:00", "08:00", False),
    ],
)
def test_quiet_hours(start, end, moment, expected):
    quiet = (time.fromisoformat(start), time.fromisoformat(end))
    assert in_quiet_hours(quiet, time.fromisoformat(moment)) is expected
    assert in_quiet_hours(None, time.fromisoformat(moment)) is False
