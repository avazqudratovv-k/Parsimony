import json

from app.ai.base import ParseContext, RawModelOutput


def good_json(**overrides) -> str:
    data = {
        "date": "2026-11-09",
        "merchant": None,
        "note": "Coffee with Sam",
        "amount": 6.5,
        "currency": "USD",
        "category": "food_drink",
        "payment_method": "card",
        "confidence": 0.85,
    }
    data.update(overrides)
    return json.dumps(data)


class FakeParser:
    """Returns scripted answers in order and records how it was called."""

    def __init__(self, *answers: str | Exception) -> None:
        self._answers = list(answers)
        self.calls: list[tuple[str, ParseContext]] = []

    def complete(self, text: str, ctx: ParseContext) -> RawModelOutput:
        self.calls.append((text, ctx))
        answer = self._answers.pop(0) if len(self._answers) > 1 else self._answers[0]
        if isinstance(answer, Exception):
            raise answer
        return RawModelOutput(text=answer, model="fake-model")


class FakeImageParser:
    """Returns scripted answers for receipt photos and records how it was called."""

    def __init__(self, *answers: str | Exception) -> None:
        self._answers = list(answers)
        self.calls: list[tuple[bytes, str, ParseContext]] = []

    def complete_image(self, image: bytes, mime: str, ctx: ParseContext) -> RawModelOutput:
        self.calls.append((image, mime, ctx))
        answer = self._answers.pop(0) if len(self._answers) > 1 else self._answers[0]
        if isinstance(answer, Exception):
            raise answer
        return RawModelOutput(text=answer, model="fake-vision-model")
