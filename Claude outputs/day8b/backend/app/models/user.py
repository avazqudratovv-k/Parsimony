from __future__ import annotations

import datetime as dt
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.entry import Entry


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # NULL for demo accounts, which have no password.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # Optional name shown on the My page screen. NULL means "use the email".
    display_name: Mapped[str | None] = mapped_column(String(80))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    default_currency: Mapped[str] = mapped_column(String(3), default="USD")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Set only for demo accounts; the cleanup script deletes rows past this time.
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    entries: Mapped[list[Entry]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    attachments: Mapped[list[Attachment]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
