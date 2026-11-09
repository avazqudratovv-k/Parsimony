import uuid
from pathlib import Path

from sqlalchemy import func, select

from app.config import get_settings
from app.models import Attachment, Entry, UsageCounter, User
from tests.helpers import add_manual, db_session, signup, start_demo

# ---- PATCH /api/auth/me -----------------------------------------------------------------


def test_update_default_currency_and_timezone(client):
    signup(client)
    r = client.patch("/api/auth/me", json={"default_currency": "krw", "timezone": "Asia/Seoul"})
    assert r.status_code == 200
    assert r.json()["default_currency"] == "KRW"  # upper-cased
    assert r.json()["timezone"] == "Asia/Seoul"
    assert client.get("/api/auth/me").json()["default_currency"] == "KRW"


def test_update_one_field_keeps_the_other(client):
    signup(client)
    client.patch("/api/auth/me", json={"timezone": "Asia/Seoul"})
    r = client.patch("/api/auth/me", json={"default_currency": "EUR"})
    assert r.json()["timezone"] == "Asia/Seoul"
    assert r.json()["default_currency"] == "EUR"


def test_update_rejects_bad_values(client):
    signup(client)
    assert client.patch("/api/auth/me", json={"default_currency": "DOLLARS"}).status_code == 422
    assert client.patch("/api/auth/me", json={"default_currency": "U$"}).status_code == 422
    assert client.patch("/api/auth/me", json={"timezone": "Mars/Base"}).status_code == 422


def test_empty_update_changes_nothing(client):
    user = signup(client)
    r = client.patch("/api/auth/me", json={})
    assert r.status_code == 200
    assert r.json()["default_currency"] == user["default_currency"]


def test_update_needs_login(client):
    assert client.patch("/api/auth/me", json={"timezone": "Asia/Seoul"}).status_code == 401


def test_demo_can_update_settings_too(client):
    start_demo(client)
    r = client.patch("/api/auth/me", json={"default_currency": "KRW"})
    assert r.status_code == 200 and r.json()["default_currency"] == "KRW"


# ---- DELETE /api/auth/me ----------------------------------------------------------------


def test_delete_account_removes_everything_and_signs_out(client):
    me = signup(client)
    add_manual(client)
    add_manual(client, merchant="Other")
    other = db_session()
    uid = uuid.UUID(me["id"])
    other.add(
        UsageCounter(
            scope=f"u:{me['id']}", day=__import__("datetime").date.today(), kind="text", count=2
        )
    )
    other.commit()

    r = client.delete("/api/auth/me")
    assert r.status_code == 204
    assert client.get("/api/auth/me").status_code == 401  # cookie cleared

    db = db_session()
    db.expire_all()
    assert db.get(User, uid) is None
    assert db.scalar(select(func.count()).select_from(Entry).where(Entry.user_id == uid)) == 0
    assert db.scalar(select(UsageCounter).where(UsageCounter.scope == f"u:{me['id']}")) is None


def test_delete_account_leaves_other_people_alone(client):
    signup(client, email="keep@example.com")
    add_manual(client)
    client.post("/api/auth/logout")
    signup(client, email="go@example.com")
    add_manual(client, merchant="Mine")
    assert client.delete("/api/auth/me").status_code == 204

    db = db_session()
    assert db.scalar(select(User).where(User.email == "keep@example.com")) is not None
    assert db.scalar(select(func.count()).select_from(Entry)) == 1


