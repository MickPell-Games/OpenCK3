from fastapi import FastAPI
from .api.routes import router as api_router
from .core.config import get_settings

settings = get_settings()

app = FastAPI(title="OpenCK3 Backend", openapi_url=f"{settings.api_base_path}/openapi.json")
app.include_router(api_router, prefix=settings.api_base_path)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
