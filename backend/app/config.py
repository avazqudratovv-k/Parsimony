from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (and .env locally)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://parsimony:change-me-locally@db:5432/parsimony"
    secret_key: str = "change-me"
    gemini_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
