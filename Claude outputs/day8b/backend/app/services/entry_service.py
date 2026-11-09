import datetime as dt
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.base import TextParser
from app.config import get_settings
from app.models import Entry, User
from app.models.enums import UsageKind
from app.schemas.entry import EntryCreate
from app.services import parse_service, usage_service


class EntryLimitReached(Exception):
    def __init__(self, limit: int) -> None:
        super().__init__(limit)
        self.limit = limit


def entry_limit(user: User) -> int:
    settings = get_settings()
    return settings.max_entries_demo if user.is_demo else settings.max_entries_user


def _check_room(db: Session, user: User) -> None:
    limit = entry_limit(user)
    count = db.scalar(select(func.count()).select_from(Entry).where(Entry.user_id == user.id))
    if (count or 0) >= limit:
        raise EntryLimitReached(limit)


def month_bounds(month: str) -> tuple[dt.date, dt.date]:
    """ "2026-11" -> (2026-11-01, 2026-12-01): start inclusive, end exclusive."""
    year, mon = (int(part) for part in month.split("-"))
    start = dt.date(year, mon, 1)
    end = dt.date(year + (mon == 12), mon % 12 + 1, 1)
    return start, end


def _save(
    db: Session,
    user: User,
    data: EntryCreate,
    *,
    raw_input: str | None,
    confidence: float,
    model_used: str,
    ai_output: dict | None,
) -> Entry:
    entry = Entry(
        user_id=user.id,
        date=data.date,
        merchant=data.merchant,
        note=data.note,
        amount=data.amount,
        currency=data.currency,
        category=data.category.value,
        payment_method=data.payment_method.value,
        source="text",
        raw_input=raw_input,
        confidence=confidence,
        model_used=model_used,
        ai_output=ai_output,
        user_corrected=False,
    )
    db.add(entry)
    db.commit()
    return entry


def create_from_text(
    db: Session, user: User, parser: TextParser, text: str, timezone: str | None
) -> Entry:
    """Typed text -> model -> validated JSON -> saved entry. Counts against the daily AI cap."""
    _check_room(db, user)  # before the AI call, so a full account never spends a cap
    usage_service.consume(db, user, UsageKind.TEXT)
    ctx = parse_service.build_context(user, timezone)
    outcome = parse_service.parse_text(parser, text, ctx)
    return _save(
        db,
        user,
        outcome.entry,
        raw_input=text,
        confidence=outcome.entry.confidence,
        model_used=outcome.model_used,
        ai_output=outcome.raw,
    )


def create_manual(db: Session, user: User, data: EntryCreate) -> Entry:
    """The fallback when the AI can't read something. No AI call, so no cap."""
    _check_room(db, user)
    return _save(
        db, user, data, raw_input=None, confidence=1.0, model_used="manual", ai_output=None
    )


def get_entry(db: Session, user: User, entry_id: uuid.UUID) -> Entry | None:
    entry = db.get(Entry, entry_id)
    return entry if entry is not None and entry.user_id == user.id else None


def list_entries(
    db: Session,
    user: User,
    *,
    month: str | None,
    currency: str | None,
    limit: int,
    offset: int,
) -> list[Entry]:
    statement = select(Entry).where(Entry.user_id == user.id)
    if month:
        start, end = month_bounds(month)
        statement = statement.where(Entry.date >= start, Entry.date < end)
    if currency:
        statement = statement.where(Entry.currency == currency.upper())
    statement = statement.order_by(Entry.date.desc(), Entry.created_at.desc())
    return list(db.scalars(statement.limit(limit).offset(offset)))


def update_entry(db: Session, entry: Entry, changes: dict) -> Entry:
    """Apply a partial update. A real change to an AI-made entry marks it user_corrected."""
    changed = False
    for field, value in changes.items():
        if field in {"category", "payment_method"}:
            value = value.value
        if getattr(entry, field) != value:
            setattr(entry, field, value)
            changed = True
    # entry.ai_output keeps the model's original answer, so (input, ai_output, corrected row)
    # can become a training example later. Manual entries have no model answer to correct.
    if changed and entry.ai_output is not None:
        entry.user_corrected = True
    db.commit()
    return entry


def delete_entry(db: Session, entry: Entry) -> None:
    db.delete(entry)
    db.commit()
