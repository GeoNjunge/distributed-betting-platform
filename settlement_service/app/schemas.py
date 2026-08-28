from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import BetStatus


class BetResultEvent(BaseModel):
    """Canonical settlement input consumed from Kafka topic bets-results.

    The preferred producer contract includes idempotency_key, match_id,
    selection_id, stake_cents, and odds so settlement can write durable bet rows.
    Compatibility aliases allow the earlier risk_engine-only payload to be
    accepted, but such messages will fail validation unless required settlement
    fields are supplied by the platform contract.
    """

    model_config = ConfigDict(extra="allow")

    event_id: str = Field(min_length=1, max_length=128)
    bet_id: UUID
    user_id: UUID = Field(alias="account_id")
    idempotency_key: str = Field(min_length=1, max_length=128)
    match_id: str = Field(min_length=1, max_length=128)
    selection_id: str = Field(min_length=1, max_length=128)
    stake_cents: int = Field(gt=0)
    odds: Decimal = Field(gt=Decimal("1.00"), max_digits=10, decimal_places=4)
    accepted: bool
    reason_code: str = Field(min_length=1, max_length=64)
    reason: str | None = Field(default=None, max_length=1024)

    @field_validator("odds")
    @classmethod
    def normalize_odds(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.0001"))


class SettleMatchRequest(BaseModel):
    match_id: str = Field(min_length=1, max_length=128)
    winning_selection_id: str = Field(min_length=1, max_length=128)


class SettleMatchResponse(BaseModel):
    match_id: str
    winning_selection_id: str
    winning_bets: int
    losing_bets: int
    total_payout_cents: int


class BetSettlementSummary(BaseModel):
    bet_id: UUID
    status: BetStatus
    payout_cents: int = 0


class PipelineStageTrace(BaseModel):
    stage_id: str
    name: str
    service: str
    status: str
    duration_ms: float
    timestamp_iso: str
    badges: list[str] = []
    details: dict = {}


class BetTraceResponse(BaseModel):
    bet_id: str
    idempotency_key: str
    user_id: str
    match_id: str
    selection_id: str
    stake_cents: int
    odds: str
    status: str
    rejection_reason: str | None = None
    created_at: str
    total_latency_ms: float
    stages: list[PipelineStageTrace]
    ledger_entries: list[dict] = []


class RecentBetItem(BaseModel):
    bet_id: str
    idempotency_key: str
    user_id: str
    match_id: str
    selection_id: str
    stake_cents: int
    odds: str
    status: str
    rejection_reason: str | None = None
    created_at: str


class SystemHealthResponse(BaseModel):
    postgres_status: str
    postgres_latency_ms: float
    kafka_status: str
    kafka_brokers: list[str]
    active_topics: list[str]
    timestamp_iso: str
