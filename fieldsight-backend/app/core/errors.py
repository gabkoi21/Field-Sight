"""Consistent public API error responses."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from app.core.logging import get_logger


def _error_body(request: Request, code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": details or {},
        "request_id": getattr(request.state, "request_id", None),
    }


def install_exception_handlers(app: FastAPI) -> None:
    """Install one predictable error contract for API and middleware failures."""

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Pydantic model validators may include exception objects in ctx.
        # Keep the public contract serializable without echoing submitted data.
        details = [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(request, "validation_error", "Request validation failed.", details),
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
        details = exc.detail if isinstance(exc.detail, dict) else None
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(request, "http_error", message, details),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        get_logger(__name__).exception(
            "unhandled_exception",
            extra={"request_id": getattr(request.state, "request_id", None)},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(request, "internal_error", "An unexpected error occurred."),
        )
