from functools import lru_cache
from typing import Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed service configuration."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/betting",
        alias="DATABASE_URL",
    )
    kafka_bootstrap_servers: str = Field(default="localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    bets_results_topic: str = Field(default="bets-results", alias="BETS_RESULTS_TOPIC")
    kafka_consumer_group: str = Field(default="settlement-service-v1", alias="KAFKA_CONSUMER_GROUP")
    app_name: str = Field(default="settlement-service", alias="APP_NAME")

    consumer_key: str = Field(default="", alias="CONSUMER_KEY")
    consumer_secret: str = Field(default="", alias="CONSUMER_SECRET")
    mpesa_shortcode: str = Field(default="174379", alias="MPESA_SHORTCODE")
    mpesa_passkey: str = Field(
        default="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
        alias="MPESA_PASSKEY",
    )
    mpesa_base_url: str = Field(
        default="https://sandbox.safaricom.co.ke",
        alias="MPESA_BASE_URL",
    )
    ngrok_url: str = Field(default="", alias="NGROK_URL")
    mpesa_callback_url: str = Field(default="", alias="MPESA_CALLBACK_URL")
    mpesa_transaction_type: str = Field(
        default="CustomerPayBillOnline",
        alias="MPESA_TRANSACTION_TYPE",
    )
    mpesa_oauth_token_refresh_skew_seconds: int = Field(default=60, alias="MPESA_OAUTH_REFRESH_SKEW_SECONDS")

    @field_validator("database_url", mode="before")
    @classmethod
    def ensure_asyncpg_driver(cls, value: str) -> str:
        """SQLAlchemy async engine requires the asyncpg dialect in the URL."""
        if not isinstance(value, str):
            return value
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://") :]
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value[len("postgres://") :]
        return value

    @model_validator(mode="after")
    def derive_mpesa_callback_from_ngrok(self) -> Self:
        if self.mpesa_callback_url.strip():
            object.__setattr__(
                self,
                "mpesa_callback_url",
                self.mpesa_callback_url.strip().rstrip("/"),
            )
            return self
        base = self.ngrok_url.strip().rstrip("/")
        if base:
            object.__setattr__(self, "mpesa_callback_url", f"{base}/api/v1/mpesa/callback")
        return self

    @property
    def mpesa_oauth_url(self) -> str:
        return f"{self.mpesa_base_url.rstrip('/')}/oauth/v1/generate"

    @property
    def mpesa_stk_push_url(self) -> str:
        return f"{self.mpesa_base_url.rstrip('/')}/mpesa/stkpush/v1/processrequest"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    """Clear cached settings after `.env` or ngrok URL changes."""
    get_settings.cache_clear()
    return get_settings()
