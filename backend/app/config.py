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
    session_max_age_seconds: int = 7 * 24 * 3600

    # Daily AI-call caps, reset at 00:00 UTC. A call can cost 2 model requests (one retry).
    ai_daily_cap_user: int = 30
    ai_daily_cap_demo: int = 10
    ai_daily_cap_global: int = 300

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.app_env == "production" and self.secret_key in {"", "change-me"}:
            raise ValueError("SECRET_KEY must be set to a random value in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
