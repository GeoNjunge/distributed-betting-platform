# 00 — Roadmap and Prerequisites

## What You Are Building

You are building a distributed betting platform from scratch:

```text
Frontend -> Ingress API -> Kafka -> C++ Risk Engine -> Kafka -> Settlement Worker -> PostgreSQL
                    ^                                      |
                    |                                      v
              Odds WebSocket <- Kafka <- Odds Simulator  Settlement API
```

The goal is not just to make it work. The goal is to understand why production financial systems are split into deterministic, auditable, low-latency pieces.

## Learning Outcomes

By the end, you should be able to explain and implement:

- low-latency C++ hot paths,
- Kafka at-least-once delivery semantics,
- idempotency keys and database uniqueness constraints,
- fixed-point financial arithmetic,
- FastAPI async request boundaries,
- WebSocket fan-out with epoll-friendly backpressure,
- ACID wallet mutation workflows,
- end-to-end benchmarking and failure testing.

## Prerequisites

### Languages

You should be comfortable with:

- Modern C++ basics: RAII, `std::unique_ptr`, `std::atomic`, `std::unordered_map`.
- Python async basics: `async def`, `await`, async context managers.
- TypeScript/Angular basics if you build the frontend.
- SQL fundamentals: transactions, constraints, indexes.

### Systems Concepts

Know the vocabulary, even if you have not mastered it yet:

| Concept | Why It Matters |
|---|---|
| CPU cache lines | Hot account state must avoid false sharing and allocator churn. |
| Atomic CAS loops | Balance checks can avoid coarse locks. |
| Kernel socket buffers | WebSocket throughput depends on kernel/user-space boundary behavior. |
| epoll | Async servers scale by waiting on many sockets without one thread per client. |
| Kafka offsets | Manual commit controls whether messages are replayed after failure. |
| ACID transactions | Wallet correctness depends on atomic debits and ledger writes. |
| Unique indexes | Idempotency must be enforced by the database, not only application memory. |

## Repository Build Order

Follow this order:

1. `risk_engine/` — pre-trade risk core in C++20.
2. `ingress_service/` — authentication, validation, idempotency, Kafka publish.
3. `odds_service/` — market simulator and WebSocket fan-out.
4. `settlement_service/` — ACID persistence and wallet mutation.
5. `docker-compose.yml` and `scripts/test_e2e.py` — integration and benchmarking.

## Stage 0: Define the Financial Invariant

Before code, write down the invariant:

```text
A user wallet must never go negative.
The same accepted bet must never debit the wallet more than once.
Every wallet mutation must have an append-only ledger row.
```

Everything else supports this.

## Stage 1: Choose Integer Money

Never store dollars as binary floating point.

Bad:

```python
stake = 0.1 + 0.2
```

Good:

```python
stake_cents = 30
```

Why: IEEE-754 cannot exactly represent many decimal fractions. A financial ledger should not depend on binary rounding artifacts.

## Stage 2: Define Event Boundaries

A bet is not immediately inserted by the HTTP API. Instead:

```text
POST /api/v1/bets -> bets-submitted -> risk decision -> bets-results -> DB transaction
```

This lets each component do one job:

- ingress validates and publishes,
- risk accepts or rejects,
- settlement mutates durable state.

## Stage 3: Learn the Failure Model

Kafka is at-least-once. That means a consumer may see the same event again.

So this is wrong:

```text
if message received:
    debit wallet
```

This is correct:

```text
if idempotency_key already exists:
    drop event
else:
    begin transaction
    debit wallet
    insert bet with unique idempotency_key
    insert ledger row
    commit
```

The unique DB index is the final defense against double spend.

## Stage 4: Understand Hot and Cold Paths

Hot path:

```text
Risk parse -> stale check -> balance CAS -> exposure map update -> produce result
```

Cold path:

```text
schema creation, service startup, README generation, debug logging
```

Optimization belongs on the hot path first.

## Stage 5: Benchmark Early

Measure:

- HTTP submission latency,
- Kafka publish latency,
- risk decision latency,
- WebSocket fan-out latency,
- settlement transaction latency,
- P50/P95/P99/P99.9 tail latency.

Averages hide production failures. Tail latency tells the truth.

## Deep Dive: Tail Latency

If one client is slow and your WebSocket broadcast loop awaits that socket, every other client waits too.

Bad:

```python
for ws in clients:
    await ws.send_text(payload)
```

Better:

```python
for client in clients:
    client.queue.put_nowait(payload)
```

Each client gets a bounded queue and independent writer task. Slow clients are dropped before they damage P99 latency.

## Build a Better One — Exercises

1. Draw the full bet lifecycle on paper, including every failure point.
2. Add one invariant for each service.
3. Write a benchmark target for every invariant.
4. Explain why idempotency must use a database unique constraint, not only an in-memory set.
5. Implement a latency histogram and report P50/P95/P99 for one service.

