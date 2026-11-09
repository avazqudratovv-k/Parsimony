from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import read_session_token
from app.db import get_db
from app.models import User

SESSION_COOKIE = "parsimony_session"

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    user_id = read_session_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
