from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import JSON, DateTime, Float, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EvalRun(Base):
    """One benchmark run of a model against the labeled test set (used in Tier 3)."""

    __tablename__ = "eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    model_name: Mapped[str] = mapped_column(String(100))
    test_set_version: Mapped[str] = mapped_column(String(32))
    n: Mapped[int] = mapped_column(Integer)
    field_accuracy: Mapped[dict | None] = mapped_column(JSON)
    exact_match: Mapped[float] = mapped_column(Float)
    json_valid_rate: Mapped[float] = mapped_column(Float)
    p50_ms: Mapped[float | None] = mapped_column(Float)
    p95_ms: Mapped[float | None] = mapped_column(Float)
    cost_usd: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
