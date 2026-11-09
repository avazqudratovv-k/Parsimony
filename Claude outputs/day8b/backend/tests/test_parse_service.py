import datetime as dt
from decimal import Decimal

import pytest

from app.ai.base import AdapterError, ParseContext
from app.services.parse_service import NotAnExpense, ParseFailed, parse_text
from tests.fakes import FakeParser, good_json

CTX = ParseContext(today=dt.date(2026, 11, 9), timezone="UTC", default_currency="USD")


def test_valid_output_becomes_an_entry():
    parser = FakeParser(good_json())
    outcome = parse_text(parser, "Coffee with Sam, $6.50, card", CTX)

    assert outcome.entry.amount == Decimal("6.50")
    assert outcome.entry.category == "food_drink"
    assert outcome.entry.merchant is None
    assert outcome.model_used == "fake-model"
    assert outcome.raw["note"] == "Coffee with Sam"
    assert len(parser.calls) == 1


def test_messy_but_fixable_values_are_normalized():
    parser = FakeParser(good_json(currency=" usd ", amount=6.505, merchant="  "))
    entry = parse_text(parser, "x", CTX).entry
    assert entry.currency == "USD"
    assert entry.amount == Decimal("6.51")
    assert entry.merchant is None


def test_invalid_json_is_retried_once_then_succeeds():
    parser = FakeParser("not json at all", good_json())
    outcome = parse_text(parser, "x", CTX)
    assert outcome.entry.currency == "USD"
    assert len(parser.calls) == 2


@pytest.mark.parametrize(
    "bad",
    [
        "[1, 2]",
        good_json(category="snacks"),
        good_json(confidence=1.5),
        good_json(amount=-3),
        good_json(currency="DOLLARS"),
        good_json(date="2030-01-01"),  # after CTX.today
        good_json(date="tomorrow-ish"),
    ],
)
def test_bad_output_twice_fails_after_two_attempts(bad):
    parser = FakeParser(bad)
    with pytest.raises(ParseFailed):
        parse_text(parser, "x", CTX)
    assert len(parser.calls) == 2


def test_amount_zero_means_not_an_expense_and_is_not_retried():
    parser = FakeParser(good_json(amount=0))
    with pytest.raises(NotAnExpense):
        parse_text(parser, "hello there", CTX)
    assert len(parser.calls) == 1


def test_adapter_errors_pass_through():
    parser = FakeParser(AdapterError("down"))
    with pytest.raises(AdapterError):
        parse_text(parser, "x", CTX)
