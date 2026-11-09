"""Voice: clip -> transcript, user confirms, then the typed path saves it as "voice"."""

import struct

from app.ai.base import AdapterError
from app.config import Settings
from app.routers import entries as entries_router
from tests.fakes import FakeParser, FakeTranscriber, good_json
from tests.helpers import signup, use_parser, use_transcriber


def tiny_wav() -> bytes:
    """A real, silent 0.1 s 16 kHz mono WAV, so the file starts with the genuine header."""
    samples = b"\x00\x00" * 1600
    header = b"RIFF" + struct.pack("<I", 36 + len(samples)) + b"WAVEfmt "
    header += struct.pack("<IHHIIHH", 16, 1, 1, 16000, 32000, 2, 16) + b"data"
    return header + struct.pack("<I", len(samples)) + samples


def send_clip(client, data: bytes | None = None, ctype="audio/wav"):
    return client.post(
        "/api/entries/transcribe",
        files={"file": ("clip.wav", tiny_wav() if data is None else data, ctype)},
    )


def used(client) -> int:
    return client.get("/api/usage").json()["used"]


def test_clip_becomes_a_transcript_and_costs_one_smart_add(client):
    signup(client)
    transcriber = FakeTranscriber("  taxi to Suwon station 12000 won card ")
    use_transcriber(transcriber)

    response = send_clip(client)

    assert response.status_code == 200
    assert response.json() == {"text": "taxi to Suwon station 12000 won card"}
    audio, mime = transcriber.calls[0]
    assert audio == tiny_wav() and mime == "audio/wav"
    assert used(client) == 1
    assert client.get("/api/entries").json() == []  # nothing saved until the user confirms


def test_confirmed_transcript_is_saved_with_source_voice(client):
    signup(client)
    use_parser(FakeParser(good_json(note="Taxi", category="transport")))

    response = client.post("/api/entries", json={"text": "taxi 12000 won card", "source": "voice"})

    assert response.status_code == 201
    entry = response.json()
    assert entry["source"] == "voice" and entry["raw_input"] == "taxi 12000 won card"


def test_unknown_source_is_rejected(client):
    signup(client)
    use_parser(FakeParser(good_json()))
    response = client.post("/api/entries", json={"text": "lunch 9", "source": "photo"})
    assert response.status_code == 422


def test_the_real_file_type_is_checked_not_the_label(client):
    signup(client)
    transcriber = FakeTranscriber()
    use_transcriber(transcriber)

    response = send_clip(client, data=b"definitely not audio", ctype="audio/wav")

    assert response.status_code == 415
    assert transcriber.calls == [] and used(client) == 0


def test_empty_clip_is_rejected_without_spending_a_smart_add(client):
    signup(client)
    use_transcriber(FakeTranscriber())
    response = send_clip(client, data=b"")
    assert response.status_code == 422 and used(client) == 0


def test_too_long_clip_is_rejected_without_calling_the_model(client, monkeypatch):
    monkeypatch.setattr(entries_router, "get_settings", lambda: Settings(max_audio_bytes=50))
    signup(client)
    transcriber = FakeTranscriber()
    use_transcriber(transcriber)

    response = send_clip(client)

    assert response.status_code == 413
    assert transcriber.calls == [] and used(client) == 0


def test_silence_is_a_clear_error_and_still_counts(client):
    signup(client)
    use_transcriber(FakeTranscriber("   "))
    response = send_clip(client)
    assert response.status_code == 422
    assert used(client) == 1


def test_model_down_is_a_502(client):
    signup(client)
    use_transcriber(FakeTranscriber(AdapterError("down")))
    assert send_clip(client).status_code == 502


def test_needs_login(client):
    use_transcriber(FakeTranscriber())
    assert send_clip(client).status_code == 401


def test_daily_cap_applies_to_voice(client):
    signup(client)
    use_transcriber(FakeTranscriber())
    limit = client.get("/api/usage").json()["limit"]
    for _ in range(limit):
        assert send_clip(client).status_code == 200
    response = send_clip(client)
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "daily_limit_account"
