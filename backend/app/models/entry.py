from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (Index("ix_entries_user_id_date", "user_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    date: Mapped[dt.date] = mapped_column(Date)
    merchant: Mapped[str | None] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(String(500))
    # Items of one purchase share a group_id, so the list can show them together.
    group_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    merchant_domain: Mapped[str | None] = mapped_column(String(100))  # e.g. "gs25.com"; logos only
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    category: Mapped[str] = mapped_column(String(32))
    payment_method: Mapped[str] = mapped_column(String(32))

    source: Mapped[str] = mapped_column(String(8))  # text | voice | photo
    raw_input: Mapped[str | None] = mapped_column(Text)  # original text or transcript
    confidence: Mapped[float] = mapped_column(Float)
    model_used: Mapped[str] = mapped_column(String(64))
    # Exactly what the model returned, kept so corrections can become training pairs.
    ai_output: Mapped[dict | None] = mapped_column(JSON)
    user_corrected: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="entries")
