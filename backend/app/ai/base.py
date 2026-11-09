"""The contract every text-parsing model implements.

Services depend only on this file, so the Gemini adapter and, later, the fine-tuned local model are
interchangeable. An adapter only returns the model's raw text; validation and retry live in
services/parse_service.py so every model gets the same checks.
"""

import datetime as dt
from dataclasses import dataclass
from typing import Protocol


class AdapterError(Exception):
    """The model could not be reached or gave no answer (network, quota, timeout)."""


@dataclass(frozen=True)
class ParseContext:
    today: dt.date  # the user's local date, used to resolve "yesterday", "this morning"
    timezone: str
    default_currency: str


@dataclass(frozen=True)
class RawModelOutput:
    text: str  # JSON text exactly as the model returned it
    model: str  # identifier stored in entries.model_used


class TextParser(Protocol):
    def complete(self, text: str, ctx: ParseContext) -> RawModelOutput: ...


class ImageParser(Protocol):
    """Reads one receipt photo. Same contract as TextParser: raw JSON text back, no validation."""

    def complete_image(self, image: bytes, mime: str, ctx: ParseContext) -> RawModelOutput: ...
