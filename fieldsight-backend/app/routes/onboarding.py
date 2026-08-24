"""Invitation-acceptance endpoint for organization owners and members."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.security import hash_refresh_token, password_hasher
from app.db.session import get_session
from app.models.identity import OrganizationMembership, User
from app.models.phase3 import Invitation
from app.schemas.auth import InvitationAccept

router = APIRouter(prefix="/auth")
Database = Annotated[Session, Depends(get_session)]


# Why: converts a secure invitation into an active organization membership.
@router.post("/invitations/accept")
def accept_invitation(payload: InvitationAccept, db: Database) -> dict[str, str]:
    invitation = db.exec(select(Invitation).where(Invitation.token_hash == hash_refresh_token(payload.token))).first()
    if invitation is None or invitation.accepted_at or invitation.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation is invalid or expired.")
    user = db.exec(select(User).where(User.email == invitation.email)).first()
    if user is None:
        user = User(
            email=invitation.email,
            username=payload.username,
            password_hash=password_hasher.hash(payload.password),
        )
        db.add(user)
        db.flush()
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is inactive.")
    membership = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == invitation.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    ).first()
    if membership is None:
        db.add(
            OrganizationMembership(organization_id=invitation.organization_id, user_id=user.id, role=invitation.role)
        )
    else:
        membership.role = invitation.role
        membership.is_active = True
        db.add(membership)
    invitation.accepted_at = datetime.now(UTC)
    db.add(invitation)
    db.commit()
    return {"status": "accepted", "organization_id": str(invitation.organization_id), "role": invitation.role.value}
