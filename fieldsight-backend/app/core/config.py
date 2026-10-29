"""Validated application configuration."""

from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration loaded from environment variables and an optional `.env` file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="FIELDSIGHT_", extra="ignore", hide_input_in_errors=True
    )

    sync_poll_seconds: float = Field(default=0.1, ge=0.05, le=300)
    sync_max_attempts: int = Field(default=3, ge=1, le=10)
    sync_retry_seconds: int = Field(default=30, ge=1, le=3600)
    sync_telemetry_directory: str | None = None

    app_name: str = "FieldSight API"
    environment: str = "development"
    database_url: str = Field(
        default="sqlite:///./Database/fieldsight.db",
        validation_alias=AliasChoices("FIELDSIGHT_DATABASE_URL", "DATABASE_URL"),
    )
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    jwt_issuer: str = "fieldsight-api"
    jwt_audience: str = "fieldsight-web"
    jwt_secret: str = Field(min_length=32, default="development-only-change-this-secret-before-phase-2", repr=False)
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    invitation_days: int = 7
    upload_base_url: str = "http://localhost:8000/local-uploads"
    kobo_token_encryption_key: str | None = Field(default=None, repr=False)

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver_for_postgresql(cls, value: str) -> str:
        """Use the installed PostgreSQL driver for standard provider URLs."""
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> Settings:
        if self.is_development:
            return self
        if len(self.jwt_secret) < 64 or any(
            marker in self.jwt_secret.lower() for marker in ("development-only", "replace-with", "change-me")
        ):
            raise ValueError("Production requires a generated JWT secret of at least 64 characters.")
        try:
            if not self.kobo_token_encryption_key:
                raise ValueError
            Fernet(self.kobo_token_encryption_key.encode())
        except (ValueError, TypeError):
            raise ValueError("Production requires a valid Kobo Fernet encryption key.") from None
        for origin in self.cors_origin_list:
            parsed = urlparse(origin)
            if (
                parsed.scheme != "https" or not parsed.hostname or "*" in origin
                or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
                or parsed.hostname in {"localhost", "127.0.0.1", "::1"}
            ):
                raise ValueError("Production CORS origins must be explicit public HTTPS origins without paths.")
        return self

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
