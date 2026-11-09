"""Checks an uploaded voice clip before it is sent to a model.

The app records in the browser and sends 16-bit WAV, which every phone can produce and the model
accepts. The first bytes decide what the file is, not the browser's content type. The clip is only
ever held in memory and is never written to disk.
"""


class UnsupportedAudio(Exception):
    """Not a WAV file."""


class AudioTooLarge(Exception):
    def __init__(self, limit: int) -> None:
        super().__init__(limit)
        self.limit = limit


class EmptyAudio(Exception):
    """The upload had no bytes."""


def check_clip(data: bytes, limit: int) -> str:
    """Return the real mime type, or raise one of the errors above."""
    if not data:
        raise EmptyAudio
    if len(data) > limit:
        raise AudioTooLarge(limit)
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    raise UnsupportedAudio
