from datetime import datetime, timezone
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class BetCreateRequest(BaseModel):
    """Validated HTTP request body for POST /api/v1/bets.

    Money is accepted as Decimal and converted to cents at the boundary to avoid
    floating-point rounding errors in downstream risk/accounting services.
    """

    model_config = ConfigDict(json_schema_extra={
        "examples": [{
            "match_id": "match-2026-08-25-ars-che",
            "market_id": "full-time-result",
            "selection_id": "arsenal-win",
            "stake": "25.00",
            "potential_payout": "72.50",
            "timestamp": "2026-08-25T12:00:00Z"
        }]
    })

    match_id: str = Field(min_length=1, max_length=128)
    market_id: str = Field(min_length=1, max_length=128)
    selection_id: str = Field(min_length=1, max_length=128)
    stake: Decimal = Field(gt=Decimal("0"), max_digits=18, decimal_places=2)
    potential_payout: Decimal = Field(gt=Decimal("0"), max_digits=18, decimal_places=2)
    timestamp: datetime

    @field_validator("timestamp")
    @classmethod
    def timestamp_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include timezone information")
        return value.astimezone(timezone.utc)

    @field_validator("potential_payout")
    @classmethod
    def payout_must_cover_stake(cls, value: Decimal, info):
        stake = info.data.get("stake")
        if stake is not None and value < stake:
            raise ValueError("potential_payout must be greater than or equal to stake")
        return value


class BetAcceptedResponse(BaseModel):
    event_id: str
    idempotency_key: str
    topic: str
    status: str = "published"
