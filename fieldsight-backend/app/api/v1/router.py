"""Versioned API router."""

from fastapi import APIRouter

from app.routes.administration import router as administration_router
from app.routes.auth import router as auth_router
from app.routes.collection import router as collection_router
from app.routes.health import router as health_router
from app.routes.indicators import router as indicators_router
from app.routes.intelligence import router as intelligence_router
from app.routes.kobo import router as kobo_router
from app.routes.onboarding import router as onboarding_router
from app.routes.organizations import enumerator_router
from app.routes.organizations import router as organizations_router
from app.routes.sectors import router as sectors_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["system"])
api_router.include_router(auth_router, tags=["authentication"])
api_router.include_router(sectors_router, tags=["sectors"])
api_router.include_router(administration_router, tags=["platform administration"])
api_router.include_router(onboarding_router, tags=["authentication"])
api_router.include_router(organizations_router)
api_router.include_router(enumerator_router)
api_router.include_router(kobo_router)
api_router.include_router(collection_router)
api_router.include_router(intelligence_router)
api_router.include_router(indicators_router)
