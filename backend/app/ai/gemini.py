import logging

from google import genai
from google.genai import types

from app.ai.base import AdapterError, ParseContext, RawModelOutput
from app.ai.prompts import (
    TRANSCRIBE_PROMPT,
    build_receipt_prompt,
    build_system_prompt,
    entry_json_schema,
)

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_MS = 20_000
IMAGE_TIMEOUT_MS = 30_000


def _log_failure(exc: Exception) -> None:
    """Say why a call failed (key, quota, bad schema, timeout) without logging the message text."""
    logger.warning(
        "Gemini request failed: %s code=%s status=%s",
        type(exc).__name__,
        getattr(exc, "code", None),
        getattr(exc, "status", None),
    )


def _generate(client: genai.Client, model: str, contents, system: str) -> RawModelOutput:
    """One Gemini call that must answer with JSON. Any failure becomes AdapterError."""
    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_json_schema=entry_json_schema(),
                temperature=0.0,
                max_output_tokens=400,
            ),
        )
    except Exception as exc:  # network, quota, timeout, bad key...
        _log_failure(exc)
        raise AdapterError("The AI service is unavailable") from exc

    if not response.text:
        raise AdapterError("The AI service returned no answer")
    return RawModelOutput(text=response.text, model=model)


class GeminiTextParser:
    def __init__(self, api_key: str, model: str) -> None:
        self._model = model
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
        )

    def complete(self, text: str, ctx: ParseContext) -> RawModelOutput:
        return _generate(self._client, self._model, text, build_system_prompt(ctx))


class GeminiImageParser:
    def __init__(self, api_key: str, model: str) -> None:
        self._model = model
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=IMAGE_TIMEOUT_MS),
        )

    def complete_image(self, image: bytes, mime: str, ctx: ParseContext) -> RawModelOutput:
        photo = types.Part.from_bytes(data=image, mime_type=mime)
        return _generate(self._client, self._model, [photo], build_receipt_prompt(ctx))


class GeminiTranscriber:
    def __init__(self, api_key: str, model: str) -> None:
        self._model = model
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=IMAGE_TIMEOUT_MS),
        )

    def transcribe(self, audio: bytes, mime: str) -> RawModelOutput:
        clip = types.Part.from_bytes(data=audio, mime_type=mime)
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=[clip],
                config=types.GenerateContentConfig(
                    system_instruction=TRANSCRIBE_PROMPT,
                    temperature=0.0,
                    max_output_tokens=300,
                ),
            )
        except Exception as exc:
            _log_failure(exc)
            raise AdapterError("The AI service is unavailable") from exc
        return RawModelOutput(text=(response.text or "").strip(), model=self._model)
