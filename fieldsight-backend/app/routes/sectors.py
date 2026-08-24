"""Platform sector catalog."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.identity import Sector, User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/sectors")


# Why: supplies the active sector catalog when configuring an organization or project.
@router.get("")
def list_sectors(_: User = Depends(get_current_user), db: Session = Depends(get_session)) -> list[Sector]:
    return list(db.exec(select(Sector).where(Sector.is_active).order_by(Sector.name)))
