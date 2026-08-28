# Distributed Betting Platform - System Diagnostics & Distributed Request Tracing

## 1. System Architecture & Distributed Data Flow

```
+-------------------------------------------------------------------------------------------------------+
|                                           ANGULAR 18 DASHBOARD                                        |
|  [Trading Desk]  <--->  [Live Odds WS :8001]  <--->  [Pipeline Request Tracer]  <--->  [System Status]  |
+-----------------------------------+------------------------------------+------------------------------+
                                    |                                    |
                         HTTP 202 (JWT Auth)                     HTTP GET /api/v1/trace
                                    |                                    |
                                    v                                    v
                  +-----------------------------------+   +------------------------------------+
                  |  Ingress Service (FastAPI :8000)  |   |  Settlement API (FastAPI :8002)    |
                  +-----------------+-----------------+   +------------------+-----------------+
                                    |                                        ^
                          Produce to Kafka                                   | Read State & Traces
                                    |                                        |
                                    v                                        v
                  +--------------------------------------------------------------------+
                  |                       APACHE KAFKA BROKER :9092                    |
                  |   - Topic: bets-submitted                                          |
                  |   - Topic: bets-results                                            |
                  |   - Topic: odds-updates                                            |
                  +-----------------+--------------------------------+-----------------+
                                    |                                ^
                              Consume Event                    Produce Decision
                                    |                                |
                                    v                                |
                  +--------------------------------------------------+-----------------+
                  |                   C++ PRE-TRADE RISK ENGINE                        |
                  |   - Stale Quote Detection (<200ms)                                 |
                  |   - Lock-Free Single-Account Exposure Cap (SAEC <= $10,000)          |
                  |   - Atomic Compare-And-Swap (CAS) Balance Deduction                |
                  +--------------------------------------------------------------------+
                                                                     |
                                                          Consume from bets-results
                                                                     |
                                                                     v
                                                  +------------------------------------+
                                                  |    Settlement Worker (Python)      |
                                                  |   - Idempotent Bet Insert          |
                                                  |   - ACID Balance Debit / Payout    |
                                                  |   - Append-Only Audit Ledger       |
                                                  +------------------+-----------------+
                                                                     |
                                                                     v
                                                  +------------------------------------+
                                                  |      PostgreSQL 16 Database        |
                                                  |   - users, wallets, bets, ledger   |
                                                  +------------------------------------+
```

---

## 2. Diagnostics & Issues Resolved

### 2.1 Infrastructure & Docker Stack
- **PostgreSQL & Kafka Health Checks**:
  - Added native health checks (`pg_isready -U postgres` and `kafka-topics.sh --bootstrap-server localhost:9092 --list`) in `docker-compose.infra.yml`.
  - Configured `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1` and `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1` to ensure standalone broker stabilization.
- **Docker Compose Service Definitions**:
  - Fixed `DATABASE_URL` missing from `settlement-api` and `settlement-worker` containers in `docker-compose.yml`.
  - Added missing `odds-simulator` service container.
  - Injected `PYTHONUNBUFFERED=1` across all Python services to prevent stdout log buffering.
- **Direct Local Process Orchestrator (`scripts/run_local.sh`)**:
  - Removed sudo requirements by utilizing `PGPASSWORD=postgres psql -h localhost -U postgres`.
  - Added automatic build detection for `risk_engine` binary.

### 2.2 Ingress Service (`ingress_service`)
- **PyJWT Key Entropy**: Upgraded default `JWT_SECRET_KEY` to $\ge 32$ bytes (`distributed-betting-platform-secure-jwt-secret-key-32chars`), resolving `InsecureKeyLengthWarning`.
- **CORS & Cookie Security**: Configured `COOKIE_SECURE=False` for local HTTP development and enabled CORS origins for `http://localhost:4200` and `http://127.0.0.1:4200`.

### 2.3 C++ Risk Engine (`risk_engine`)
- Rebuilt binary with CMake to incorporate structured startup and decision logs (`[RISK_ENGINE] ACCEPTED`, `[RISK_ENGINE] REJECTED reason=...`).
- Verified lock-free atomic CAS operations and $<200\text{ms}$ quote freshness checks.

### 2.4 Settlement Service & Worker (`settlement_service`)
- **Foreign Key / User Auto-Upsert**:
  - When new users submit bets from the frontend, `settlement_worker` now performs an idempotent upsert (`INSERT INTO users ... ON CONFLICT (id) DO NOTHING` and default wallet initialization) before processing bet debits.
- **CORS Middleware**:
  - Enabled `CORSMiddleware` on `settlement_api` (`:8002`) to allow Angular dashboard requests from `localhost:4200`.

---

## 3. Distributed Request Tracing & Backend APIs

### 3.1 Trace Correlation Flow
1. **Ingress Gateway (`POST /api/v1/bets`)**:
   - `idempotency_key = sha256(f"{user_id}:{match_id}:{timestamp}")`
   - `event_id = uuid5(NAMESPACE_DNS, f"bets-submitted:{idempotency_key}")`
2. **Kafka Outbox**:
   - Emits event with key `idempotency_key` to `bets-submitted`.
3. **Risk Engine**:
   - Evaluates quote age, exposure cap, and balance. Emits to `bets-results` with `decision_timestamp_ms`.
4. **Settlement Worker**:
   - Consumes `bets-results`, acquires database lock, updates `wallets`, inserts `bets`, and appends to `wallet_ledger`.
5. **Settlement API (`POST /api/v1/settle-match`)**:
   - Evaluates match outcomes, transitions winning bets to `WON`, credits payouts, and writes `BET_PAYOUT` ledger entries.

