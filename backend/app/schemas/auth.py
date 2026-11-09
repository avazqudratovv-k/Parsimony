import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import validate_timezone


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    timezone: str | None = None  # the browser's timezone, so "yesterday" means the user's yesterday

    _check_timezone = field_validator("timezone")(validate_timezone)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class DemoRequest(BaseModel):
    timezone: str | None = None

    _check_timezone = field_validator("timezone")(validate_timezone)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    is_demo: bool
    default_currency: str
    timezone: str
    expires_at: dt.datetime | None


class UserUpdate(BaseModel):
    """My page edits. Leave a field out to keep it as it is."""

    default_currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    timezone: str | None = None

    _check_timezone = field_validator("timezone")(validate_timezone)

    @field_validator("default_currency")
    @classmethod
    def _upper(cls, value: str | None) -> str | None:
        return value.upper() if value else value
