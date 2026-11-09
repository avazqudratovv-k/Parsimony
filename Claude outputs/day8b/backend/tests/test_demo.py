import datetime as dt
import uuid

from sqlalchemy import func, select

from app.config import Settings
from app.core.clock import as_utc, utcnow
from app.models import Entry, UsageCounter, User
from app.services import demo_service, entry_service, usage_service
from tests.fakes import FakeParser, good_json
from tests.helpers import add_manual, db_session, signup, start_demo, use_parser


def test_try_demo_creates_a_sandbox_with_sample_data(client):
    user = start_demo(client)

    assert user["is_demo"] is True
    assert user["email"].endswith("@demo.parsimony.invalid")
    expires = as_utc(dt.datetime.fromisoformat(user["expires_at"].replace("Z", "+00:00")))
    assert dt.timedelta(days=6, hours=23) < expires - utcnow() <= dt.timedelta(days=7)

    assert client.get("/api/auth/me").json()["id"] == user["id"]  # cookie is set
    entries = client.get("/api/entries").json()
    assert len(entries) >= 12
    assert {e["currency"] for e in entries} == {"USD", "EUR", "KRW"}
    assert any(e["confidence"] < 0.75 for e in entries)  # one "Check this" row
    assert all(e["model_used"] == "sample" and not e["user_corrected"] for e in entries)
    assert client.get("/api/entries", params={"limit": 3}).json()[0]["date"] == max(
        e["date"] for e in entries
    )


def test_demo_uses_the_given_timezone(client):
    assert start_demo(client, timezone="Asia/Seoul")["timezone"] == "Asia/Seoul"
    client.post("/api/auth/logout")
    assert client.post("/api/auth/demo", json={"timezone": "Mars/Base"}).status_code == 422


def test_demo_accounts_are_separate_sandboxes(client):
    first = start_demo(client)
    entry_id = client.get("/api/entries").json()[0]["id"]
    client.post("/api/auth/logout")

    second = start_demo(client)
    assert second["id"] != first["id"]
    assert client.get(f"/api/entries/{entry_id}").status_code == 404


def test_nobody_can_log_into_a_demo_account_with_a_password(client):
    user = start_demo(client)
    client.cookies.clear()
    for password in ("x", "password123", "demo"):
        body = {"email": user["email"], "password": password}
        # 422: the .invalid demo domain isn't a valid login email; 401: wrong credentials.
        assert client.post("/api/auth/login", json=body).status_code in (401, 422)
    assert client.get("/api/auth/me").status_code == 401


def test_fixing_a_sample_entry_works_like_a_real_one(client):
    start_demo(client)
    entry = client.get("/api/entries").json()[0]
    fixed = client.patch(f"/api/entries/{entry['id']}", json={"amount": 99}).json()
    assert fixed["amount"] == "99.00" and fixed["user_corrected"] is True


def test_demo_has_a_smaller_ai_cap(client, monkeypatch):
    settings = Settings(ai_daily_cap_user=30, ai_daily_cap_demo=1)
    monkeypatch.setattr(usage_service, "get_settings", lambda: settings)
    start_demo(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert client.post("/api/entries", json={"text": "Coffee $6.50"}).status_code == 201
    blocked = client.post("/api/entries", json={"text": "Coffee $6.50"})
    assert blocked.status_code == 429
    assert client.get("/api/usage").json()["limit"] == 1


def test_expired_demo_session_is_rejected(client):
    user = start_demo(client)
    db = db_session()
    db.get(User, uuid.UUID(user["id"])).expires_at = utcnow() - dt.timedelta(minutes=1)
    db.commit()

    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "expired" in response.json()["detail"]
    assert client.get("/api/entries").status_code == 401


def test_cleanup_deletes_only_expired_demo_accounts(client):
    db = db_session()
    signup(client, "real@example.com")
    add_manual(client)
    client.post("/api/auth/logout")

    old = start_demo(client)
    client.post("/api/auth/logout")
    fresh = start_demo(client)
    client.post("/api/auth/logout")

    old_id = uuid.UUID(old["id"])
    old_user = db.get(User, old_id)
    old_user.expires_at = utcnow() - dt.timedelta(days=1)
    db.add(UsageCounter(scope=f"u:{old['id']}", day=utcnow().date(), kind="text", count=3))
    db.commit()

    assert demo_service.delete_expired_demo_users(db) == 1
    db.expire_all()

    assert db.get(User, uuid.UUID(old["id"])) is None
    assert db.scalar(select(func.count()).select_from(Entry).where(Entry.user_id == old_id)) == 0
    assert db.scalar(select(UsageCounter).where(UsageCounter.scope == f"u:{old['id']}")) is None
    assert db.get(User, uuid.UUID(fresh["id"])) is not None
    assert (
        db.scalar(select(func.count()).select_from(User).where(User.email == "real@example.com"))
        == 1
    )
    assert db.scalar(select(func.count()).select_from(Entry)) > 12  # fresh demo + real entry kept
    assert demo_service.delete_expired_demo_users(db) == 0


def test_starting_a_demo_also_clears_expired_ones(client):
    old = start_demo(client)
    client.post("/api/auth/logout")
    db = db_session()
    db.get(User, uuid.UUID(old["id"])).expires_at = utcnow() - dt.timedelta(seconds=1)
    db.commit()

    start_demo(client)
    db.expire_all()
    assert db.get(User, uuid.UUID(old["id"])) is None


def test_demo_is_full_when_too_many_are_alive(client, monkeypatch):
    monkeypatch.setattr(demo_service, "get_settings", lambda: Settings(demo_max_active=2))
    start_demo(client)
    start_demo(client)
    full = client.post("/api/auth/demo")
    assert full.status_code == 503
    assert "full" in full.json()["detail"]


def test_demo_start_is_rate_limited(client):
    for _ in range(10):
        start_demo(client)
    assert client.post("/api/auth/demo").status_code == 429


def signup_with_tz(client):
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "tz@example.com",
            "password": "correct horse battery",
            "timezone": "Asia/Seoul",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_signup_can_save_the_browser_timezone(client):
    user = signup_with_tz(client)
    assert user["timezone"] == "Asia/Seoul"
    bad = client.post(
        "/api/auth/signup",
        json={
            "email": "x@example.com",
            "password": "correct horse battery",
            "timezone": "Nope/Nope",
        },
    )
    assert bad.status_code == 422


def test_entry_limit_for_demo_and_regular_accounts(client, monkeypatch):
    settings = Settings(max_entries_demo=16, max_entries_user=2)
    monkeypatch.setattr(entry_service, "get_settings", lambda: settings)

    start_demo(client)  # 15 sample entries; the limit is 16
    add_manual(client)
    full = client.post(
        "/api/entries/manual",
        json={"date": "2026-10-15", "amount": 5, "currency": "USD", "category": "other"},
    )
    assert full.status_code == 409
    assert full.json()["detail"]["code"] == "entry_limit"
    client.post("/api/auth/logout")

    signup(client)
    add_manual(client)
    add_manual(client)
    assert (
        client.post(
            "/api/entries/manual",
            json={"date": "2026-10-15", "amount": 5, "currency": "USD", "category": "other"},
        ).status_code
        == 409
    )


def test_a_full_account_does_not_spend_an_ai_call(client, monkeypatch):
    monkeypatch.setattr(entry_service, "get_settings", lambda: Settings(max_entries_user=1))
    signup(client)
    add_manual(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))

    assert client.post("/api/entries", json={"text": "Coffee $6.50"}).status_code == 409
    assert client.get("/api/usage").json()["used"] == 0
