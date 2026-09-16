from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration sourced from environment variables.

    Security defaults are safe for local development only. Production deployments
    must inject a high-entropy JWT_SECRET_KEY and should keep COOKIE_SECURE=true.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ingress-service"
    jwt_secret_key: str = Field(
        default="distributed-betting-platform-secret-key-high-entropy-32bytes",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    auth_cookie_name: str = Field(default="access_token", alias="AUTH_COOKIE_NAME")
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: str = Field(default="lax", alias="COOKIE_SAMESITE")
    cookie_domain: str | None = Field(default=None, alias="COOKIE_DOMAIN")

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/betting_db",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    at_username: str = Field(default="sandbox", alias="AT_USERNAME")
    at_api_key: str = Field(default="", alias="AT_API_KEY")
    at_sender_id: str | None = Field(default=None, alias="AT_SENDER_ID")

    kafka_bootstrap_servers: str = Field(default="localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    bets_submitted_topic: str = Field(default="bets-submitted", alias="BETS_SUBMITTED_TOPIC")
    cors_allow_origins: str = Field(default="http://localhost:4200,http://127.0.0.1:4200,http://127.0.0.1:62880,http://localhost:62880,http://127.0.0.1:5173,http://localhost:5173", alias="CORS_ALLOW_ORIGINS")


# Alias for documentation and service imports that refer to "Config".
Config = Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()
