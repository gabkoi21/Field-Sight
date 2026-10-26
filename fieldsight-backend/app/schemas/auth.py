"""Authentication request and response schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    remember: bool = False
    login: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    remember: bool = False
    token_type: str = "bearer"
