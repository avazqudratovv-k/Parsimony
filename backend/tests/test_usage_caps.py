"""Two separate daily pools: smart adds (photo, voice) and typed lines (hidden fair-use cap)."""

from sqlalchemy import select

from app.config import Settings
from app.db import get_db
from app.main import app
from app.models import User
from app.models.enums import UsageKind
from app.services import usage_service
from tests.fakes import FakeParser, good_json
from tests.helpers import add_manual, signup, use_parser


def set_caps(monkeypatch, *, smart=30, demo=10, smart_global=300, text=300, text_global=1000):
    settings = Settings(
        ai_daily_cap_user=smart,
        ai_daily_cap_demo=demo,
        ai_daily_cap_global=smart_global,
        text_daily_cap_user=text,
        text_daily_cap_global=text_global,
    )
    monkeypatch.setattr(usage_service, "get_settings", lambda: settings)


def ai_add(client):
    return client.post("/api/entries", json={"text": "Coffee $6.50"})


def use_smart_add(client, kind=UsageKind.VISION):
    """Spend one smart add directly (the photo and voice endpoints arrive on Days 11 and 12)."""
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        user = db.scalar(select(User).order_by(User.id.desc()))
        usage_service.consume(db, user, kind)
    finally:
        db.close()


def test_typed_cap_blocks_the_next_typed_entry(client, monkeypatch):
    set_caps(monkeypatch, text=2)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert ai_add(client).status_code == 201
    assert ai_add(client).status_code == 201
    blocked = ai_add(client)

    assert blocked.status_code == 429
    detail = blocked.json()["detail"]
    assert detail["code"] == "typed_limit_account"
    assert "typed entries" in detail["message"]
    assert detail["resets_at"].endswith("Z")
    assert len(client.get("/api/entries").json()) == 2


def test_typing_never_uses_up_smart_adds(client, monkeypatch):
    set_caps(monkeypatch, smart=1)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    for _ in range(5):
        assert ai_add(client).status_code == 201
    usage = client.get("/api/usage").json()
    assert usage["used"] == 0 and usage["limit"] == 1


def test_smart_adds_do_not_use_up_typing(client, monkeypatch):
    set_caps(monkeypatch, smart=1, text=1)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    use_smart_add(client)
    assert ai_add(client).status_code == 201
    assert ai_add(client).status_code == 429


def test_smart_cap_is_enforced_for_photo_and_voice_together(client, monkeypatch):
    set_caps(monkeypatch, smart=2)
    signup(client)

    use_smart_add(client, UsageKind.VISION)
    use_smart_add(client, UsageKind.AUDIO)
    try:
        use_smart_add(client, UsageKind.VISION)
        raise AssertionError("expected DailyLimitReached")
    except usage_service.DailyLimitReached as exc:
        assert exc.which == "account" and exc.pool == "smart"
    assert client.get("/api/usage").json()["used"] == 2


def test_manual_entries_never_use_any_cap(client, monkeypatch):
    set_caps(monkeypatch, text=0)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    add_manual(client)
    assert ai_add(client).status_code == 429


def test_failed_typed_calls_still_count(client, monkeypatch):
    set_caps(monkeypatch, text=1)
    signup(client)
    use_parser(FakeParser("garbage"))
    assert ai_add(client).status_code == 422
    assert ai_add(client).status_code == 429


def test_global_typed_cap_applies_across_accounts(client, monkeypatch):
    set_caps(monkeypatch, text_global=2)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    signup(client, "a@example.com")
    assert ai_add(client).status_code == 201
    client.post("/api/auth/logout")

    signup(client, "b@example.com")
    assert ai_add(client).status_code == 201
    client.post("/api/auth/logout")

    signup(client, "c@example.com")
    blocked = ai_add(client)
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "typed_limit_global"


def test_usage_endpoint_reports_smart_adds_only(client, monkeypatch):
    set_caps(monkeypatch, smart=5)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert client.get("/api/usage").json()["used"] == 0
    ai_add(client)
    use_smart_add(client)
    use_smart_add(client, UsageKind.AUDIO)
    usage = client.get("/api/usage").json()
    assert usage["used"] == 2 and usage["limit"] == 5
    assert usage["resets_at"].endswith("Z")
    assert client.get("/api/auth/me").status_code == 200


def test_caps_are_per_account(client, monkeypatch):
    set_caps(monkeypatch, text=1)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    signup(client, "a@example.com")
    assert ai_add(client).status_code == 201
    assert ai_add(client).status_code == 429
    client.post("/api/auth/logout")

    signup(client, "b@example.com")
    assert ai_add(client).status_code == 201
