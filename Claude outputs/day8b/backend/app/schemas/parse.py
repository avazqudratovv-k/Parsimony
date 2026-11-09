from pydantic import BaseModel, Field, field_validator

from app.models.enums import PaymentMethod
from app.schemas.common import validate_timezone
from app.schemas.entry import EntryCreate


class ParsedEntry(EntryCreate):
    """The JSON the model must produce for one expense. Validated before anything is saved."""

    payment_method: PaymentMethod  # the model must state it ("unknown" if not mentioned)
    confidence: float = Field(ge=0, le=1)


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

    _check_timezone = field_validator("timezone")(validate_timezone)


class ParseTextResponse(BaseModel):
    entry: ParsedEntry
    model_used: str
