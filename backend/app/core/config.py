import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Secure File Management Platform"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://sfmp_user:sfmp_dev_password@localhost:5432/sfmp_db"

    # Redis Cache & Rate Limiter
    REDIS_URL: str = "redis://:redis_dev_password@localhost:6379/0"

    # Security & Tokens
    JWT_SECRET_KEY: str = "dev_jwt_secret_key_change_in_production_min_32_bytes_long!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False

    # Storage Vault Configuration
    STORAGE_ROOT: Path = Path("/var/lib/sfmp_vault")

    # Size Limits & Quotas
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    DEFAULT_USER_QUOTA_BYTES: int = 1024 * 1024 * 1024  # 1 GB

    # CORS
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    @field_validator("STORAGE_ROOT", mode="before")
    @classmethod
    def assemble_storage_root(cls, v: Union[str, Path]) -> Path:
        p = Path(v).expanduser()
        # An explicit environment override is always honoured (Docker mounts it).
        if os.environ.get("STORAGE_ROOT"):
            return p
        try:
            p.mkdir(parents=True, exist_ok=True)
            if not os.access(p, os.W_OK):
                raise OSError("storage root is not writable")
            return p
        except OSError:
            # Local development fallback outside the webroot.
            return Path(__file__).resolve().parents[3] / "storage_vault"


settings = Settings()
