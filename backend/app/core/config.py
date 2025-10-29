from functools import lru_cache
from pathlib import Path
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    api_base_path: str = Field("/api", alias="API_BASE_PATH")
    storage_path: Path = Field(Path("./data/storage"), alias="STORAGE_PATH")
    build_output_path: Path = Field(Path("./data/builds"), alias="BUILD_OUTPUT_PATH")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    settings.build_output_path.mkdir(parents=True, exist_ok=True)
    return settings
