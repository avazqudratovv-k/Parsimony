from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Entry, User
from app.schemas.stats import CategoryTotal, CurrencyTotal, MonthlyStats, Overview
from app.services.entry_service import entry_limit, month_bounds


def monthly_stats(db: Session, user: User, month: str, currency: str | None) -> MonthlyStats:
    """Totals for one month in ONE currency (no conversion), plus the list of currencies used."""
    start, end = month_bounds(month)
    in_month = (Entry.user_id == user.id, Entry.date >= start, Entry.date < end)

    currency_rows = db.execute(
        select(Entry.currency, func.sum(Entry.amount), func.count())
        .where(*in_month)
        .group_by(Entry.currency)
        .order_by(func.sum(Entry.amount).desc())
    ).all()
    currencies = [CurrencyTotal(currency=c, total=t, count=n) for c, t, n in currency_rows]

    if currency:
        chosen = currency.upper()  # may have no entries this month: the UI then shows zeros
    elif user.default_currency in {c.currency for c in currencies} or not currencies:
        chosen = user.default_currency
    else:
        chosen = currencies[0].currency

    category_rows = db.execute(
        select(Entry.category, func.sum(Entry.amount), func.count())
        .where(*in_month, Entry.currency == chosen)
        .group_by(Entry.category)
        .order_by(func.sum(Entry.amount).desc())
    ).all()
    by_category = [CategoryTotal(category=c, total=t, count=n) for c, t, n in category_rows]

    return MonthlyStats(
        month=month,
        currency=chosen,
        total=sum((c.total for c in by_category), Decimal("0.00")),
        count=sum(c.count for c in by_category),
        by_category=by_category,
        currencies=currencies,
    )


def overview(db: Session, user: User) -> Overview:
    rows = db.execute(
        select(Entry.currency, func.sum(Entry.amount), func.count())
        .where(Entry.user_id == user.id)
        .group_by(Entry.currency)
        .order_by(func.sum(Entry.amount).desc())
    ).all()
    first = db.scalar(select(func.min(Entry.date)).where(Entry.user_id == user.id))
    return Overview(
        total_entries=sum(n for _, _, n in rows),
        entry_limit=entry_limit(user),
        first_date=first,
        totals=[CurrencyTotal(currency=c, total=t, count=n) for c, t, n in rows],
    )
