from functools import lru_cache

from fastapi import HTTPException, status

from app.ai.base import TextParser
from app.ai.gemini import GeminiTextParser
from app.config import get_settings


@lru_cache
def _gemini(api_key: str, model: str) -> GeminiTextParser:
    return GeminiTextParser(api_key, model)


def get_text_parser() -> TextParser:
    """FastAPI dependency. Later this will also choose the fine-tuned local model."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI parsing is not configured")
    return _gemini(settings.gemini_api_key, settings.gemini_text_model)
