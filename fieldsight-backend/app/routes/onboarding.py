"""Onboarding-related endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db.session import get_session

router = APIRouter(prefix="/auth")
Database = Annotated[Session, Depends(get_session)]
