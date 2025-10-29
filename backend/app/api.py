"""HTTP API for OpenCK3 backend."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from . import storage
from .build import BuildManager, BuildService

app = FastAPI(title="OpenCK3 Backend")

build_manager = BuildManager(BuildService())


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------

def _persist_upload(temp_path: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path.replace(destination)


def _parse_metadata(raw_metadata: Optional[str]) -> Dict[str, object]:
    if not raw_metadata:
        return {}
    try:
        data = json.loads(raw_metadata)
    except json.JSONDecodeError as exc:  # noqa: F841
        raise HTTPException(status_code=400, detail="Invalid metadata payload") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Metadata must be an object")
    return data


# --------------------------------------------------------------------------------------
# Asset upload endpoints
# --------------------------------------------------------------------------------------

@app.post("/assets/dds")
async def upload_dds(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),
) -> Dict[str, object]:
    """Upload a texture asset for later conversion."""

    allowed_extensions = {".dds", ".png", ".tga", ".jpg", ".jpeg"}
    extension = Path(file.filename).suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=415, detail="Unsupported texture format")

    meta_payload = _parse_metadata(metadata)
    if "usage" not in meta_payload:
        raise HTTPException(status_code=422, detail="Texture metadata must include a 'usage' field")

    with tempfile.NamedTemporaryFile(prefix="openck3-dds-", suffix=extension, delete=False) as temp_file:
        temp_file.write(await file.read())
        temp_path = Path(temp_file.name)

    try:
        destination_dir = storage.asset_dir(storage.DDS_ROOT, project_id)
        destination = destination_dir / file.filename
        _persist_upload(temp_path, destination)
        storage.save_metadata(destination.with_suffix(destination.suffix + storage.METADATA_EXTENSION), meta_payload)
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)

    record = storage.AssetRecord(
        project_id=project_id,
        filename=file.filename,
        kind="dds",
        metadata=meta_payload,
    )
    return {"status": "ok", "asset": record.to_dict()}


@app.post("/assets/audio")
async def upload_audio(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),
) -> Dict[str, object]:
    """Upload an audio track for packaging."""

    allowed_extensions = {".ogg", ".wav"}
    extension = Path(file.filename).suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=415, detail="Unsupported audio format")

    meta_payload = _parse_metadata(metadata)
    for required in ("title", "composer"):
        if required not in meta_payload:
            raise HTTPException(status_code=422, detail=f"Audio metadata must include '{required}'")

    with tempfile.NamedTemporaryFile(prefix="openck3-audio-", suffix=extension, delete=False) as temp_file:
        temp_file.write(await file.read())
        temp_path = Path(temp_file.name)

    try:
        destination_dir = storage.asset_dir(storage.AUDIO_ROOT, project_id)
        destination = destination_dir / file.filename
        _persist_upload(temp_path, destination)
        storage.save_metadata(destination.with_suffix(destination.suffix + storage.METADATA_EXTENSION), meta_payload)
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)

    record = storage.AssetRecord(
        project_id=project_id,
        filename=file.filename,
        kind="audio",
        metadata=meta_payload,
    )
    return {"status": "ok", "asset": record.to_dict()}


# --------------------------------------------------------------------------------------
# Build endpoints
# --------------------------------------------------------------------------------------

@app.post("/builds/{project_id}")
def trigger_build(project_id: str) -> Dict[str, object]:
    """Start a new build for *project_id*."""

    job = build_manager.start_build(project_id)
    return {"status": "queued", "job": job.to_dict()}


@app.get("/builds")
def list_builds() -> Dict[str, object]:
    jobs = [job.to_dict() for job in build_manager.list_jobs()]
    return {"jobs": jobs}


@app.get("/builds/{job_id}")
def get_build(job_id: str) -> Dict[str, object]:
    job = build_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Build not found")
    return job.to_dict()


@app.get("/builds/{job_id}/download")
def download_build(job_id: str) -> FileResponse:
    job = build_manager.get_job(job_id)
    if not job or job.status != "completed" or not job.artifact_path:
        raise HTTPException(status_code=404, detail="Build artifact unavailable")
    return FileResponse(job.artifact_path, filename=job.artifact_path.name)


@app.post("/workshop/upload")
def upload_to_workshop(job_id: str = Form(...), visibility: str = Form("private")) -> Dict[str, object]:
    """Simulate uploading a build to the Steam Workshop by copying the artifact."""

    job = build_manager.get_job(job_id)
    if not job or job.status != "completed" or not job.artifact_path:
        raise HTTPException(status_code=404, detail="Completed build required for Workshop upload")

    destination_dir = storage.WORKSHOP_ROOT
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / job.artifact_path.name
    shutil.copy2(job.artifact_path, destination)
    return {
        "status": "uploaded",
        "job_id": job_id,
        "visibility": visibility,
        "path": str(destination),
    }