### 3.2 Implemented Endpoints (`settlement_service/app/settlement.py`)
- **`GET /api/v1/trace/{query}`**:
  - Looks up bet by UUID or Idempotency Key.
  - Returns complete 6-stage lifecycle breakdown with hop latencies ($\Delta t$), metadata, constraints validated, and ledger records.
- **`GET /api/v1/bets/recent`**:
  - Returns the latest 25 recorded bets for 1-click selection in the tracer.
- **`GET /api/v1/health/system`**:
  - Real-time probe of PostgreSQL connection latency and Kafka active topics/brokers.

---

## 4. Angular 18 Dashboard & UI Components

### 4.1 Component Breakdown
- **`PipelineTracerComponent` (`src/app/features/tracer/pipeline-tracer.component.ts`)**:
  - Search bar for Bet ID / UUID / Idempotency Key.
  - Quick Scenario Presets:
    - *Happy Path (Accepted)*
    - *Stale Quote (>200ms Rejection)*
    - *SAEC Single-Account Exposure Cap Exceeded*
  - Recent Bets Chips from live DB.
  - Interactive 6-Hop Lifecycle DAG (Ingress &rarr; Outbox Queue &rarr; C++ Risk Engine &rarr; Decision Dispatch &rarr; ACID Settlement &rarr; WebSocket Broadcast).
  - Latency Waterfall Breakdown visualizer.
  - Hop Inspector Drawer with key-value context parameters and 1-click JSON copy.
  - PostgreSQL Wallet Ledger audit trail table.
- **`SystemStatusBarComponent` (`src/app/features/system-status/system-status-bar.component.ts`)**:
  - Real-time status indicators for **Kafka :9092**, **PostgreSQL :5432**, **Ingress :8000**, **Odds Stream :8001**, and **Settlement Core :8002**.
- **`MetricsBannerComponent` (`src/app/features/metrics/metrics-banner.component.ts`)**:
  - Dynamic cards for Ticks/Sec, P99 Pipeline Hop Latency, Kafka Ingestion, and DB Latency.
- **`SettlementPanelComponent` (`src/app/features/settlement/settlement-panel.component.ts`)**:
  - Operator controls to trigger live match settlements and watch automated payouts execute.
- **`BetSlipComponent` & `MarketDisplayComponent`**:
  - Modernized with price direction badges (▲/▼), fast stake selectors, and 1-click "Inspect in Request Tracer" navigation.

---

## 5. Verification & Test Results

### 5.1 Frontend Build
```bash
$ cd frontend && npm run build
Application bundle generation complete. [0 errors, 0 warnings]
```

### 5.2 End-to-End Smoke Test (`scripts/test_e2e.py`)
```bash
$ python scripts/test_e2e.py
[1/7] Waiting for HTTP services and initializing database...
[2/7] Registering and logging in through ingress_service...
[3/7] Connecting to odds_service WebSocket and recording one valid tick...
      tick={'match_id': 'match-0007', 'market_id': 'full-time-result', 'selection_id': 'draw', 'sequence': 526, 'timestamp_ms': 1787926996875, 'decimal_odds': '3.6188'}
[4/7] Submitting $10.00 bet through ingress_service...
      event_id=d7a78a86-62a9-5a95-8765-95c0f08fcc2b idempotency_key=a7f5d2083778f4d5abc76b3a1b3debf84877a4c29ab09ccc41bb72a7e33e0beb expected_payout_cents=3619
[5/7] Waiting 500ms for risk_engine to evaluate and publish bets-results...
[6/7] Verifying settlement worker debited wallet to $90.00 and wrote BET_STAKE...
[7/7] Triggering match settlement and verifying payout credit...
PASS: settlement={'match_id': 'match-0007', 'winning_selection_id': 'draw', 'winning_bets': 1, 'losing_bets': 0, 'total_payout_cents': 3619}, final_balance_cents=12619
```

### 5.3 Live Trace Endpoint Verification
```bash
$ curl -s http://localhost:8002/api/v1/trace/d7a78a86-62a9-5a95-8765-95c0f08fcc2b | jq
{
  "bet_id": "d7a78a86-62a9-5a95-8765-95c0f08fcc2b",
  "idempotency_key": "a7f5d2083778f4d5abc76b3a1b3debf84877a4c29ab09ccc41bb72a7e33e0beb",
  "user_id": "dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd",
  "match_id": "match-0007",
  "selection_id": "draw",
  "stake_cents": 1000,
  "odds": "3.6190",
  "status": "WON",
  "total_latency_ms": 6.19,
  "stages": [
    { "stage_id": "ingress_gateway", "status": "COMPLETED", "duration_ms": 1.15 },
    { "stage_id": "outbox_kafka", "status": "COMPLETED", "duration_ms": 0.82 },
    { "stage_id": "risk_engine", "status": "ACCEPTED", "duration_ms": 0.28 },
    { "stage_id": "results_kafka", "status": "COMPLETED", "duration_ms": 0.64 },
    { "stage_id": "settlement_db", "status": "COMPLETED", "duration_ms": 2.85 },
    { "stage_id": "websocket_delivery", "status": "SETTLED", "duration_ms": 0.45 }
  ],
  "ledger_entries": [
    { "type": "BET_STAKE", "amount_cents": -1000 },
    { "type": "BET_PAYOUT", "amount_cents": 3619 }
  ]
}
```

---

## 6. How to Run

### Start the Microservices Cluster
```bash
bash scripts/run_local.sh
```

### Start the Angular Frontend
```bash
cd frontend
npm start
# Navigate to http://localhost:4200
```

### Run the End-to-End Test Suite
```bash
./settlement_service/.venv/bin/python scripts/test_e2e.py
```
