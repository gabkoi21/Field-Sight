"""Platform sector catalog."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.v1.routes.auth import get_current_user
from app.db.session import get_session
from app.models.identity import Sector, User

router = APIRouter(prefix="/sectors")


@router.get("")
def list_sectors(_: User = Depends(get_current_user), db: Session = Depends(get_session)) -> list[Sector]:
    return list(db.exec(select(Sector).where(Sector.is_active).order_by(Sector.name)))
