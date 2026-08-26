"""KoboToolbox connection request and response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class KoboConnectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    server_url: HttpUrl
    api_token: str = Field(min_length=20, max_length=1024)


class KoboFormRead(BaseModel):
    id: str
    name: str
    version: str | None = None


class KoboFormSelection(BaseModel):
    form_id: str = Field(min_length=1, max_length=255)
    form_name: str = Field(min_length=1, max_length=255)


class ProjectKoboFormSelection(BaseModel):
    connection_id: UUID
    form_id: str = Field(min_length=1, max_length=255)


class KoboConnectionRead(BaseModel):
    id: UUID
    name: str
    server_url: str
    is_verified: bool
    verified_at: datetime | None
    selected_form_id: str | None
    selected_form_name: str | None
    created_at: datetime
