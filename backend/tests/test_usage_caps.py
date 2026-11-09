from app.config import Settings
from app.services import usage_service
from tests.fakes import FakeParser, good_json
from tests.helpers import add_manual, signup, use_parser


def set_caps(monkeypatch, *, user=30, demo=10, global_=300):
    settings = Settings(ai_daily_cap_user=user, ai_daily_cap_demo=demo, ai_daily_cap_global=global_)
    monkeypatch.setattr(usage_service, "get_settings", lambda: settings)


def ai_add(client):
    return client.post("/api/entries", json={"text": "Coffee $6.50"})


def test_account_cap_blocks_the_next_ai_call(client, monkeypatch):
    set_caps(monkeypatch, user=2)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert ai_add(client).status_code == 201
    assert ai_add(client).status_code == 201
    blocked = ai_add(client)

    assert blocked.status_code == 429
    detail = blocked.json()["detail"]
    assert detail["code"] == "daily_limit_account"
    assert "manually" in detail["message"]
    assert detail["resets_at"].endswith("Z")
    assert len(client.get("/api/entries").json()) == 2


def test_preview_and_create_share_the_same_cap(client, monkeypatch):
    set_caps(monkeypatch, user=2)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert client.post("/api/entries/parse", json={"text": "x $1"}).status_code == 200
    assert ai_add(client).status_code == 201
    assert client.post("/api/entries/parse", json={"text": "x $1"}).status_code == 429


def test_manual_entries_never_use_the_cap(client, monkeypatch):
    set_caps(monkeypatch, user=0)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    add_manual(client)
    assert ai_add(client).status_code == 429


def test_failed_ai_calls_still_count(client, monkeypatch):
    set_caps(monkeypatch, user=1)
    signup(client)
    use_parser(FakeParser("garbage"))
    assert ai_add(client).status_code == 422
    assert ai_add(client).status_code == 429


def test_global_cap_applies_across_accounts(client, monkeypatch):
    set_caps(monkeypatch, global_=2)
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
    assert blocked.json()["detail"]["code"] == "daily_limit_global"


def test_usage_endpoint_reports_progress(client, monkeypatch):
    set_caps(monkeypatch, user=5)
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert client.get("/api/usage").json()["used"] == 0
    ai_add(client)
    ai_add(client)
    usage = client.get("/api/usage").json()
    assert usage["used"] == 2 and usage["limit"] == 5
    assert usage["resets_at"].endswith("Z")
    assert client.get("/api/auth/me").status_code == 200


def test_caps_are_per_account(client, monkeypatch):
    set_caps(monkeypatch, user=1)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    signup(client, "a@example.com")
    assert ai_add(client).status_code == 201
    assert ai_add(client).status_code == 429
    client.post("/api/auth/logout")

    signup(client, "b@example.com")
    assert ai_add(client).status_code == 201
