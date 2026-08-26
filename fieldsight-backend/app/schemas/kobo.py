"""KoboToolbox connection request and response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class KoboConnectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    server_url: HttpUrl
    api_token: str = Field(min_length=20, max_length=1024)


class KoboConnectionRead(BaseModel):
    id: UUID
    name: str
    server_url: str
    is_verified: bool
    verified_at: datetime | None
    created_at: datetime
