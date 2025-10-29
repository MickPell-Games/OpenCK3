"""Utilities for managing persistent storage for OpenCK3."""
from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable

BASE_STORAGE = Path("storage")
ASSET_ROOT = BASE_STORAGE / "assets"
DDS_ROOT = ASSET_ROOT / "dds"
AUDIO_ROOT = ASSET_ROOT / "audio"
PROJECT_ROOT = BASE_STORAGE / "projects"
WORKSHOP_ROOT = BASE_STORAGE / "workshop"
METADATA_EXTENSION = ".json"


def ensure_storage_layout() -> None:
    """Ensure the default directory structure exists."""
    for path in (BASE_STORAGE, ASSET_ROOT, DDS_ROOT, AUDIO_ROOT, PROJECT_ROOT, WORKSHOP_ROOT):
        path.mkdir(parents=True, exist_ok=True)


def project_dir(project_id: str) -> Path:
    """Return the directory where a project's files are stored."""
    ensure_storage_layout()
    project_path = PROJECT_ROOT / project_id
    project_path.mkdir(parents=True, exist_ok=True)
    return project_path


def asset_dir(root: Path, project_id: str) -> Path:
    ensure_storage_layout()
    project_assets = root / project_id
    project_assets.mkdir(parents=True, exist_ok=True)
    return project_assets


@dataclass
class AssetRecord:
    """Represents metadata associated with an uploaded asset."""

    project_id: str
    filename: str
    kind: str
    metadata: Dict[str, object]

    def to_dict(self) -> Dict[str, object]:
        return {
            "project_id": self.project_id,
            "filename": self.filename,
            "kind": self.kind,
            "metadata": self.metadata,
        }


def load_asset_metadata(asset_path: Path) -> Dict[str, object]:
    metadata_path = asset_path.with_suffix(asset_path.suffix + METADATA_EXTENSION)
    if metadata_path.exists():
        with metadata_path.open("r", encoding="utf-8") as stream:
            return json.load(stream)
    return {}


def persist_asset(file_path: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("rb") as src, destination.open("wb") as dst:
        shutil.copyfileobj(src, dst)


def save_metadata(metadata_path: Path, payload: Dict[str, object]) -> None:
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    with metadata_path.open("w", encoding="utf-8") as stream:
        json.dump(payload, stream, indent=2, sort_keys=True)


def iter_project_files(root: Path) -> Iterable[Path]:
    if not root.exists():
        return []
    return (path for path in root.rglob("*") if path.is_file())
