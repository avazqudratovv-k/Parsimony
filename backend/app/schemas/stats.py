import datetime as dt
from decimal import Decimal

from pydantic import BaseModel


class CategoryTotal(BaseModel):
    category: str
    total: Decimal
    count: int


class CurrencyTotal(BaseModel):
    currency: str
    total: Decimal
    count: int


class MonthlyStats(BaseModel):
    month: str  # YYYY-MM
    currency: str  # the currency the numbers below are in
    total: Decimal
    count: int
    by_category: list[CategoryTotal]  # biggest first
    currencies: list[CurrencyTotal]  # every currency used this month, for the currency tabs


class UsageStatus(BaseModel):
    used: int
    limit: int
    resets_at: dt.datetime
