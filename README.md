# ApexBets — Kenyan Sports Betting Stack

An event-driven sports betting platform wired for the Kenyan market: **Safaricom M-Pesa** deposits, **Africa's Talking** SMS OTP verification, **Redis** for short-lived registration codes, **Kafka** for async bet and payment flows, and **PostgreSQL** for wallets and ledger data.

The Angular frontend streams live odds over WebSockets while bets move through a C++ risk engine before settlement.

---

## Stack at a Glance

| Layer | Technology | Role |
| --- | --- | --- |
| **Payments** | Safaricom Daraja (M-Pesa STK Push) | Wallet top-ups via SIM Toolkit PIN prompt |
| **Auth SMS** | Africa's Talking SMS API | 6-digit OTP during registration (`+254…` numbers) |
| **OTP cache** | Redis (host / WSL) | Pending registration payloads, locks, attempt limits (5 min TTL) |
| **Event bus** | Apache Kafka (KRaft) | `bets-submitted`, `bets-results`, `odds-updates` |
| **Database** | PostgreSQL 16 | Users, wallets, bets, M-Pesa transactions, ledger |
| **Ingress API** | FastAPI (`ingress_service`) | Registration, login, bet submission |
| **Risk** | C++20 risk engine | Pre-trade checks on Kafka stream |
| **Settlement** | Python worker + API | Wallet debits/credits, match settlement, M-Pesa webhooks |
| **Odds** | FastAPI WebSocket + simulator | Real-time price feed to the SPA |
| **Frontend** | Angular + Tailwind | Markets, bet slip, auth flows |

> **Redis note:** Redis is expected on the **WSL host** (`redis://localhost:6379/0`), not as a Docker image in this repo. Install and start it locally before running auth (`sudo apt install redis-server` / `systemctl start redis`).

---

## System Overview

```text
                         +----------------------+
                         |   Angular SPA        |
                         |   localhost:4200     |
                         +----------+-----------+
                                    |
            HTTP /auth, /api/v1/bets|  WebSocket odds
            localhost:8000           |  localhost:8001/ws/odds
                                    |
        +---------------------------+---------------------------+
        |                                                       |
+-------v--------+    Redis (WSL)     +-----------------------v--------+
| ingress_service|<--- OTP staging --->| odds_service + odds_simulator   |
| FastAPI :8000  |                     | WebSocket :8001                 |
+-------+--------+                     +----------------+----------------+
        |                                               ^
        | Kafka                                         | odds-updates
        v                                               |
+-------+----------------------------------------------------------------+
|                         Kafka :9092                                    |
+-------+---------------------------+--------------------------+---------+
        |                           |                          |
        v                           v                          |
+-------+--------+          +-------+-------------+            |
| risk_engine    |          | settlement_worker   |            |
| C++ / Kafka    |          | + settlement_api    |            |
+----------------+          +----------+----------+            |
                                       |                         |
                                       v                         |
                            +----------+----------+              |
                            | PostgreSQL :5432    |              |
                            | users · wallets ·   |              |
                            | bets · mpesa_txns   |              |
                            +----------+----------+              |
                                       ^                         |
                                       | STK callback (ngrok)    |
                            +----------+----------+              |
                            | Safaricom Daraja    |              |
                            | M-Pesa STK Push     |              |
                            +---------------------+              |
```

---

## User Registration (SMS OTP)

1. User submits email, **E.164 phone** (`+2547…`), and password → `POST /auth/register`.
2. Ingress hashes the password and stores a pending record in **Redis** (`registration:pending:{phone}`).
3. A 6-digit code is sent via **Africa's Talking** SMS.
4. User enters the code → `POST /auth/verify-otp`.
5. On success, the account is written to **PostgreSQL** and JWT access/refresh tokens are returned (HttpOnly cookie + JSON body).

Login uses phone + password → `POST /auth/login`.

Frontend routes: `/auth/register`, `/auth/verify-otp`, `/auth/login`, `/dashboard`.

---

## Bet & Wallet Flow

1. Authenticated user places a bet → ingress publishes to Kafka topic **`bets-submitted`**.
2. **Risk engine** evaluates exposure and balance, emits **`bets-results`**.
3. **Settlement worker** persists the bet, debits the wallet, and updates ledger rows in PostgreSQL.
4. Match settlement is triggered via the settlement API (`POST /api/v1/settle-match`).

Ingress intentionally does **not** mutate wallet state directly — everything durable goes through Kafka and settlement.

---

## M-Pesa Deposits

Wallet top-ups are handled by **`settlement_service`** (`POST /api/v1/mpesa/stk-push` → Daraja STK Push → `POST /api/v1/mpesa/callback`).

1. Client sends `user_id`, Kenyan MSISDN (`2547…` / `2541…`, no `+`), and amount in whole KES.
2. Settlement obtains a Daraja OAuth token and calls `/mpesa/stkpush/v1/processrequest`.
3. On acceptance, a row is inserted in `mpesa_transactions` with status **`PENDING`** and the `CheckoutRequestID`.
4. Safaricom shows the SIM Toolkit PIN prompt on the handset.
5. Safaricom POSTs the async result to **`/api/v1/mpesa/callback`** (expose via ngrok in dev).
6. On success (`ResultCode: 0`), the wallet is credited and a **`DEPOSIT`** ledger entry is appended.

See [docs/MPESA.md](docs/MPESA.md) for the full payment architecture and planned Kafka reconciliation flow.

### M-Pesa Failure Modes

How **`settlement_service`** behaves today when something goes wrong:

#### STK Push initiation (`POST /api/v1/mpesa/stk-push`)

