"""Checks an uploaded receipt photo before it is sent to a model.

The browser's content type is not trusted: the first bytes of the file decide what it is.
The photo is only ever held in memory and is never written to disk.
"""


class UnsupportedImage(Exception):
    """Not a JPEG, PNG or WebP picture."""


class ImageTooLarge(Exception):
    def __init__(self, limit: int) -> None:
        super().__init__(limit)
        self.limit = limit


class EmptyImage(Exception):
    """The upload had no bytes."""


def detect_image_mime(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def check_photo(data: bytes, limit: int) -> str:
    """Return the real mime type, or raise one of the errors above."""
    if not data:
        raise EmptyImage
    if len(data) > limit:
        raise ImageTooLarge(limit)
    mime = detect_image_mime(data)
    if mime is None:
        raise UnsupportedImage
    return mime
