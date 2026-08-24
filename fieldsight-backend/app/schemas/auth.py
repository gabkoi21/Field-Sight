"""Authentication request and response schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    username: str | None = Field(default=None, min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=1024)
