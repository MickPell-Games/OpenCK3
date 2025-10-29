"""Build service for packaging CK3 mods."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional

from . import storage

ProgressCallback = Callable[[str, float, str], None]


class BuildError(RuntimeError):
    """Raised when a build fails."""


@dataclass
class BuildJob:
    """Represents a build job tracked by the API."""

    id: str
    project_id: str
    status: str = "queued"
    progress: float = 0.0
    message: str = "Queued"
    artifact_path: Optional[Path] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "artifact_path": str(self.artifact_path) if self.artifact_path else None,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class BuildService:
    """Service responsible for producing CK3 compatible archives."""

    def __init__(self) -> None:
        storage.ensure_storage_layout()
        self._converter = self._detect_converter()
        self.build_root = storage.BASE_STORAGE / "builds"
        self.build_root.mkdir(parents=True, exist_ok=True)

    # ----------------------------------------------------------------------------------
    # Build entrypoint
    # ----------------------------------------------------------------------------------
    def build_mod(self, project_id: str, callback: Optional[ProgressCallback] = None) -> Path:
        """Create a CK3 compatible zip for *project_id*.

        :param project_id: Identifier for the project to build.
        :param callback: Optional callable receiving (step, ratio, message).
        :returns: Path to the resulting archive.
        """

        steps: List[Callable[[str, Path, Optional[ProgressCallback]], None]] = [
            self._collect_project_files,
            self._convert_dds_assets,
            self._package_audio_tracks,
            self._write_descriptor,
        ]

        with tempfile.TemporaryDirectory(prefix=f"openck3-{project_id}-") as tmp:
            work_dir = Path(tmp) / "mod"
            work_dir.mkdir(parents=True, exist_ok=True)

            span = 1 / (len(steps) + 1)
            for index, step in enumerate(steps, start=1):
                step_name = step.__name__.removeprefix("_")
                if callback:
                    callback(
                        step_name,
                        (index - 1) * span,
                        f"Running {step_name.replace('_', ' ')}",
                    )

                def step_callback(
                    step_label: str,
                    ratio: float,
                    message: str,
                    *,
                    _index: int = index,
                ) -> None:
                    if not callback:
                        return
                    callback(step_label, (_index - 1) * span + ratio * span, message)

                step(project_id, work_dir, step_callback)

            if callback:
                callback("archive", len(steps) * span, "Creating archive")
            archive_path = self._archive_build(project_id, work_dir)
            if callback:
                callback("archive", 1.0, "Build complete")
            return archive_path

    # ----------------------------------------------------------------------------------
    # Build steps
    # ----------------------------------------------------------------------------------
    def _collect_project_files(
        self,
        project_id: str,
        destination: Path,
        callback: Optional[ProgressCallback],
    ) -> None:
        project_path = storage.project_dir(project_id)
        files = list(storage.iter_project_files(project_path))
        total = len(files) or 1
        for index, file_path in enumerate(files, start=1):
            rel = file_path.relative_to(project_path)
            target = destination / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, target)
            if callback:
                callback("collect", index / total, f"Copied {rel}")

    def _convert_dds_assets(
        self,
        project_id: str,
        destination: Path,
        callback: Optional[ProgressCallback],
    ) -> None:
        source_root = storage.DDS_ROOT / project_id
        if not source_root.exists():
            return
        dds_root = destination / "gfx"
        dds_root.mkdir(parents=True, exist_ok=True)
        files = [p for p in source_root.iterdir() if p.is_file()]
        total = len(files) or 1
        for index, file_path in enumerate(files, start=1):
            out_name = file_path.stem + ".dds"
            target = dds_root / out_name
            self._convert_to_dds(file_path, target)
            if callback:
                callback("dds", index / total, f"Processed {file_path.name}")

    def _package_audio_tracks(
        self,
        project_id: str,
        destination: Path,
        callback: Optional[ProgressCallback],
    ) -> None:
        source_root = storage.AUDIO_ROOT / project_id
        if not source_root.exists():
            return
        audio_root = destination / "sound"
        audio_root.mkdir(parents=True, exist_ok=True)
        files = [p for p in source_root.iterdir() if p.is_file()]
        total = len(files) or 1
        for index, file_path in enumerate(files, start=1):
            self._validate_audio(file_path)
            target = audio_root / file_path.name
            shutil.copy2(file_path, target)
            metadata = storage.load_asset_metadata(file_path)
            if metadata:
                meta_target = audio_root / (file_path.name + storage.METADATA_EXTENSION)
                storage.save_metadata(meta_target, metadata)
            if callback:
                callback("audio", index / total, f"Packaged {file_path.name}")

    def _write_descriptor(
        self,
        project_id: str,
        destination: Path,
        callback: Optional[ProgressCallback],
    ) -> None:
        project_path = storage.project_dir(project_id)
        descriptor_path = destination / "descriptor.mod"
        metadata_file = project_path / "project.json"
        metadata: Dict[str, object] = {}
        if metadata_file.exists():
            with metadata_file.open("r", encoding="utf-8") as stream:
                metadata = json.load(stream)
        descriptor = self._render_descriptor(project_id, metadata)
        descriptor_path.write_text(descriptor, encoding="utf-8")
        if callback:
            callback("descriptor", 1.0, "Descriptor generated")

    # ----------------------------------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------------------------------
    def _archive_build(self, project_id: str, work_dir: Path) -> Path:
        build_name = f"{project_id}-{int(time.time())}"
        archive_base = self.build_root / build_name
        archive_base.parent.mkdir(parents=True, exist_ok=True)
        archive_file = shutil.make_archive(str(archive_base), "zip", root_dir=work_dir)
        return Path(archive_file)

    def _render_descriptor(self, project_id: str, metadata: Dict[str, object]) -> str:
        name = metadata.get("name", f"OpenCK3 {project_id}")
        version = metadata.get("version", "1.0")
        tags = metadata.get("tags", [])
        supported_version = metadata.get("supported_version", "1.11.*")
        lines = [
            f"version=\"{version}\"",
            f"name=\"{name}\"",
            f"supported_version=\"{supported_version}\"",
        ]
        if tags:
            tags_str = ",".join(str(tag) for tag in tags)
            lines.append(f"tags={{ {tags_str} }}")
        return "\n".join(lines) + "\n"

    def _validate_audio(self, file_path: Path) -> None:
        allowed_extensions = {".ogg", ".wav"}
        if file_path.suffix.lower() not in allowed_extensions:
            raise BuildError(f"Unsupported audio format: {file_path.suffix}")

    def _convert_to_dds(self, source: Path, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix.lower() == ".dds":
            shutil.copy2(source, destination)
            return
        if not self._converter:
            raise BuildError("No DDS converter (ImageMagick or texconv) available")
        command = self._build_converter_command(source, destination)
        try:
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as exc:
            raise BuildError(f"Failed to convert {source.name} to DDS: {exc.stderr.decode('utf-8', 'ignore')}") from exc

    def _build_converter_command(self, source: Path, destination: Path) -> List[str]:
        if self._converter == "texconv":
            return [
                "texconv",
                "-f",
                "BC7_UNORM",
                "-y",
                "-o",
                str(destination.parent),
                str(source),
            ]
        if self._converter in {"magick", "convert"}:
            return [self._converter, str(source), str(destination)]
        raise BuildError("Unsupported converter configured")

    def _detect_converter(self) -> Optional[str]:
        for candidate in ("magick", "convert", "texconv"):
            if shutil.which(candidate):
                return candidate
        return None


class BuildManager:
    """Tracks build jobs and executes them asynchronously."""

    def __init__(self, service: Optional[BuildService] = None) -> None:
        self.service = service or BuildService()
        self.jobs: Dict[str, BuildJob] = {}
        self._lock = threading.Lock()

    def start_build(self, project_id: str) -> BuildJob:
        job_id = str(uuid.uuid4())
        job = BuildJob(id=job_id, project_id=project_id)
        with self._lock:
            self.jobs[job_id] = job
        thread = threading.Thread(target=self._run_job, args=(job_id,), daemon=True)
        thread.start()
        return job

    def get_job(self, job_id: str) -> Optional[BuildJob]:
        with self._lock:
            return self.jobs.get(job_id)

    def list_jobs(self) -> Iterable[BuildJob]:
        with self._lock:
            return list(self.jobs.values())

    def _run_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return

        def update(step: str, ratio: float, message: str) -> None:
            with self._lock:
                job.status = "running"
                job.progress = ratio
                job.message = message
                job.updated_at = time.time()

        try:
            job.status = "running"
            job.message = "Starting build"
            archive_path = self.service.build_mod(job.project_id, callback=update)
            with self._lock:
                job.status = "completed"
                job.progress = 1.0
                job.message = "Build completed"
                job.artifact_path = archive_path
                job.updated_at = time.time()
        except Exception as exc:  # noqa: BLE001 - propagate error information
            with self._lock:
                job.status = "failed"
                job.message = str(exc)
                job.updated_at = time.time()
