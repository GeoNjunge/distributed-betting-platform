import enum
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class BetStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WON = "WON"
    LOST = "LOST"


class LedgerType(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    BET_STAKE = "BET_STAKE"
    BET_PAYOUT = "BET_PAYOUT"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    wallet: Mapped["Wallet"] = relationship(back_populates="user", uselist=False)
    bets: Mapped[list["Bet"]] = relationship(back_populates="user")
    ledger_entries: Mapped[list["WalletLedger"]] = relationship(back_populates="user")


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (CheckConstraint("balance_cents >= 0", name="ck_wallets_balance_non_negative"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    balance_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="wallet")


class Bet(Base):
    __tablename__ = "bets"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_bets_idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    match_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    selection_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    stake_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    odds: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    status: Mapped[BetStatus] = mapped_column(Enum(BetStatus, name="bet_status"), default=BetStatus.PENDING, nullable=False, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="bets")


class WalletLedger(Base):
    __tablename__ = "wallet_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    type: Mapped[LedgerType] = mapped_column(Enum(LedgerType, name="ledger_type"), nullable=False, index=True)
    reference_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="ledger_entries")
