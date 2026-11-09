import datetime as dt
import secrets
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import utcnow
from app.models import Attachment, Entry, UsageCounter, User
from app.services import parse_service
from app.services.demo_data import SAMPLE_ENTRIES

DEMO_EMAIL_DOMAIN = "demo.parsimony.invalid"  # .invalid can never be a real address


class DemoUnavailable(Exception):
    """Too many demo accounts are alive right now."""


def create_demo_user(db: Session, timezone: str | None) -> User:
    """A passwordless sandbox account with sample data that expires on its own."""
    settings = get_settings()
    now = utcnow()
    delete_expired_demo_users(db, now)  # also keeps the active count below honest

    active = db.scalar(
        select(func.count()).select_from(User).where(User.is_demo.is_(True), User.expires_at > now)
    )
    if (active or 0) >= settings.demo_max_active:
        raise DemoUnavailable

    user = User(
        email=f"demo-{secrets.token_hex(6)}@{DEMO_EMAIL_DOMAIN}",
        password_hash=None,  # nobody can log into a demo account with a password
        is_demo=True,
        default_currency="USD",
        timezone=timezone or "UTC",
        expires_at=now + dt.timedelta(days=settings.demo_ttl_days),
    )
    db.add(user)
    db.flush()

    today = parse_service.build_context(user).today
    for (
        days_ago,
        merchant,
        note,
        amount,
        currency,
        category,
        payment,
        confidence,
        text,
    ) in SAMPLE_ENTRIES:
        date = today - dt.timedelta(days=days_ago)
        answer = {
            "date": date.isoformat(),
            "merchant": merchant,
            "note": note,
            "amount": float(amount),
            "currency": currency,
            "category": category,
            "payment_method": payment,
            "confidence": confidence,
        }
        db.add(
            Entry(
                user_id=user.id,
                date=date,
                merchant=merchant,
                note=note,
                amount=Decimal(amount),
                currency=currency,
                category=category,
                payment_method=payment,
                source="text",
                raw_input=text,
                confidence=confidence,
                model_used="sample",
                ai_output=answer,  # lets "Fix this" behave like it does on real AI entries
                user_corrected=False,
            )
        )
    db.commit()
    return user


def delete_expired_demo_users(db: Session, now: dt.datetime | None = None) -> int:
    """Delete demo accounts past their expiry, with their entries, counters and files."""
    now = now or utcnow()
    expired = list(
        db.scalars(select(User.id).where(User.is_demo.is_(True), User.expires_at <= now))
    )
    if not expired:
        return 0

    file_paths = list(db.scalars(select(Attachment.path).where(Attachment.user_id.in_(expired))))
    db.execute(delete(UsageCounter).where(UsageCounter.scope.in_([f"u:{i}" for i in expired])))
    # Entries and attachments go too, through the database's ON DELETE CASCADE.
    db.execute(delete(User).where(User.id.in_(expired)))
    db.commit()
    _remove_files(file_paths)
    return len(expired)


def _remove_files(relative_paths: list[str]) -> None:
    root = Path(get_settings().upload_dir).resolve()
    for relative in relative_paths:
        target = (root / relative).resolve()
        if root in target.parents:  # never delete outside the upload folder
            target.unlink(missing_ok=True)
