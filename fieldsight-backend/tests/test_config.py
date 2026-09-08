"""Production settings must fail closed for unsafe credentials and browser origins."""

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values = {
        "environment": "production",
        "jwt_secret": "a" * 86,
        "kobo_token_encryption_key": Fernet.generate_key().decode(),
        "cors_origins": "https://app.example.org",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.mark.parametrize("overrides", [
    {"jwt_secret": "development-only-change-this-secret-before-phase-2"},
    {"kobo_token_encryption_key": None},
    {"kobo_token_encryption_key": "invalid"},
    {"cors_origins": "*"},
    {"cors_origins": "http://app.example.org"},
    {"cors_origins": "https://localhost"},
    {"cors_origins": "https://app.example.org/path"},
])
def test_production_rejects_unsafe_settings(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        production_settings(**overrides)


def test_production_encrypts_and_recovers_token_without_exposing_settings_secrets() -> None:
    from app.core.kobo import decrypt_kobo_token, encrypt_kobo_token

    settings = production_settings()
    encrypted = encrypt_kobo_token("test-api-token", settings)
    assert encrypted != "test-api-token"
    assert decrypt_kobo_token(encrypted, settings) == "test-api-token"
    assert settings.jwt_secret not in repr(settings)
    assert settings.kobo_token_encryption_key not in repr(settings)
    assert not settings.is_development


def test_empty_production_cors_disables_cross_origin_access() -> None:
    assert production_settings(cors_origins="").cors_origin_list == []


def test_standard_database_url_environment_variable_is_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FIELDSIGHT_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:password@example.org/database")

    assert Settings(_env_file=None).database_url == "postgresql+psycopg://user:password@example.org/database"
