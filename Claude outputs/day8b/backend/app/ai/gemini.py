import logging

from google import genai
from google.genai import types

from app.ai.base import AdapterError, ParseContext, RawModelOutput
from app.ai.prompts import ENTRY_JSON_SCHEMA, build_system_prompt

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_MS = 20_000


class GeminiTextParser:
    def __init__(self, api_key: str, model: str) -> None:
        self._model = model
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
        )

    def complete(self, text: str, ctx: ParseContext) -> RawModelOutput:
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=text,
                config=types.GenerateContentConfig(
                    system_instruction=build_system_prompt(ctx),
                    response_mime_type="application/json",
                    response_json_schema=ENTRY_JSON_SCHEMA,
                    temperature=0.0,
                    max_output_tokens=400,
                ),
            )
        except Exception as exc:  # network, quota, timeout, bad key...
            logger.warning("Gemini request failed: %s", type(exc).__name__)
            raise AdapterError("The AI service is unavailable") from exc

        if not response.text:
            raise AdapterError("The AI service returned no answer")
        return RawModelOutput(text=response.text, model=self._model)
