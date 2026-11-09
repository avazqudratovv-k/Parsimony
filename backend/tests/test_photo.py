"""Receipt photos: photo -> model -> saved entry. The photo itself is never stored."""

import struct
import zlib

from sqlalchemy import func, select

from app.ai.base import AdapterError
from app.config import Settings
from app.db import get_db
from app.main import app
from app.models import Attachment
from app.routers import entries as entries_router
from app.services import entry_service
from tests.fakes import FakeImageParser, good_json
from tests.helpers import signup, use_image_parser


def tiny_png() -> bytes:
    """A real 1x1 PNG, so the file starts with the genuine PNG signature."""

    def chunk(kind: bytes, body: bytes) -> bytes:
        crc = zlib.crc32(kind + body)
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", crc)

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixel = zlib.compress(b"\x00\xff\xff\xff")
    return (
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixel) + chunk(b"IEND", b"")
    )


def receipt_json(**overrides) -> str:
    base = {
        "merchant": "GS25",
        "note": "Snacks",
        "amount": 7300,
        "currency": "KRW",
        "payment_method": "card",
        "category": "groceries",
        "confidence": 0.9,
        "date": "2026-10-15",
    }
    base.update(overrides)
    return good_json(**base)


def send_photo(client, data: bytes | None = None, name="r.png", ctype="image/png", **form):
    return client.post(
        "/api/entries/photo",
        files={"file": (name, tiny_png() if data is None else data, ctype)},
        data=form,
    )


def used(client) -> int:
    return client.get("/api/usage").json()["used"]


def test_photo_becomes_an_entry_with_source_photo(client):
    signup(client)
    parser = FakeImageParser(receipt_json())
    use_image_parser(parser)

    response = send_photo(client, timezone="Asia/Seoul")

    assert response.status_code == 201
    entry = response.json()
    assert entry["source"] == "photo"
    assert entry["merchant"] == "GS25" and entry["currency"] == "KRW"
    assert entry["amount"] == "7300.00" and entry["category"] == "groceries"
    assert entry["raw_input"] is None
    assert entry["model_used"] == "fake-vision-model"
    assert entry["user_corrected"] is False
    image, mime, ctx = parser.calls[0]
    assert image == tiny_png() and mime == "image/png"
    assert ctx.timezone == "Asia/Seoul"
    assert client.get("/api/entries").json()[0]["id"] == entry["id"]


def test_the_photo_is_not_stored_anywhere(client, monkeypatch, tmp_path):
    monkeypatch.setattr(entry_service, "get_settings", lambda: Settings(upload_dir=str(tmp_path)))
    signup(client)
    use_image_parser(FakeImageParser(receipt_json()))

    assert send_photo(client).status_code == 201

    assert list(tmp_path.iterdir()) == []
    db = next(app.dependency_overrides[get_db]())
    assert db.scalar(select(func.count()).select_from(Attachment)) == 0


def test_the_real_file_type_is_checked_not_the_label(client):
    signup(client)
    parser = FakeImageParser(receipt_json())
    use_image_parser(parser)

    response = send_photo(client, data=b"not a picture at all", name="r.png", ctype="image/png")

    assert response.status_code == 415
    assert parser.calls == [] and used(client) == 0


def test_empty_upload_is_rejected_without_spending_a_smart_add(client):
    signup(client)
    use_image_parser(FakeImageParser(receipt_json()))
    response = send_photo(client, data=b"")
    assert response.status_code == 422 and used(client) == 0


def test_too_large_photo_is_rejected_without_calling_the_model(client, monkeypatch):
    monkeypatch.setattr(entries_router, "get_settings", lambda: Settings(max_photo_bytes=50))
    signup(client)
    parser = FakeImageParser(receipt_json())
    use_image_parser(parser)

    response = send_photo(client)  # a real PNG is longer than 50 bytes

    assert response.status_code == 413
    assert parser.calls == [] and used(client) == 0


def test_a_photo_that_is_not_a_receipt_is_a_clear_error_and_still_counts(client):
    signup(client)
    use_image_parser(FakeImageParser(receipt_json(amount=0)))

    response = send_photo(client)

    assert response.status_code == 422
    assert client.get("/api/entries").json() == []
    assert used(client) == 1  # the model was asked, so it counts like a failed typed call


def test_unreadable_model_answer_is_retried_once_then_fails(client):
    signup(client)
    parser = FakeImageParser("garbage")
    use_image_parser(parser)

    assert send_photo(client).status_code == 422
    assert len(parser.calls) == 2 and used(client) == 1


def test_model_outage_is_a_502(client):
    signup(client)
    use_image_parser(FakeImageParser(AdapterError("down")))
    assert send_photo(client).status_code == 502


def test_future_receipt_date_is_rejected(client):
    signup(client)
    use_image_parser(FakeImageParser(receipt_json(date="2999-01-01")))
    assert send_photo(client).status_code == 422


def test_photos_use_the_smart_add_cap(client, monkeypatch):
    from app.services import usage_service

    settings = Settings(ai_daily_cap_user=1)
    monkeypatch.setattr(usage_service, "get_settings", lambda: settings)
    signup(client)
    use_image_parser(FakeImageParser(receipt_json()))

    assert send_photo(client).status_code == 201
    blocked = send_photo(client)

    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "daily_limit_account"
    assert used(client) == 1


def test_full_account_is_refused_before_a_smart_add_is_spent(client, monkeypatch):
    monkeypatch.setattr(entry_service, "get_settings", lambda: Settings(max_entries_user=1))
    signup(client)
    parser = FakeImageParser(receipt_json())
    use_image_parser(parser)

    assert send_photo(client).status_code == 201
    response = send_photo(client)

    assert response.status_code == 409
    assert len(parser.calls) == 1 and used(client) == 1


def test_bad_timezone_is_rejected(client):
    signup(client)
    parser = FakeImageParser(receipt_json())
    use_image_parser(parser)
    assert send_photo(client, timezone="Mars/Olympus").status_code == 422
    assert parser.calls == []


def test_photo_upload_needs_a_login(client):
    use_image_parser(FakeImageParser(receipt_json()))
    assert send_photo(client).status_code == 401
