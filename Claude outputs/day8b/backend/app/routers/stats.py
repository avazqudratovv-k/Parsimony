import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.stats import MonthlyStats, Overview, UsageStatus
from app.services import parse_service, stats_service, usage_service

router = APIRouter(tags=["stats"])


@router.get("/stats/monthly", response_model=MonthlyStats)
def monthly(
    user: CurrentUser,
    db: DbSession,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")] = None,
    currency: Annotated[str | None, Query(pattern=r"^[A-Za-z]{3}$")] = None,
):
    """Spending by category for one month in one currency (default: the current month)."""
    if month is None:
        today: dt.date = parse_service.build_context(user).today
        month = today.strftime("%Y-%m")
    return stats_service.monthly_stats(db, user, month, currency)


@router.get("/stats/overview", response_model=Overview)
def overview(user: CurrentUser, db: DbSession):
    """All-time numbers for the My page screen."""
    return stats_service.overview(db, user)


@router.get("/usage", response_model=UsageStatus)
def usage(user: CurrentUser, db: DbSession):
    """How many AI entries the user has used today, for the "12/30 today" indicator."""
    snapshot = usage_service.get_usage(db, user)
    return UsageStatus(used=snapshot.used, limit=snapshot.limit, resets_at=snapshot.resets_at)