def test_delete_account_removes_uploaded_files(client, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    me = signup(client)
    entry = add_manual(client)
    keep = tmp_path / "outside.txt"
    keep.write_text("not mine")
    (tmp_path / "u1").mkdir()
    mine = Path(tmp_path / "u1" / "receipt.jpg")
    mine.write_bytes(b"x")
    db = db_session()
    db.add(
        Attachment(
            user_id=uuid.UUID(me["id"]),
            entry_id=uuid.UUID(entry["id"]),
            kind="image",
            path="u1/receipt.jpg",
            mime="image/jpeg",
            size_bytes=1,
        )
    )
    db.commit()

    assert client.delete("/api/auth/me").status_code == 204
    assert not mine.exists()
    assert keep.exists()


def test_delete_needs_login(client):
    assert client.delete("/api/auth/me").status_code == 401


def test_demo_can_delete_itself(client):
    start_demo(client)
    assert client.delete("/api/auth/me").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


# ---- GET /api/stats/overview ------------------------------------------------------------


def test_overview_totals_per_currency_across_all_months(client):
    signup(client)
    add_manual(client, date="2026-09-03", amount=10, currency="USD")
    add_manual(client, date="2026-10-20", amount=5.5, currency="USD")
    add_manual(client, date="2026-10-21", amount=9000, currency="KRW")
    r = client.get("/api/stats/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["total_entries"] == 3
    assert body["first_date"] == "2026-09-03"
    assert body["entry_limit"] == get_settings().max_entries_user
    # default currency (USD) first, then the rest
    assert body["totals"][0] == {"currency": "USD", "total": "15.50", "count": 2}
    assert body["totals"][1] == {"currency": "KRW", "total": "9000.00", "count": 1}


def test_overview_orders_default_currency_first_then_most_entries(client):
    signup(client)
    add_manual(client, amount=1, currency="EUR")
    add_manual(client, amount=1, currency="KRW")
    add_manual(client, amount=1, currency="KRW")
    add_manual(client, amount=500, currency="USD")  # biggest amount, but only a default by setting
    client.patch("/api/auth/me", json={"default_currency": "EUR"})
    codes = [t["currency"] for t in client.get("/api/stats/overview").json()["totals"]]
    assert codes == ["EUR", "KRW", "USD"]


def test_overview_for_an_empty_account(client):
    signup(client)
    body = client.get("/api/stats/overview").json()
    assert body == {
        "total_entries": 0,
        "entry_limit": get_settings().max_entries_user,
        "first_date": None,
        "totals": [],
    }


def test_overview_only_counts_own_entries_and_shows_demo_limit(client):
    signup(client, email="a@example.com")
    add_manual(client)
    client.post("/api/auth/logout")
    start_demo(client)
    body = client.get("/api/stats/overview").json()
    assert body["entry_limit"] == get_settings().max_entries_demo
    assert body["total_entries"] == 15  # the sample data only
    client.post("/api/auth/logout")
    assert client.get("/api/stats/overview").status_code == 401


# ---- display name -----------------------------------------------------------------------


def test_new_accounts_have_no_display_name(client):
    assert signup(client)["display_name"] is None


def test_set_trim_and_clear_the_display_name(client):
    signup(client)
    r = client.patch("/api/auth/me", json={"display_name": "  Avaz  "})
    assert r.json()["display_name"] == "Avaz"
    assert client.get("/api/auth/me").json()["display_name"] == "Avaz"
    assert client.patch("/api/auth/me", json={"display_name": ""}).json()["display_name"] is None
    client.patch("/api/auth/me", json={"display_name": "Avaz"})
    assert client.patch("/api/auth/me", json={"display_name": None}).json()["display_name"] is None


def test_other_edits_keep_the_display_name(client):
    signup(client)
    client.patch("/api/auth/me", json={"display_name": "Avaz"})
    r = client.patch("/api/auth/me", json={"default_currency": "KRW"})
    assert r.json()["display_name"] == "Avaz"


def test_display_name_length_is_capped(client):
    signup(client)
    assert client.patch("/api/auth/me", json={"display_name": "x" * 81}).status_code == 422
    assert client.patch("/api/auth/me", json={"display_name": "x" * 80}).status_code == 200


def test_null_currency_is_ignored_not_saved(client):
    signup(client)
    r = client.patch("/api/auth/me", json={"default_currency": None, "timezone": None})
    assert r.status_code == 200
    assert r.json()["default_currency"] == "USD"
