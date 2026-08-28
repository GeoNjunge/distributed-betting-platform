from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed service configuration."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/betting",
        alias="DATABASE_URL",
    )
    kafka_bootstrap_servers: str = Field(default="localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    bets_results_topic: str = Field(default="bets-results", alias="BETS_RESULTS_TOPIC")
    kafka_consumer_group: str = Field(default="settlement-service-v1", alias="KAFKA_CONSUMER_GROUP")
    app_name: str = Field(default="settlement-service", alias="APP_NAME")


@lru_cache
def get_settings() -> Settings:
    return Settings()
