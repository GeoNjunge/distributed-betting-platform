# 05 — System Integration and Benchmarking

## Goal

Wire all services together, test the full lifecycle, and learn how to measure correctness and performance under realistic failure modes.

## Stage 1: Compose the System

`docker-compose.yml` starts:

```text
kafka
postgres
risk-engine
ingress-service
odds-service
odds-simulator
settlement-api
settlement-worker
```

Start:

```bash
docker compose up --build
```

## Stage 2: Health Checks

Kafka:

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

PostgreSQL:

```bash
pg_isready -U postgres -d betting
```

HTTP:

```bash
curl http://localhost:8000/healthz
curl http://localhost:8001/healthz
curl http://localhost:8002/healthz
```

Health checks prevent consumers from starting before dependencies are ready.

## Stage 3: Seed Deterministic Test State

The E2E test seeds:

```text
user_id = uuid5(NAMESPACE_DNS, "e2e-user@example.com")
wallet.balance_cents = 10000
```

The ingress service uses the same deterministic UUID formula for local integration. This aligns JWT identity with database wallet ownership.

## Stage 4: Register and Login

The script calls:

```text
POST /register
POST /login
```

It stores the HttpOnly cookie in a Python cookie jar.

A browser cannot read HttpOnly cookies, but it can send them with credentialed requests.

## Stage 5: Capture an Odds Tick

```python
async with websockets.connect(ODDS_WS_URL) as websocket:
    raw = await websocket.recv()
    payload = json.loads(raw)
```

The test requires:

```text
match_id
selection_id
decimal_odds
```

## Stage 6: Submit a Bet

Payload:

```json
{
  "match_id": "match-0001",
  "market_id": "full-time-result",
  "selection_id": "home",
  "stake": "10.00",
  "potential_payout": "25.00",
  "timestamp": "2026-08-25T12:00:00Z"
}
```

Expected result:

```text
202 Accepted
bets-submitted Kafka event
```

## Stage 7: Risk and Settlement Chain

The chain is asynchronous:

```text
ingress -> Kafka -> risk_engine -> Kafka -> settlement_worker -> PostgreSQL
```

The E2E test waits briefly, then polls PostgreSQL until:

```text
wallet.balance_cents == 9000
BET_STAKE ledger row exists
```

Polling is better than arbitrary sleeps for real integration tests.

## Stage 8: Trigger Match Settlement

```bash
curl -X POST http://localhost:8002/api/v1/settle-match \
  -H 'Content-Type: application/json' \
  -d '{"match_id":"match-0001","winning_selection_id":"home"}'
```

Expected:

```text
wallet.balance_cents == 9000 + payout_cents
BET_PAYOUT ledger row exists
```

## Stage 9: Benchmark the Bet Path

Record timestamps:

| Timestamp | Location |
|---|---|
| `t0` | Frontend before POST |
| `t1` | Ingress received |
| `t2` | Kafka publish complete |
| `t3` | Risk decision start |
| `t4` | Risk result produced |
| `t5` | Settlement DB commit |

Compute:

```text
HTTP ingress latency = t2 - t1
risk latency = t4 - t3
end-to-end processing latency = t5 - t0
```

Report:

- P50,
- P95,
- P99,
- max.

## Stage 10: Benchmark Odds Fan-Out

Use tick timestamp:

```text
latency_ms = browser_receive_time_ms - tick.timestamp_ms
```

Run experiments:

| Experiment | What It Tests |
|---|---|
| 1 client | baseline |
| 100 clients | event loop overhead |
| 1 slow client + 99 fast clients | backpressure isolation |
| JSON parse/re-encode enabled | CPU and GC penalty |
| raw bytes relay | optimized path |

## Stage 11: Failure Testing

### Kill Risk Engine

Expected:

- `bets-submitted` messages remain in Kafka or replay.
- No settlement happens without `bets-results`.

### Kill Settlement Worker After DB Commit Before Kafka Commit

Expected:

- Kafka redelivers.
- DB unique idempotency key prevents double debit.

### Submit Duplicate Bet

Expected:

- Same deterministic idempotency key.
- Settlement drops duplicate or DB unique constraint rejects it.

### Slow WebSocket Client

Expected:

- Client queue fills.
- Slow client disconnects.
- Fast clients continue receiving ticks.

## Stage 12: Load Generation Ideas

### HTTP Bet Load

Write a script that sends N authenticated bet submissions:

```text
concurrency = 1, 10, 100, 500
```

Measure:

- response codes,
- Kafka publish latency,
- risk result latency,
- settlement commit latency.

### Kafka Load

Produce synthetic `bets-submitted` messages directly to Kafka to isolate risk engine throughput.

### Database Load

Run settlement worker against many accepted bets and measure transaction commits per second.

## Stage 13: Observability Checklist

Add metrics:

- Kafka consumer lag per group,
- risk decision duration,
- stale quote rejection count,
- SAEC rejection count,
- settlement transaction duration,
- wallet debit failures,
- WebSocket active clients,
- WebSocket dropped clients,
- odds relay queue depth.

## Build a Better One — Exercises

1. Add Prometheus metrics to every service.
2. Add OpenTelemetry traces across ingress, Kafka, risk, and settlement.
3. Run a duplicate-message chaos test and prove no double debit occurs.
4. Add a benchmark report generator that outputs Markdown tables.
5. Add pprof/py-spy/perf flamegraphs for hot services.
6. Replace Docker Compose Kafka with a three-broker cluster and test partition behavior.
7. Add CI that runs static validation plus the E2E test against Compose.

