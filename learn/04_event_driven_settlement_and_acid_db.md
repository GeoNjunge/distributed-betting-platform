# 04 — Event-Driven Settlement and ACID Database Design

## Goal

Build the durable financial core: consume risk decisions, debit wallets exactly once, write audit records, and settle matches.

## Stage 1: Model the Tables

Core tables:

```text
users
wallets
bets
wallet_ledger
```

Wallet constraint:

```python
CheckConstraint("balance_cents >= 0", name="ck_wallets_balance_non_negative")
```

This is a database-level invariant. Even if application code has a bug, PostgreSQL refuses a negative wallet.

## Stage 2: Use Enumerated Statuses

```python
class BetStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WON = "WON"
    LOST = "LOST"
```

Enums make invalid states harder to insert.

## Stage 3: Append-Only Ledger

```python
class LedgerType(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    BET_STAKE = "BET_STAKE"
    BET_PAYOUT = "BET_PAYOUT"
```

A wallet balance tells you current state. A ledger tells you history.

Never update old ledger rows for normal business events.

## Stage 4: Consume `bets-results`

```python
consumer = AIOKafkaConsumer(
    settings.bets_results_topic,
    bootstrap_servers=settings.kafka_bootstrap_servers,
    group_id=settings.kafka_consumer_group,
    enable_auto_commit=False,
    auto_offset_reset="earliest",
)
```

Manual commit means:

```text
process DB transaction first
then commit Kafka offset
```

If the process crashes before commit, Kafka can redeliver.

## Stage 5: Idempotency Check

```python
async def idempotency_key_exists(session: AsyncSession, idempotency_key: str) -> bool:
    existing = await session.scalar(
        select(Bet.id).where(Bet.idempotency_key == idempotency_key).limit(1)
    )
    return existing is not None
```

Application check is an optimization. The unique index is the guarantee.

```python
UniqueConstraint("idempotency_key", name="uq_bets_idempotency_key")
```

## Stage 6: Atomic Balance Debit

```python
debit_result = await session.execute(
    update(Wallet)
    .where(Wallet.user_id == event.user_id, Wallet.balance_cents >= event.stake_cents)
    .values(balance_cents=Wallet.balance_cents - event.stake_cents)
)
```

This single SQL statement is atomic.

It means:

```text
Only debit if the current balance is still sufficient at update time.
```

No read-then-write race.

Bad:

```python
wallet = await get_wallet()
if wallet.balance_cents >= stake:
    wallet.balance_cents -= stake
```

Two workers can read the same balance and both debit.

## Stage 7: Transaction Boundary

```python
async with session.begin():
    # check idempotency
    # atomic debit
    # insert bet
    # insert ledger row
```

All-or-nothing:

- wallet debit without ledger is forbidden,
- ledger without bet is forbidden,
- duplicate accepted bet is forbidden.

## Stage 8: Rejected Bets

Rejected bets do not debit wallets.

```python
Bet(
    status=BetStatus.REJECTED,
    rejection_reason=event.reason or event.reason_code,
)
```

Recording rejections is useful for audit and customer support.

## Stage 9: Match Settlement

```python
payout_cents = int((Decimal(stake_cents) * odds).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
```

For winning bets:

```python
update(Wallet)
.where(Wallet.user_id == bet.user_id)
.values(balance_cents=Wallet.balance_cents + payout_cents)
```

Then write:

```python
WalletLedger(
    amount_cents=payout_cents,
    type=LedgerType.BET_PAYOUT,
    reference_id=str(bet.id),
)
```

## Stage 10: Row Locking

```python
select(Bet)
.where(Bet.match_id == match_id, Bet.status == BetStatus.ACCEPTED)
.with_for_update(skip_locked=True)
```

This locks accepted bets selected for settlement.

`skip_locked=True` lets concurrent workers avoid blocking on rows already being settled.

## Stage 11: ACID Deep Dive

| Property | Settlement Meaning |
|---|---|
| Atomicity | Debit, bet insert, and ledger insert all happen or none happen. |
| Consistency | Constraints prevent invalid balances/statuses. |
| Isolation | Concurrent transactions cannot corrupt wallet state. |
| Durability | Committed bets and ledger rows survive process crashes. |

## Stage 12: Financial Precision Deep Dive

IEEE-754 floats are binary fractions. Decimal money is base-10.

Example issue:

```python
0.1 + 0.2 != 0.3
```

Use:

- integer cents for balances and stakes,
- `Decimal` for odds multiplication,
- explicit rounding policy.

## Build a Better One — Exercises

1. Add Alembic migrations and remove startup `create_all` from production mode.
2. Add a unique settlement ledger constraint on `(reference_id, type)` to prevent duplicate payouts.
3. Implement asynchronous `match-outcomes` Kafka consumption.
4. Add wallet reconciliation: `wallet.balance == sum(wallet_ledger.amounts)` after deposits are represented.
5. Benchmark settlement throughput with 1, 10, and 100 concurrent workers.
6. Add dead-letter handling for invalid `bets-results` messages.

