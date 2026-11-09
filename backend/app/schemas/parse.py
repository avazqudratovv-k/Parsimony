import datetime as dt
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

from app.models.enums import Category, PaymentMethod


class ParsedEntry(BaseModel):
    """The JSON the model must produce for one expense. Validated before anything is saved."""

    date: dt.date
    merchant: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    category: Category
    payment_method: PaymentMethod
    confidence: float = Field(ge=0, le=1)

    @field_validator("amount", mode="before")
    @classmethod
    def _round_amount(cls, value):
        if isinstance(value, bool):
            raise ValueError("amount must be a number")
        try:
            return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except InvalidOperation:
            raise ValueError("amount must be a number") from None

    @field_validator("currency", mode="before")
    @classmethod
    def _normalize_currency(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("merchant", "note", mode="before")
    @classmethod
    def _blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class ParseTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    # IANA name such as "Asia/Seoul". Falls back to the user's saved timezone.
    timezone: str | None = None

    @field_validator("text")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text must not be empty")
        return value

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("unknown timezone") from None
        return value


class ParseTextResponse(BaseModel):
    entry: ParsedEntry
    model_used: str
