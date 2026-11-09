"""Daily caps on AI calls: one per account and one for the whole app.

Counts live in usage_counters (scope "u:<user_id>" or "global", per day and kind), by UTC day.
The check-then-increment is not locked, so a burst of simultaneous requests can overshoot a cap
by a few calls. That is fine here; the provider-side spend limit is the hard stop.
"""

import datetime as dt
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import UsageCounter, User
from app.models.enums import UsageKind


class DailyLimitReached(Exception):
    def __init__(self, which: Literal["account", "global"], resets_at: dt.datetime) -> None:
        super().__init__(which)
        self.which = which
        self.resets_at = resets_at


@dataclass(frozen=True)
class UsageSnapshot:
    used: int
    limit: int
    resets_at: dt.datetime


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _next_reset(now: dt.datetime) -> dt.datetime:
    return dt.datetime.combine(now.date() + dt.timedelta(days=1), dt.time.min, tzinfo=dt.UTC)


def _scope(user: User) -> str:
    return f"u:{user.id}"


def user_limit(user: User) -> int:
    settings = get_settings()
    return settings.ai_daily_cap_demo if user.is_demo else settings.ai_daily_cap_user


def _used_today(db: Session, scope: str, day: dt.date) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(UsageCounter.count), 0)).where(
            UsageCounter.scope == scope, UsageCounter.day == day
        )
    )
    return int(total or 0)


def _increment(db: Session, scope: str, day: dt.date, kind: UsageKind) -> None:
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    statement = insert(UsageCounter).values(scope=scope, day=day, kind=kind.value, count=1)
    statement = statement.on_conflict_do_update(
        index_elements=["scope", "day", "kind"],
        set_={"count": UsageCounter.count + 1},
    )
    db.execute(statement)


def get_usage(db: Session, user: User) -> UsageSnapshot:
    now = _now()
    return UsageSnapshot(
        used=_used_today(db, _scope(user), now.date()),
        limit=user_limit(user),
        resets_at=_next_reset(now),
    )


def consume(db: Session, user: User, kind: UsageKind) -> None:
    """Count one AI call, or raise DailyLimitReached. Call this right before asking a model."""
    now = _now()
    day, resets_at = now.date(), _next_reset(now)
    if _used_today(db, _scope(user), day) >= user_limit(user):
        raise DailyLimitReached("account", resets_at)
    if _used_today(db, "global", day) >= get_settings().ai_daily_cap_global:
        raise DailyLimitReached("global", resets_at)
    _increment(db, _scope(user), day, kind)
    _increment(db, "global", day, kind)
    db.commit()
