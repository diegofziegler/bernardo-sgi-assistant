from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PORT: int = 8001
    RAG_API_URL: str = "http://localhost:8000/api/v1/chat"
    REDIS_URL: str = "redis://localhost:6379/1"
    SESSION_TTL_SECONDS: int = 86400
    ALLOWED_ORIGINS: list[str] = ["*"]
    DEFAULT_LANGUAGE: str = "es"


settings = Settings()