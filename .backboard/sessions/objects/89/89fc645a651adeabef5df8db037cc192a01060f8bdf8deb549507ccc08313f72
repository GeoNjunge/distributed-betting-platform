from pydantic import BaseModel, Field


class BetSubmittedEvent(BaseModel):
    """Strict outbound event shape consumed by risk_engine on bets-submitted.

    Idempotency is carried both as the Kafka key and in the payload so downstream
    settlement can perform duplicate suppression after risk evaluation.
    """

    event_id: str = Field(min_length=1, max_length=128)
    bet_id: str = Field(min_length=1, max_length=128)
    account_id: str = Field(min_length=1, max_length=128)
    idempotency_key: str = Field(min_length=1, max_length=128)
    match_id: str = Field(min_length=1, max_length=128)
    market_id: str = Field(min_length=1, max_length=128)
    selection_id: str = Field(min_length=1, max_length=128)
    stake_cents: int = Field(gt=0)
    potential_payout_cents: int = Field(gt=0)
    odds: str = Field(min_length=1, max_length=32)
    bet_timestamp_ms: int = Field(gt=0)
