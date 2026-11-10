import datetime as dt

import pytest

from app.ai import prompts
from app.ai.base import ParseContext
from app.config import get_settings
from app.schemas.parse import clean_domain
from tests.fakes import FakeParser, good_json
from tests.helpers import signup, use_parser


@pytest.fixture
def logos_on(monkeypatch):
    monkeypatch.setenv("LOGOS_ENABLED", "true")
    get_settings.cache_clear()
    yield
    monkeypatch.delenv("LOGOS_ENABLED")
    get_settings.cache_clear()


def post(client):
    return client.post("/api/entries", json={"text": "gs25 3500 won"})


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("gs25.com", "gs25.com"),
        ("https://www.GS25.com/store", "gs25.com"),
        ("not a domain", None),
        ("localhost", None),
        ("x" * 120 + ".com", None),
        (None, None),
        (42, None),
    ],
)
def test_domains_are_cleaned_or_dropped(raw, clean):
    assert clean_domain(raw) == clean


def test_logos_are_off_by_default_nothing_is_asked_or_stored(client):
    ctx = ParseContext(today=dt.date(2026, 11, 9), timezone="UTC", default_currency="KRW")
    assert "merchant_domain" not in prompts.entry_json_schema()["properties"]
    assert "merchant_domain" not in prompts.build_system_prompt(ctx)

    signup(client)
    use_parser(
        FakeParser(good_json(date="2026-10-15", merchant="GS25", merchant_domain="gs25.com"))
    )
    assert post(client).json()["merchant_domain"] is None  # the model said one; it is not kept


def test_when_switched_on_the_model_is_asked_and_the_domain_is_kept(client, logos_on):
    ctx = ParseContext(today=dt.date(2026, 11, 9), timezone="UTC", default_currency="KRW")
    assert "merchant_domain" in prompts.entry_json_schema()["properties"]
    assert "merchant_domain" in prompts.build_system_prompt(ctx)

    signup(client)
    use_parser(
        FakeParser(good_json(date="2026-10-15", merchant="GS25", merchant_domain="gs25.com"))
    )
    entry = post(client).json()
    assert entry["merchant_domain"] == "gs25.com"

    renamed = client.patch(f"/api/entries/{entry['id']}", json={"merchant": "CU"}).json()
    assert renamed["merchant_domain"] is None  # a new name drops the old logo


def test_a_junk_domain_never_breaks_saving(client, logos_on):
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15", merchant="GS25", merchant_domain="???")))
    response = post(client)
    assert response.status_code == 201
    assert response.json()["merchant_domain"] is None


def test_known_brands_map_to_their_logo_domain():
    from app.services.brand_domains import known_domain

    assert known_domain("Starbucks") == "starbucks.co.kr"
    assert known_domain("스타벅스") == "starbucks.co.kr"
    assert known_domain("Trader Joe's") == "traderjoes.com"
    assert known_domain("Whole Foods") == "wholefoodsmarket.com"
    assert known_domain("Corner shop") is None
    assert known_domain(None) is None
