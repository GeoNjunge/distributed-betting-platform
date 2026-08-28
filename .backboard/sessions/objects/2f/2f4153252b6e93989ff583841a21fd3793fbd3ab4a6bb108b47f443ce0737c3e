from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class OddsTick(BaseModel):
    """Strict tick-by-tick odds update schema for the odds-updates topic."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "match_id": "match-0001",
                    "market_id": "full-time-result",
                    "selection_id": "home",
                    "sequence": 42,
                    "timestamp_ms": 1787659200000,
                    "decimal_odds": "2.14",
                }
            ]
        },
    )

    match_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    market_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    selection_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    sequence: int = Field(ge=0)
    timestamp_ms: int = Field(gt=0)
    decimal_odds: Decimal = Field(gt=Decimal("1.00"), le=Decimal("1000.00"), max_digits=8, decimal_places=4)

    @field_validator("decimal_odds")
    @classmethod
    def normalize_odds(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.0001"))
