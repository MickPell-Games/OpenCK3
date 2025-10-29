# OpenCK3 Developer Toolkit

This repository houses the foundations for the OpenCK3 modding toolkit, including
both a modern web frontend and a FastAPI backend service.

## Project Structure

```
.
├── backend/              # FastAPI service for metadata, assets, and build pipelines
├── frontend/             # Next.js + TypeScript application
├── .env.example          # Shared environment variables for local development
├── .eslintrc.json        # Shared linting configuration
└── .prettierrc           # Shared formatting configuration
```

## Prerequisites

- Node.js 18+
- npm 9+ or pnpm/yarn (examples use npm)
- Python 3.11+
- Docker (optional, for containerised backend)

## Environment Variables

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

The frontend consumes `NEXT_PUBLIC_API_BASE_URL` for API calls, and the backend
reads `STORAGE_PATH`, `BUILD_OUTPUT_PATH`, and `API_BASE_PATH`.

## Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The development server defaults to http://localhost:3000 with routes for:

- `/dashboard` – project overview and build activity
- `/mod-editor` – metadata and script editing workspace
- `/assets` – asset upload and management
- `/publishing` – release workflow overview

Additional scripts:

- `npm run build` – create a production build
- `npm run start` – run the production build locally
- `npm run lint` – lint the codebase using ESLint

## Backend (FastAPI)

### Local development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000 with routes under `/api` for
mods, assets, and build operations.

### Docker

```bash
cd backend
docker build -t openck3-backend .
docker run --rm -it -p 8000:8000 --env-file ../.env openck3-backend
```

## Formatting & Linting

- ESLint is configured via `.eslintrc.json` and scoped to the frontend directory.
- Prettier formatting is shared across the repository with `.prettierrc`.

Run the lint command from the `frontend/` directory:

```bash
cd frontend
npm run lint
```

## Future Improvements

- Persist data via a database or object storage provider.
- Integrate authentication and role-based access control.
- Expand build orchestration with background workers.
