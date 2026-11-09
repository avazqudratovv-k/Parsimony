import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.config import get_settings
from app.core.rate_limit import demo_limiter, login_limiter, signup_limiter
from app.core.security import create_session_token
from app.deps import SESSION_COOKIE, CurrentUser, DbSession
from app.schemas.auth import DemoRequest, LoginRequest, SignupRequest, UserOut
from app.services import auth_service, demo_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: uuid.UUID) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user_id),
        max_age=settings.session_max_age_seconds,
        httponly=True,  # JavaScript can't read it
        samesite="lax",
        secure=settings.app_env == "production",  # HTTPS only in production
        path="/",
    )


@router.post(
    "/signup",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(signup_limiter)],
)
def signup(body: SignupRequest, response: Response, db: DbSession):
    try:
        user = auth_service.create_user(db, body.email, body.password, body.timezone)
    except auth_service.EmailAlreadyRegistered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from None
    _set_session_cookie(response, user.id)
    return user


@router.post(
    "/demo",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(demo_limiter)],
)
def start_demo(response: Response, db: DbSession, body: DemoRequest | None = None):
    """The "Try demo" button: a sandbox account with sample data that deletes itself."""
    try:
        user = demo_service.create_demo_user(db, body.timezone if body else None)
    except demo_service.DemoUnavailable:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The demo is full right now. Please try again later or sign up.",
        ) from None
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(login_limiter)])
def login(body: LoginRequest, response: Response, db: DbSession):
    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
