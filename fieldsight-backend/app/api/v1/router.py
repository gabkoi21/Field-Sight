"""Versioned API router."""

from fastapi import APIRouter

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.organizations import router as organizations_router
from app.api.v1.routes.sectors import router as sectors_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["system"])
api_router.include_router(auth_router, tags=["authentication"])
api_router.include_router(sectors_router, tags=["sectors"])
api_router.include_router(organizations_router, tags=["organizations"])
