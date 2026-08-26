"""Validated application configuration."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration loaded from environment variables and an optional `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="FIELDSIGHT_", extra="ignore")

    app_name: str = "FieldSight API"
    environment: str = "development"
    database_url: str = "sqlite:///./fieldsight.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    jwt_issuer: str = "fieldsight-api"
    jwt_audience: str = "fieldsight-web"
    jwt_secret: str = Field(min_length=32, default="development-only-change-this-secret-before-phase-2")
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    invitation_days: int = 7
    upload_base_url: str = "http://localhost:8000/local-uploads"
    kobo_token_encryption_key: str | None = None

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local", "test"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cache settings once per process; tests can clear this cache when overriding env."""
    return Settings()
