from typing import List
from fastapi import APIRouter, HTTPException
from .schemas import (
    AssetCreate,
    AssetResponse,
    BuildRequest,
    BuildResponse,
    MetadataRequest,
    MetadataResponse,
)

router = APIRouter()

# In-memory stores for prototyping
METADATA_STORE: dict[str, MetadataResponse] = {}
ASSET_STORE: dict[str, AssetResponse] = {}
BUILD_STORE: dict[str, BuildResponse] = {}


@router.get("/mods", response_model=List[MetadataResponse])
def list_mods() -> List[MetadataResponse]:
    return list(METADATA_STORE.values())


@router.post("/mods", response_model=MetadataResponse, status_code=201)
def create_or_update_metadata(payload: MetadataRequest) -> MetadataResponse:
    metadata = MetadataResponse(**payload.dict())
    METADATA_STORE[metadata.id] = metadata
    return metadata


@router.get("/mods/{mod_id}", response_model=MetadataResponse)
def get_metadata(mod_id: str) -> MetadataResponse:
    try:
        return METADATA_STORE[mod_id]
    except KeyError as exc:  # pragma: no cover - simple example
        raise HTTPException(status_code=404, detail="Mod not found") from exc


@router.post("/assets", response_model=AssetResponse, status_code=201)
def register_asset(payload: AssetCreate) -> AssetResponse:
    asset = AssetResponse(**payload.dict())
    ASSET_STORE[asset.id] = asset
    return asset


@router.get("/assets", response_model=List[AssetResponse])
def list_assets() -> List[AssetResponse]:
    return list(ASSET_STORE.values())


@router.post("/builds", response_model=BuildResponse, status_code=202)
def enqueue_build(request: BuildRequest) -> BuildResponse:
    build = BuildResponse(**request.dict())
    BUILD_STORE[build.id] = build
    return build


@router.get("/builds", response_model=List[BuildResponse])
def list_builds() -> List[BuildResponse]:
    return list(BUILD_STORE.values())