| Condition | HTTP | What happens |
| --- | ---: | --- |
| `MPESA_CALLBACK_URL` not set | 503 | Request rejected before calling Safaricom |
| Missing `CONSUMER_KEY` / `CONSUMER_SECRET` | 503 | OAuth cannot run |
| Safaricom OAuth fails or returns no token | 502 | No `mpesa_transactions` row created |
| Daraja returns `ResponseCode != 0` or no `CheckoutRequestID` | 502 | STK rejected; no pending transaction stored |
| Daraja HTTP error / network timeout (30s) | 502 | Logged upstream failure; client should retry |
| Expired OAuth token on STK call | — | Token refreshed automatically and STK retried once |

#### Async callback (`POST /api/v1/mpesa/callback`)

The handler always aims to reply quickly with `{"ResultCode": 0, "ResultDesc": "Accepted"}` so Safaricom does not flood retries.

| Safaricom `ResultCode` | Typical meaning | System action |
| ---: | --- | --- |
| **0** | Payment successful | Transaction → **`SUCCESS`**; wallet credited; `wallet_ledger` `DEPOSIT` row added (`reference_id` = `checkout_request_id`) |
| **1032** | User cancelled PIN prompt | Transaction → **`FAILED`**; wallet and ledger **unchanged** |
| **1** | Insufficient M-Pesa balance | Transaction → **`FAILED`**; wallet and ledger **unchanged** |
| **1037** | Handset timeout / user unreachable | Transaction → **`FAILED`**; wallet and ledger **unchanged** |
| **Other non-zero** | Daraja error (invalid number, limits, etc.) | Transaction → **`FAILED`**; `result_code` / `result_desc` stored; no credit |

#### Edge cases & idempotency

| Scenario | Behaviour |
| --- | --- |
| **Duplicate callback** for an already settled transaction | Acknowledged with `200`; row lock sees status ≠ `PENDING` → **no double credit** |
| **Unknown `CheckoutRequestID`** | Acknowledged with `200`; no wallet mutation (orphan callback) |
| **Malformed callback JSON** | `400` — Safaricom may retry until a valid ack path exists |
| **Success but wallet row missing** | `404` — transaction not completed; investigate data integrity |
| **No callback received** (user ignored prompt, Safaricom outage) | Row stays **`PENDING`** indefinitely today; use Daraja **STK Query** (`/mpesa/stkpushquery/v1/query`) to reconcile manually or via a future sweeper (see [docs/MPESA.md](docs/MPESA.md)) |
| **Duplicate Safaricom delivery after success** | Second callback ignored once status is no longer `PENDING` |

#### Phone number formats

| Context | Format | Example |
| --- | --- | --- |
| M-Pesa STK Push API | Digits only, no `+` | `254712345678` |
| Auth SMS (Africa's Talking) | E.164 with `+` | `+254712345678` |

---

## Services & Ports

| Service | Port | Description |
| --- | ---: | --- |
| `ingress-service` | 8000 | Auth (OTP), bet ingress |
| `odds-service` | 8001 | WebSocket odds relay |
| `settlement-api` | 8002 | Settlement + M-Pesa routes |
| `kafka` | 9092 | Event broker |
| `postgres` | 5432 | Primary database |
| `frontend` | 4200 | Angular dev server |
| **Redis (host)** | 6379 | OTP cache (not in Docker Compose) |

---

## Quick Start

### 1. Prerequisites

- Docker + Docker Compose (for Kafka, Postgres, and app containers)
- **Redis** running on WSL (`redis-cli ping` → `PONG`)
- Node.js 20+ (frontend)
- Africa's Talking sandbox API key (SMS OTP)
- Safaricom Daraja sandbox keys (M-Pesa, optional for deposits)

### 2. Environment

Copy and edit the root env file:

```bash
cp .env.example .env
```

Key variables for the Kenyan integrations:

```env
# Africa's Talking — SMS OTP (ingress_service reads AT_USERNAME / AT_API_KEY)
AT_USERNAME=sandbox
AT_API_KEY=your_africas_talking_api_key

# Redis — local WSL instance
REDIS_URL=redis://localhost:6379/0

# Safaricom M-Pesa Daraja (settlement_service)
CONSUMER_KEY=your_daraja_consumer_key
CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-ngrok-url/api/v1/mpesa/callback

# Shared
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/betting_db
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
JWT_SECRET_KEY=replace-with-a-long-random-secret
```

Ingress-specific settings live in [ingress_service/.env.example](ingress_service/.env.example).

### 3. Start infrastructure & services

```bash
# Kafka + Postgres + all app containers
docker compose up --build

# Angular UI (separate terminal)
cd frontend && npm install && npm start
```

Or run everything natively without app containers:

```bash
./scripts/run_local.sh
```

### 4. Smoke test

```bash
curl http://localhost:8000/healthz
curl http://localhost:8001/healthz
curl http://localhost:8002/healthz
python scripts/test_e2e.py   # optional full pipeline test
```

---

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Service boundaries, Kafka topics, diagrams |
| [docs/api_reference.md](docs/api_reference.md) | HTTP endpoints and payloads |
| [docs/MPESA.md](docs/MPESA.md) | STK Push, webhooks, failure codes |
| [docs/deployment.md](docs/deployment.md) | Production checklist, env reference |
| [docs/schemas.md](docs/schemas.md) | Kafka event schemas |

---

## Repository Layout

```text
distributed_betting_platform/
├── frontend/              Angular SPA
├── ingress_service/       Auth (OTP), bet HTTP → Kafka
├── settlement_service/    Wallets, M-Pesa, settlement worker
├── odds_service/          WebSocket odds + market simulator
├── risk_engine/           C++ Kafka risk consumer
├── scripts/               run_local.sh, e2e tests
├── docs/                  Architecture & API docs
└── docker-compose.yml     Kafka, Postgres, app services (no Redis image)
```

---

## License

See [LICENSE](LICENSE).
