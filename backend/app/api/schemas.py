from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MetadataRequest(BaseModel):
    id: str
    name: str
    version: str
    summary: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    compatible_game_version: Optional[str] = None


class MetadataResponse(MetadataRequest):
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class AssetCreate(BaseModel):
    id: str
    filename: str
    kind: str
    size: int


class AssetResponse(AssetCreate):
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class BuildRequest(BaseModel):
    id: str
    mod_id: str
    notes: Optional[str] = None
    status: str = "queued"


class BuildResponse(BuildRequest):
    created_at: datetime = Field(default_factory=datetime.utcnow)
