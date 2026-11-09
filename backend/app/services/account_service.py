"""Changing and deleting accounts. Used by the "My page" endpoints and the demo cleanup."""

import uuid
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Attachment, UsageCounter, User


def update_settings(
    db: Session, user: User, default_currency: str | None, timezone: str | None
) -> User:
    """Change the account's default currency and/or timezone. None means "leave as is"."""
    if default_currency is not None:
        user.default_currency = default_currency
    if timezone is not None:
        user.timezone = timezone
    db.commit()
    db.refresh(user)
    return user


def delete_users(db: Session, user_ids: list[uuid.UUID]) -> None:
    """Delete accounts with their entries, usage counters and uploaded files."""
    if not user_ids:
        return
    file_paths = list(db.scalars(select(Attachment.path).where(Attachment.user_id.in_(user_ids))))
    db.execute(delete(UsageCounter).where(UsageCounter.scope.in_([f"u:{i}" for i in user_ids])))
    # Entries and attachments go too, through the database's ON DELETE CASCADE.
    db.execute(delete(User).where(User.id.in_(user_ids)))
    db.commit()
    remove_files(file_paths)  # after the commit: a failed delete never leaves files without rows


def delete_account(db: Session, user: User) -> None:
    delete_users(db, [user.id])


def remove_files(relative_paths: list[str]) -> None:
    root = Path(get_settings().upload_dir).resolve()
    for relative in relative_paths:
        target = (root / relative).resolve()
        if root in target.parents:  # never delete outside the upload folder
            target.unlink(missing_ok=True)
