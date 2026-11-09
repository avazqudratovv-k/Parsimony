import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.base import ImageParser, TextParser
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
    source: str = "text",
    merchant_domain: str | None = None,
    group_id: uuid.UUID | None = None,
) -> Entry:
    entry = Entry(
        user_id=user.id,
        date=data.date,
        merchant=data.merchant,
        merchant_domain=merchant_domain if get_settings().logos_enabled else None,
        group_id=group_id,
        note=data.note,
        amount=data.amount,
        currency=data.currency,
        category=data.category.value,
        payment_method=data.payment_method.value,
        source=source,
        raw_input=raw_input,
        confidence=confidence,
        model_used=model_used,
        ai_output=ai_output,
        user_corrected=False,
    )
    db.add(entry)
    db.commit()
    return entry


def _mixed_currencies(entry, items) -> bool:
    """True when the items are in more than one currency, so they cannot share a total."""
    return any(i.currency and i.currency != entry.currency for i in items)


def _split_items(db: Session, user: User, entry) -> list:
    """The per-item parts of one purchase, or [] when the entry should simply be saved whole.

    Items are used only when there are at least two, they add up to the total (so no money is
    invented or lost) unless they are in different currencies, and the account has room for
    all of them.
    """
    items = entry.items
    if len(items) < 2:
        return []
    if not _mixed_currencies(entry, items) and (
        abs(sum(i.amount for i in items) - entry.amount) > Decimal("0.01")
    ):
        return []
    count = db.scalar(select(func.count()).select_from(Entry).where(Entry.user_id == user.id)) or 0
    if count + len(items) > entry_limit(user):
        return []
    return items


def create_from_text(
    db: Session,
    user: User,
    parser: TextParser,
    text: str,
    timezone: str | None,
    source: str = "text",
) -> list[Entry]:
    """Typed text -> model -> validated JSON -> saved entries. Counts against the daily AI cap once.

    Usually one entry. A purchase with several items in different categories becomes one entry per
    item (same date, merchant, currency and payment method), saved together.
    """
    _check_room(db, user)  # before the AI call, so a full account never spends a cap
    usage_service.consume(db, user, UsageKind.TEXT)
    ctx = parse_service.build_context(user, timezone)
    outcome = parse_service.parse_text(parser, text, ctx)
    entry = outcome.entry
    items = _split_items(db, user, entry)
    if not items:
        return [
            _save(
                db,
                user,
                entry,
                raw_input=text,
                confidence=entry.confidence,
                model_used=outcome.model_used,
                ai_output=outcome.raw,
                source=source,
                merchant_domain=entry.merchant_domain,
            )
        ]
    saved = []
    group_id = uuid.uuid4()  # the items of this purchase are shown together
    for item in items:
        part = EntryCreate(
            date=entry.date,
            merchant=entry.merchant,
            note=item.note,
            amount=item.amount,
            currency=item.currency or entry.currency,
            category=item.category,
            payment_method=item.payment_method or entry.payment_method,
        )
        saved.append(
            _save(
                db,
                user,
                part,
                raw_input=text,
                confidence=entry.confidence,
                model_used=outcome.model_used,
                ai_output=outcome.raw,
                source=source,
                merchant_domain=entry.merchant_domain,
                group_id=group_id,
            )
        )
    return saved


def create_from_photo(
    db: Session,
    user: User,
    parser: ImageParser,
    image: bytes,
    mime: str,
    timezone: str | None,
) -> Entry:
    """Receipt photo -> model -> validated JSON -> saved entry. Costs one smart add.

    The photo stays in memory: it is not saved anywhere, only the entry the model read from it.
    """
    _check_room(db, user)  # before the AI call, so a full account never spends a smart add
    usage_service.consume(db, user, UsageKind.VISION)
    ctx = parse_service.build_context(user, timezone)
    outcome = parse_service.parse_image(parser, image, mime, ctx)
    return _save(
        db,
        user,
        outcome.entry,
        raw_input=None,
        confidence=outcome.entry.confidence,
        model_used=outcome.model_used,
        ai_output=outcome.raw,
        source="photo",
        merchant_domain=outcome.entry.merchant_domain,
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
    if "merchant" in changes:
        entry.merchant_domain = None  # a renamed merchant is no longer the one the logo was for
    # entry.ai_output keeps the model's original answer, so (input, ai_output, corrected row)
    # can become a training example later. Manual entries have no model answer to correct.
    if changed and entry.ai_output is not None:
        entry.user_corrected = True
    db.commit()
    return entry


def delete_entry(db: Session, entry: Entry) -> None:
    db.delete(entry)
    db.commit()
