import datetime as dt
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.db import Base
from app.models import Entry, UsageCounter, User


@pytest.fixture
def session():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        # SQLite ignores foreign keys by default; Postgres always enforces them.
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def make_entry(user: User) -> Entry:
    return Entry(
        user=user,
        date=dt.date(2026, 11, 9),
        note="Coffee with Sam",
        amount=Decimal("6.50"),
        currency="USD",
        category="food_drink",
        payment_method="card",
        source="text",
        raw_input="Coffee with Sam, $6.50, card, this morning",
        confidence=0.82,
        model_used="fake",
        ai_output={"amount": 6.5},
    )


def test_entry_roundtrip(session):
    user = User(email="a@example.com")
    make_entry(user)
    session.add(user)
    session.commit()

    entry = session.scalars(select(Entry)).one()
    assert entry.amount == Decimal("6.50")
    assert entry.user_corrected is False
    assert entry.merchant is None
    assert user.is_demo is False
    assert user.default_currency == "USD"


def test_deleting_user_deletes_entries(session):
    user = User(email="b@example.com")
    make_entry(user)
    session.add(user)
    session.commit()

    session.delete(user)
    session.commit()
    assert session.scalars(select(Entry)).all() == []


def test_email_is_unique(session):
    session.add_all([User(email="same@example.com"), User(email="same@example.com")])
    with pytest.raises(IntegrityError):
        session.commit()


def test_usage_counter_unique_per_scope_day_kind(session):
    day = dt.date(2026, 11, 9)
    session.add_all(
        [
            UsageCounter(scope="global", day=day, kind="text", count=1),
            UsageCounter(scope="global", day=day, kind="text", count=1),
        ]
    )
    with pytest.raises(IntegrityError):
        session.commit()
