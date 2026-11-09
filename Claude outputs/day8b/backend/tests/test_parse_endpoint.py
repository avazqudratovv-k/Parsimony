import datetime as dt

import pytest
from fastapi import HTTPException

from app.ai import prompts, registry
from app.ai.base import AdapterError, ParseContext
from app.ai.registry import get_text_parser
from app.config import Settings
from app.main import app
from app.models.enums import Category, PaymentMethod
from tests.fakes import FakeParser, good_json

CREDS = {"email": "me@example.com", "password": "correct horse battery"}


def login(client):
    assert client.post("/api/auth/signup", json=CREDS).status_code == 201


def use_parser(parser):
    app.dependency_overrides[get_text_parser] = lambda: parser


def parse(client, text="Coffee with Sam, $6.50, card", **extra):
    return client.post("/api/entries/parse", json={"text": text, **extra})


def test_parse_returns_entry_preview(client):
    login(client)
    use_parser(FakeParser(good_json()))
    response = parse(client)

    assert response.status_code == 200
    body = response.json()
    assert body["model_used"] == "fake-model"
    assert body["entry"]["amount"] == "6.50"
    assert body["entry"]["category"] == "food_drink"


def test_parser_gets_the_users_context(client):
    login(client)
    parser = FakeParser(good_json())
    use_parser(parser)
    parse(client, timezone="Asia/Seoul")

    text, ctx = parser.calls[0]
    assert text == "Coffee with Sam, $6.50, card"
    assert ctx.timezone == "Asia/Seoul"
    assert ctx.default_currency == "USD"
    assert isinstance(ctx.today, dt.date)


def test_requires_login(client):
    use_parser(FakeParser(good_json()))
    assert parse(client).status_code == 401


@pytest.mark.parametrize("payload", [{"text": ""}, {"text": "   "}, {"text": "x" * 501}])
def test_rejects_bad_text(client, payload):
    login(client)
    use_parser(FakeParser(good_json()))
    assert client.post("/api/entries/parse", json=payload).status_code == 422


def test_rejects_unknown_timezone(client):
    login(client)
    use_parser(FakeParser(good_json()))
    assert parse(client, timezone="Mars/Olympus").status_code == 422


def test_unreadable_model_output_gives_422(client):
    login(client)
    use_parser(FakeParser("garbage"))
    response = parse(client)
    assert response.status_code == 422
    assert "rephras" in response.json()["detail"]


def test_not_an_expense_gives_422(client):
    login(client)
    use_parser(FakeParser(good_json(amount=0)))
    response = parse(client, text="hello")
    assert response.status_code == 422
    assert "amount" in response.json()["detail"]


def test_model_down_gives_502(client):
    login(client)
    use_parser(FakeParser(AdapterError("down")))
    assert parse(client).status_code == 502


def test_503_when_no_api_key(monkeypatch):
    monkeypatch.setattr(registry, "get_settings", lambda: Settings(gemini_api_key=""))
    with pytest.raises(HTTPException) as exc:
        registry.get_text_parser()
    assert exc.value.status_code == 503


def test_prompt_and_schema_match_the_enums():
    ctx = ParseContext(today=dt.date(2026, 11, 9), timezone="Asia/Seoul", default_currency="KRW")
    prompt = prompts.build_system_prompt(ctx)

    assert "2026-11-09" in prompt and "Monday" in prompt
    assert "Asia/Seoul" in prompt and "KRW" in prompt
    for category in Category:
        assert category.value in prompt
    props = prompts.ENTRY_JSON_SCHEMA["properties"]
    assert props["category"]["enum"] == [c.value for c in Category]
    assert props["payment_method"]["enum"] == [p.value for p in PaymentMethod]
