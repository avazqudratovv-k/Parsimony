from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class UsageCounter(Base):
    """Daily AI-call counts. scope is "global" or "u:<user_id>".

    A string scope (not a nullable user_id) keeps the unique constraint reliable in Postgres,
    where NULLs count as distinct. The demo cleanup script deletes a user's rows itself.
    """

    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("scope", "day", "kind", name="uq_usage_scope_day_kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(64))
    day: Mapped[dt.date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(16))  # text | vision | audio
    count: Mapped[int] = mapped_column(Integer, default=0)
