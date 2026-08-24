"""Health and API status endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import Settings
from app.db.session import get_session

router = APIRouter()


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings  # type: ignore[no-any-return]


# Why: lets load balancers confirm that the API process is alive.
@router.get("/health/live", include_in_schema=False)
def live() -> dict[str, str]:
    """Return success when the process can serve HTTP traffic."""
    return {"status": "ok"}


# Why: prevents traffic from reaching an API instance whose database is unavailable.
@router.get("/health/ready", include_in_schema=False)
def ready(session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
    """Return success only when the configured database accepts a query."""
    try:
        session.exec(text("SELECT 1")).one()
    except Exception as exc:  # pragma: no cover - depends on failed external I/O
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        ) from exc
    return {"status": "ok", "database": "ready"}


# Why: gives clients a safe versioned API capability check.
@router.get("/status")
def api_status(settings: Annotated[Settings, Depends(get_app_settings)]) -> dict[str, str]:
    """Return non-sensitive API metadata for the frontend and deployments."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "api_version": "v1",
    }
