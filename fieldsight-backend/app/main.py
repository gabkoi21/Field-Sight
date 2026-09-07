"""FastAPI application factory and HTTP middleware."""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import install_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.routes.auth import login
from app.schemas.auth import TokenResponse


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a correlation ID and write one structured log event per request."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        started_at = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        get_logger(__name__).info(
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
        return response


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the application without opening a database connection at import time."""
    active_settings = settings or get_settings()
    configure_logging(active_settings.log_level)
    app = FastAPI(
        title="FieldSight API",
        version="0.1.0",
        description="REST API for FieldSight field-data operations.",
        docs_url="/docs" if active_settings.is_development else None,
        redoc_url="/redoc" if active_settings.is_development else None,
        openapi_url="/openapi.json" if active_settings.is_development else None,
    )
    app.state.settings = active_settings
    app.dependency_overrides[get_settings] = lambda: active_settings
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    install_exception_handlers(app)
    app.add_api_route(
        "/login",
        login,
        methods=["POST"],
        response_model=TokenResponse,
        tags=["authentication"],
        name="short_login",
    )
    app.include_router(api_router)
    return app


app = create_app()
