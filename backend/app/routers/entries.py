from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.ai.base import AdapterError, TextParser
from app.ai.registry import get_text_parser
from app.deps import CurrentUser
from app.schemas.parse import ParseTextRequest, ParseTextResponse
from app.services import parse_service

router = APIRouter(prefix="/entries", tags=["entries"])

Parser = Annotated[TextParser, Depends(get_text_parser)]


@router.post("/parse", response_model=ParseTextResponse)
def parse_entry_text(body: ParseTextRequest, user: CurrentUser, parser: Parser):
    """Turn typed text into an entry preview. Saves nothing (saving comes on Day 5)."""
    ctx = parse_service.build_context(user, body.timezone)
    try:
        outcome = parse_service.parse_text(parser, body.text, ctx)
    except parse_service.NotAnExpense:
        raise HTTPException(
            422,
            "I couldn't find an expense amount in that. Try e.g. 'Lunch $12 cash'.",
        ) from None
    except parse_service.ParseFailed:
        raise HTTPException(
            422,
            "I couldn't read that expense. Try rephrasing it.",
        ) from None
    except AdapterError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The AI service is unavailable right now. Please try again.",
        ) from None
    return ParseTextResponse(entry=outcome.entry, model_used=outcome.model_used)
