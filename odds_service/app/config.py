from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    kafka_bootstrap_servers: str = Field(default="localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    odds_updates_topic: str = Field(default="odds-updates", alias="ODDS_UPDATES_TOPIC")
    kafka_consumer_group: str = Field(default="odds-websocket-relay", alias="KAFKA_CONSUMER_GROUP")
    simulator_match_count: int = Field(default=8, alias="SIMULATOR_MATCH_COUNT")
    simulator_tick_interval_ms: int = Field(default=50, alias="SIMULATOR_TICK_INTERVAL_MS")


@lru_cache
def get_settings() -> Settings:
    return Settings()
