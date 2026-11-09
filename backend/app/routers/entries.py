import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.ai.base import AdapterError, TextParser
from app.ai.registry import get_text_parser
from app.deps import CurrentUser, DbSession
from app.models.enums import UsageKind
from app.schemas.entry import EntryCreate, EntryOut, EntryUpdate
from app.schemas.parse import ParseTextRequest, ParseTextResponse
from app.services import entry_service, parse_service, usage_service

router = APIRouter(prefix="/entries", tags=["entries"])

Parser = Annotated[TextParser, Depends(get_text_parser)]
MonthParam = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
CurrencyParam = Annotated[str | None, Query(pattern=r"^[A-Za-z]{3}$")]


@contextmanager
def api_errors() -> Iterator[None]:
    """Turn AI and limit failures into clear HTTP errors."""
    try:
        yield
    except usage_service.DailyLimitReached as exc:
        who = "account" if exc.which == "account" else "global"
        message = (
            "You've used all of today's AI entries. You can still add entries manually."
            if exc.which == "account"
            else "The demo has reached its daily AI limit for everyone. Please try again tomorrow."
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            {
                "code": f"daily_limit_{who}",
                "message": message,
                "resets_at": exc.resets_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        ) from None
    except entry_service.EntryLimitReached as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "code": "entry_limit",
                "message": f"Entry limit reached ({exc.limit}). Delete some entries to add more.",
            },
        ) from None
    except parse_service.NotAnExpense:
        raise HTTPException(
            422, "I couldn't find an expense amount in that. Try e.g. 'Lunch $12 cash'."
        ) from None
    except parse_service.ParseFailed:
        raise HTTPException(422, "I couldn't read that expense. Try rephrasing it.") from None
    except AdapterError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The AI service is unavailable right now. Please try again.",
        ) from None


# Fixed paths (/parse, /manual) must be declared before /{entry_id}.


@router.post("/parse", response_model=ParseTextResponse)
def parse_entry_text(body: ParseTextRequest, user: CurrentUser, db: DbSession, parser: Parser):
    """Preview what the AI would save. Counts against the daily cap, saves nothing."""
    with api_errors():
        usage_service.consume(db, user, UsageKind.TEXT)
        ctx = parse_service.build_context(user, body.timezone)
        outcome = parse_service.parse_text(parser, body.text, ctx)
    return ParseTextResponse(entry=outcome.entry, model_used=outcome.model_used)


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_entry_from_text(
    body: ParseTextRequest, user: CurrentUser, db: DbSession, parser: Parser
):
    """Typed text -> AI -> saved entry."""
    with api_errors():
        return entry_service.create_from_text(db, user, parser, body.text, body.timezone)


@router.post("/manual", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_manual_entry(body: EntryCreate, user: CurrentUser, db: DbSession):
    """Enter an expense by hand (no AI call). The fallback when parsing fails."""
    with api_errors():
        return entry_service.create_manual(db, user, body)


@router.get("", response_model=list[EntryOut])
def list_entries(
    user: CurrentUser,
    db: DbSession,
    month: MonthParam = None,
    currency: CurrencyParam = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return entry_service.list_entries(
        db, user, month=month, currency=currency, limit=limit, offset=offset
    )


def _owned_entry(db: DbSession, user: CurrentUser, entry_id: uuid.UUID):
    entry = entry_service.get_entry(db, user, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


@router.get("/{entry_id}", response_model=EntryOut)
def get_entry(entry_id: uuid.UUID, user: CurrentUser, db: DbSession):
    return _owned_entry(db, user, entry_id)


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(entry_id: uuid.UUID, body: EntryUpdate, user: CurrentUser, db: DbSession):
    """The "Fix this" button. Only the fields you send change."""
    entry = _owned_entry(db, user, entry_id)
    return entry_service.update_entry(db, entry, body.model_dump(exclude_unset=True))


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    entry_service.delete_entry(db, _owned_entry(db, user, entry_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
