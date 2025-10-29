from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Build(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str
    notes: Optional[str] = None


class ModMetadata(BaseModel):
    id: str
    name: str
    version: str
    summary: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    compatible_game_version: Optional[str] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class Asset(BaseModel):
    id: str
    filename: str
    kind: str
    size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
