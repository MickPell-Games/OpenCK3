# OpenCK3

OpenCK3 streamlines the process of packaging Crusader Kings III mods by collecting
project files, normalising art/audio assets, and producing CK3-compatible ZIP
archives that can be staged for the Steam Workshop. The repository ships with a
FastAPI backend for asset ingestion and build orchestration together with a
React-based publishing dashboard.

## Features

- **Structured storage** – Texture and audio uploads are written to
  `storage/assets/dds/` and `storage/assets/audio/`, preserving per-project
  metadata for later builds.
- **Automated builds** – The build service converts source textures to DDS via
  ImageMagick (`magick`/`convert`) or Microsoft's `texconv`, packages validated
  audio tracks, generates a `descriptor.mod`, and emits a CK3-ready ZIP.
- **Publishing dashboard** – The frontend guides mod authors through uploading
  assets, triggering builds, monitoring progress, and staging uploads for the
  Steam Workshop.

## Requirements

- Python 3.11+
- Node.js 18+
- One of the following external texture conversion tools installed on the
  backend host and available on `$PATH`:
  - [ImageMagick](https://imagemagick.org) 7+ (`magick` or `convert` command)
  - [texconv](https://github.com/microsoft/DirectXTex/wiki/Texconv) from the
    DirectXTex suite
- Optional (for actual Steam publishing): the Steam client and the Crusader
  Kings III Workshop tools.

## Backend

The FastAPI app lives in `backend/app`. Key modules:

- `build.py` – Build service and asynchronous job manager.
- `api.py` – HTTP endpoints for asset uploads, build orchestration, and
  Workshop staging.
- `storage.py` – Helpers for maintaining the storage directory layout.

Create a virtual environment and install dependencies (FastAPI & Uvicorn):

```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn python-multipart
```

Run the API server:

```bash
uvicorn backend.app.main:app --reload
```

Uploads are stored beneath `storage/` with the following structure:

```
storage/
  assets/
    dds/<project-id>/<asset-name>
    audio/<project-id>/<track>
  builds/<project-id>-<timestamp>.zip
  projects/<project-id>/...
  workshop/<artifact>.zip
```

Texture metadata must include a `usage` field, while audio uploads require both
`title` and `composer`. Build jobs expose progress and status through the
`/builds/{job_id}` endpoint and completed archives can be downloaded from
`/builds/{job_id}/download`.

## Frontend

The publishing dashboard is implemented with Vite + React in `frontend/`.

Install dependencies and start the dev server:

```bash
cd frontend
npm install
npm run dev
```

By default the frontend expects the backend at `http://localhost:8000`. Provide
`VITE_API_BASE` in a `.env` file to customise the API origin.

The workflow component (`src/components/PublishingWorkflow.tsx`) lets authors:

1. Upload textures and audio tracks with validation.
2. Trigger builds and watch progress updates in real time.
3. Download the resulting ZIP or stage it for Steam Workshop upload.

Workshop uploads are simulated by copying the completed archive to
`storage/workshop/`. Integrating with Valve's publishing APIs requires the Steam
command line tools and adherence to Valve's Workshop terms of service.

## Licensing considerations

Ensure all uploaded textures and audio clips are cleared for redistribution.
Mods uploaded to the Steam Workshop must comply with Paradox Interactive's mod
policy and Valve's subscriber agreement. ImageMagick is distributed under the
Apache 2.0 license, while `texconv` ships under the MIT license—verify that your
usage respects these licences alongside any third-party asset restrictions.
