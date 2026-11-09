from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import DUMMY_HASH, hash_password, verify_password
from app.models import User


class EmailAlreadyRegistered(Exception):
    pass


def create_user(db: Session, email: str, password: str) -> User:
    user = User(email=email.lower(), password_hash=hash_password(password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise EmailAlreadyRegistered from None
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or user.password_hash is None:
        verify_password(DUMMY_HASH, password)  # keep timing similar
        return None
    return user if verify_password(user.password_hash, password) else None
