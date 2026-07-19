from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/carriercheck"
    redis_url: str = "redis://localhost:6379/0"

    apify_token: str = ""
    apify_actor_main: str = "jungle_synthesizer/fmcsa-dot-crawler"
    apify_actor_safety: str = "parseforge/fmcsa-carrier-safety-scraper"
    apify_actor_new: str = "transparent_meteorite/fmcsa-new-carrier"
    apify_webhook_secret: str = ""

    # Public URL of this API, used to build the Apify webhook callback.
    public_base_url: str = "http://localhost:8000"

    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
