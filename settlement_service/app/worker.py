import asyncio
import json
import signal

from aiokafka import AIOKafkaConsumer
from aiokafka.structs import TopicPartition
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Bet, BetStatus, LedgerType, User, Wallet, WalletLedger
from app.schemas import BetResultEvent


def _status_from_result(event: BetResultEvent) -> BetStatus:
    return BetStatus.ACCEPTED if event.accepted and event.reason_code == "ACCEPTED" else BetStatus.REJECTED


async def idempotency_key_exists(session: AsyncSession, idempotency_key: str) -> bool:
    existing = await session.scalar(select(Bet.id).where(Bet.idempotency_key == idempotency_key).limit(1))
    return existing is not None


async def process_bet_result_event(event: BetResultEvent, session: AsyncSession) -> bool:
    """Persist a risk result exactly once.

    Returns True when a new row was written and False when the event was a
    duplicate. The unique constraint on bets.idempotency_key is the final race
    protection if two workers see the same event concurrently.
    """

    status = _status_from_result(event)
    async with session.begin():
        if await idempotency_key_exists(session, event.idempotency_key):
            print(f"[settlement_worker] Duplicate event skipped for idempotency_key={event.idempotency_key}", flush=True)
            return False

        # Ensure user and wallet exist in Postgres so FK / balance constraints are satisfied
        await session.execute(
            pg_insert(User)
            .values(id=event.user_id, username=f"user-{str(event.user_id)[:8]}")
            .on_conflict_do_nothing(index_elements=["id"])
        )
        await session.execute(
            pg_insert(Wallet)
            .values(user_id=event.user_id, balance_cents=100_000)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )

        if status is BetStatus.ACCEPTED:
            debit_result = await session.execute(
                update(Wallet)
                .where(Wallet.user_id == event.user_id, Wallet.balance_cents >= event.stake_cents)
                .values(balance_cents=Wallet.balance_cents - event.stake_cents)
            )
            if debit_result.rowcount != 1:
                raise RuntimeError(f"insufficient wallet balance for user_id={event.user_id}")

            session.add(
                Bet(
                    id=event.bet_id,
                    user_id=event.user_id,
                    idempotency_key=event.idempotency_key,
                    match_id=event.match_id,
                    selection_id=event.selection_id,
                    stake_cents=event.stake_cents,
                    odds=event.odds,
                    status=BetStatus.ACCEPTED,
                )
            )
            session.add(
                WalletLedger(
                    user_id=event.user_id,
                    amount_cents=-event.stake_cents,
                    type=LedgerType.BET_STAKE,
                    reference_id=str(event.bet_id),
                )
            )
            print(f"[settlement_worker] Persisted ACCEPTED bet_id={event.bet_id} stake_cents={event.stake_cents}", flush=True)
        else:
            session.add(
                Bet(
                    id=event.bet_id,
                    user_id=event.user_id,
                    idempotency_key=event.idempotency_key,
                    match_id=event.match_id,
                    selection_id=event.selection_id,
                    stake_cents=event.stake_cents,
                    odds=event.odds,
                    status=BetStatus.REJECTED,
                    rejection_reason=event.reason or event.reason_code,
                )
            )
            print(f"[settlement_worker] Persisted REJECTED bet_id={event.bet_id} reason={event.reason_code}", flush=True)
    return True


async def process_raw_message(raw_value: bytes, session: AsyncSession) -> bool:
    try:
        payload = json.loads(raw_value)
        event = BetResultEvent.model_validate(payload)
        return await process_bet_result_event(event, session)
    except ValidationError as exc:
        print(f"[settlement_worker] invalid bets-results event: {exc}", flush=True)
        return False
    except IntegrityError as exc:
        await session.rollback()
        print(f"[settlement_worker] Integrity error processing event: {exc}", flush=True)
        return False


async def run_worker() -> None:
    settings = get_settings()
    print(f"[settlement_worker] Starting worker on topic={settings.bets_results_topic} brokers={settings.kafka_bootstrap_servers}", flush=True)
    consumer = AIOKafkaConsumer(
        settings.bets_results_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    print(f"[settlement_worker] Worker started and listening on topic={settings.bets_results_topic}", flush=True)
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        while not stop_event.is_set():
            batch = await consumer.getmany(timeout_ms=500, max_records=100)
            for _, messages in batch.items():
                for message in messages:
                    async with AsyncSessionLocal() as session:
                        try:
                            await process_raw_message(message.value, session)
                        except Exception as exc:
                            await session.rollback()
                            print(f"[settlement_worker] failed to process bets-results offset={message.offset}: {exc}", flush=True)
                            continue
                    topic_partition = TopicPartition(message.topic, message.partition)
                    await consumer.commit({topic_partition: message.offset + 1})
    finally:
        await consumer.stop()
        print("[settlement_worker] Worker stopped.", flush=True)


if __name__ == "__main__":
    asyncio.run(run_worker())
