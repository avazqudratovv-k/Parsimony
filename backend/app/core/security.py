import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.config import get_settings

_hasher = PasswordHasher()
# Verified against when an email is unknown, so login takes similar time either way.
DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt="parsimony-session")


def create_session_token(user_id: uuid.UUID) -> str:
    """A signed, time-stamped token holding only the user id."""
    return _serializer().dumps(str(user_id))


def read_session_token(token: str) -> uuid.UUID | None:
    try:
        value = _serializer().loads(token, max_age=get_settings().session_max_age_seconds)
        return uuid.UUID(value)
    except (BadSignature, ValueError):
        return None
