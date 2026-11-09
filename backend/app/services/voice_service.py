from app.ai.base import AudioTranscriber
from app.models import User
from app.models.enums import UsageKind
from app.services import usage_service

MAX_TRANSCRIPT_CHARS = 500  # same limit as a typed entry


class NoSpeech(Exception):
    """The clip held no words the model could write down."""


def transcribe(db, user: User, transcriber: AudioTranscriber, audio: bytes, mime: str) -> str:
    """Voice clip -> transcript. Costs one smart add; nothing is saved (the user confirms first)."""
    usage_service.consume(db, user, UsageKind.AUDIO)
    text = transcriber.transcribe(audio, mime).text.strip()
    if not text:
        raise NoSpeech
    return text[:MAX_TRANSCRIPT_CHARS]
