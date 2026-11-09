import re
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import Category, PaymentMethod
from app.schemas.common import validate_timezone
from app.schemas.entry import EntryCreate, NormalizedFields

_DOMAIN = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")


def clean_domain(value: object) -> str | None:
    """A bare website like "gs25.com", or None. Never raises: a bad guess means no logo."""
    if not isinstance(value, str):
        return None
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    host = host.removeprefix("www.").split("/")[0]
    return host if len(host) <= 100 and _DOMAIN.match(host) else None


class ParsedItem(NormalizedFields):
    """One item of a mixed purchase, e.g. milk (groceries) and shampoo (shopping)."""

    note: str | None = Field(default=None, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    category: Category


class ParsedEntry(EntryCreate):
    """The JSON the model must produce for one expense. Validated before anything is saved."""

    # The merchant's website, only asked of the model when logos are switched on.
    merchant_domain: str | None = None
    # Only filled when one purchase clearly has several items with their own amounts and categories.
    items: list[ParsedItem] = Field(default_factory=list, max_length=12)

    payment_method: PaymentMethod  # the model must state it ("unknown" if not mentioned)
    confidence: float = Field(ge=0, le=1)

    @field_validator("merchant_domain", mode="before")
    @classmethod
    def _clean_domain(cls, value):
        return clean_domain(value)


class ParseTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    # IANA name such as "Asia/Seoul". Falls back to the user's saved timezone.
    timezone: str | None = None
    # "voice" when the text came from a confirmed transcript. Only a label for the list.
    source: Literal["text", "voice"] = "text"

    @field_validator("text")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text must not be empty")
        return value

    _check_timezone = field_validator("timezone")(validate_timezone)


class ParseTextResponse(BaseModel):
    entry: ParsedEntry
    model_used: str


class TranscribeResponse(BaseModel):
    text: str
