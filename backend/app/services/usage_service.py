"""Daily caps on AI calls: one per account and one for the whole app, in two separate pools.

"Smart adds" (photo, voice) are the visible pool the person sees ("12 of 30 left today").
Typed lines are free in the app but have their own hidden fair-use pool, so typing never
uses up a smart add.

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

SMART_KINDS = (UsageKind.VISION, UsageKind.AUDIO)
TYPED_KINDS = (UsageKind.TEXT,)


class DailyLimitReached(Exception):
    def __init__(
        self,
        which: Literal["account", "global"],
        resets_at: dt.datetime,
        pool: Literal["smart", "typed"] = "smart",
    ) -> None:
        super().__init__(which)
        self.which = which
        self.resets_at = resets_at
        self.pool = pool


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
    """The visible limit: smart adds per day."""
    settings = get_settings()
    return settings.ai_daily_cap_demo if user.is_demo else settings.ai_daily_cap_user


def _text_limit(user: User) -> int:
    settings = get_settings()
    return settings.text_daily_cap_demo if user.is_demo else settings.text_daily_cap_user


def _used_today(db: Session, scope: str, day: dt.date, kinds: tuple[UsageKind, ...]) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(UsageCounter.count), 0)).where(
            UsageCounter.scope == scope,
            UsageCounter.day == day,
            UsageCounter.kind.in_([k.value for k in kinds]),
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
        used=_used_today(db, _scope(user), now.date(), SMART_KINDS),
        limit=user_limit(user),
        resets_at=_next_reset(now),
    )


def consume(db: Session, user: User, kind: UsageKind) -> None:
    """Count one AI call, or raise DailyLimitReached. Call this right before asking a model."""
    now = _now()
    day, resets_at = now.date(), _next_reset(now)
    settings = get_settings()
    if kind in SMART_KINDS:
        pool, kinds = "smart", SMART_KINDS
        account_limit, global_limit = user_limit(user), settings.ai_daily_cap_global
    else:
        pool, kinds = "typed", TYPED_KINDS
        account_limit, global_limit = _text_limit(user), settings.text_daily_cap_global
    if _used_today(db, _scope(user), day, kinds) >= account_limit:
        raise DailyLimitReached("account", resets_at, pool)
    if _used_today(db, "global", day, kinds) >= global_limit:
        raise DailyLimitReached("global", resets_at, pool)
    _increment(db, _scope(user), day, kind)
    _increment(db, "global", day, kind)
    db.commit()
