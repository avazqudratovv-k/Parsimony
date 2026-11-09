from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (and .env locally)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://parsimony:change-me-locally@db:5432/parsimony"
    secret_key: str = "change-me"
    gemini_api_key: str = ""
    gemini_text_model: str = "gemini-3.5-flash-lite"
    # Model that reads receipt photos. Empty means: use the text model (it accepts images).
    gemini_vision_model: str = ""
    # Largest receipt photo accepted. The app shrinks photos before sending, so this is generous.
    max_photo_bytes: int = 8 * 1024 * 1024
    session_max_age_seconds: int = 7 * 24 * 3600

    # "Smart adds" (receipt photo, voice) are capped per day, reset at 00:00 UTC.
    # A call can cost 2 model requests (one retry).
    ai_daily_cap_user: int = 30
    ai_daily_cap_demo: int = 10
    ai_daily_cap_global: int = 300

    # Typing is free in the app, but each typed line still asks the model, so it has a hidden
    # fair-use cap of its own. These never count against the smart adds above.
    text_daily_cap_user: int = 300
    text_daily_cap_demo: int = 50
    text_daily_cap_global: int = 1000

    # Demo accounts: deleted after demo_ttl_days; at most demo_max_active alive at once.
    demo_ttl_days: int = 7
    demo_max_active: int = 200

    # Most entries one account may hold (protects the database from abuse).
    max_entries_user: int = 1000
    max_entries_demo: int = 100

    # Multiplies the sign-up/login/demo rate limits. Keep at 1; only browser (e2e) tests raise it.
    rate_limit_scale: int = 1

    # Where uploaded files live (receipt photos, voice clips) from Day 11 on.
    upload_dir: str = "/srv/uploads"

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.app_env == "production" and self.secret_key in {"", "change-me"}:
            raise ValueError("SECRET_KEY must be set to a random value in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
