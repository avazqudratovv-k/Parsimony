import datetime as dt
import json
from collections.abc import Callable
from dataclasses import dataclass
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.ai.base import ImageParser, ParseContext, RawModelOutput, TextParser
from app.models import User
from app.schemas.parse import ParsedEntry


class ParseFailed(Exception):
    """The model answered, but not with a valid entry (even after one retry)."""


class NotAnExpense(ParseFailed):
    """The model says the text has no expense amount."""


@dataclass(frozen=True)
class ParseOutcome:
    entry: ParsedEntry
    raw: dict  # exactly what the model returned; kept in entries.ai_output
    model_used: str


def build_context(user: User, timezone: str | None = None) -> ParseContext:
    name = timezone or user.timezone
    try:
        zone = ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        name, zone = "UTC", ZoneInfo("UTC")
    return ParseContext(
        today=dt.datetime.now(zone).date(),
        timezone=name,
        default_currency=user.default_currency,
    )


def _validated(
    ask: Callable[[], RawModelOutput], ctx: ParseContext, max_attempts: int
) -> ParseOutcome:
    """Ask the model, validate the answer, retry once if it was unusable.

    AdapterError (model unreachable) is not caught here; the router turns it into a 502.
    """
    last_error: Exception | None = None
    for _ in range(max_attempts):
        output = ask()
        try:
            data = json.loads(output.text)
            if not isinstance(data, dict):
                raise ValueError("model output is not a JSON object")
            if data.get("amount") == 0:
                raise NotAnExpense
            entry = ParsedEntry.model_validate(data)
            if entry.date > ctx.today:
                raise ValueError("date is in the future")
        except NotAnExpense:
            raise  # retrying would give the same answer
        except ValueError as exc:  # includes JSONDecodeError and pydantic's ValidationError
            last_error = exc
            continue
        return ParseOutcome(entry=entry, raw=data, model_used=output.model)
    raise ParseFailed("model output stayed invalid") from last_error


def parse_text(
    parser: TextParser, text: str, ctx: ParseContext, max_attempts: int = 2
) -> ParseOutcome:
    return _validated(lambda: parser.complete(text, ctx), ctx, max_attempts)


def parse_image(
    parser: ImageParser, image: bytes, mime: str, ctx: ParseContext, max_attempts: int = 2
) -> ParseOutcome:
    return _validated(lambda: parser.complete_image(image, mime, ctx), ctx, max_attempts)
