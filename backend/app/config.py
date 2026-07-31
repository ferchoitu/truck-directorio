from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/carriercheck"

    cors_origins: str = "https://www.yotruck.com,https://yotruck.com,http://localhost:3000"

    # Paddle billing. Real values come from the environment only — never commit them.
    paddle_environment: str = "sandbox"
    paddle_api_key: str = ""
    paddle_webhook_secret: str = ""
    paddle_price_id_growth: str = ""
    paddle_price_id_standard: str = ""
    paddle_price_id_pro: str = ""

    @property
    def paddle_api_base(self) -> str:
        # Paddle.js spells the live environment "production" while the REST docs
        # call it "live"; accept either so the two halves cannot drift apart.
        if self.paddle_environment.lower() in ("live", "production"):
            return "https://api.paddle.com"
        return "https://sandbox-api.paddle.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
