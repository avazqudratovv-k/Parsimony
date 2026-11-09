from functools import lru_cache

from fastapi import HTTPException, status

from app.ai.base import ImageParser, TextParser
from app.ai.gemini import GeminiImageParser, GeminiTextParser
from app.config import get_settings


@lru_cache
def _gemini(api_key: str, model: str) -> GeminiTextParser:
    return GeminiTextParser(api_key, model)


@lru_cache
def _gemini_image(api_key: str, model: str) -> GeminiImageParser:
    return GeminiImageParser(api_key, model)


def get_text_parser() -> TextParser:
    """FastAPI dependency. Later this will also choose the fine-tuned local model."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI parsing is not configured")
    return _gemini(settings.gemini_api_key, settings.gemini_text_model)


def get_image_parser() -> ImageParser:
    """FastAPI dependency for receipt photos."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI parsing is not configured")
    model = settings.gemini_vision_model or settings.gemini_text_model
    return _gemini_image(settings.gemini_api_key, model)
