import datetime as dt
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import Category, PaymentMethod

CURRENCY_PATTERN = r"^[A-Z]{3}$"


class NormalizedFields(BaseModel):
    """Shared clean-up for amount, currency and free text, whoever supplies them (model or user)."""

    @field_validator("amount", mode="before", check_fields=False)
    @classmethod
    def _round_amount(cls, value):
        if value is None:
            return None
        if isinstance(value, bool):
            raise ValueError("amount must be a number")
        try:
            return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except InvalidOperation:
            raise ValueError("amount must be a number") from None

    @field_validator("currency", mode="before", check_fields=False)
    @classmethod
    def _normalize_currency(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("merchant", "note", mode="before", check_fields=False)
    @classmethod
    def _blank_to_none(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value


class EntryCreate(NormalizedFields):
    date: dt.date
    merchant: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(pattern=CURRENCY_PATTERN)
    category: Category
    payment_method: PaymentMethod = PaymentMethod.UNKNOWN


class EntryUpdate(NormalizedFields):
    """Partial update: only the fields sent change. merchant and note can be set to null."""

    date: dt.date | None = None
    merchant: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=500)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    category: Category | None = None
    payment_method: PaymentMethod | None = None

    @model_validator(mode="after")
    def _required_fields_cannot_be_null(self):
        for name in ("date", "amount", "currency", "category", "payment_method"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: dt.date
    merchant: str | None
    note: str | None
    amount: Decimal
    currency: str
    category: str
    payment_method: str
    source: str
    raw_input: str | None
    confidence: float
    model_used: str
    user_corrected: bool
    created_at: dt.datetime
    updated_at: dt.datetime
