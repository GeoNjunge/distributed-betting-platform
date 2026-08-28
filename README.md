# Distributed High-Throughput Betting & Odds Platform

[![Architecture: Distributed Event-Driven](https://img.shields.io/badge/Architecture-Event--Driven%20Outbox-blue.svg)](docs/architecture.md)
[![FastAPI](https://img.shields.io/badge/Ingress-FastAPI%20Python%203.11-009688.svg)](ingress_service/)
[![C++ Risk Engine](https://img.shields.io/badge/Risk%20Engine-Modern%20C%2B%2B20-00599C.svg)](risk_engine/)
[![Apache Kafka](https://img.shields.io/badge/Message%20Broker-Apache%20Kafka%203.7-231F20.svg)](docker-compose.infra.yml)
[![PostgreSQL](https://img.shields.io/badge/Ledger-PostgreSQL%2016%20ACID-336791.svg)](settlement_service/)
[![Angular](https://img.shields.io/badge/Frontend-Angular%2018%20%2B%20Tailwind-DD0031.svg)](frontend/)

A high-performance, distributed, event-driven betting and sports trading platform designed for ultra-low latency order execution, pre-trade risk evaluation, and ACID transactional wallet settlement with end-to-end distributed request tracing.

---

## 🏛️ System Architecture

```
                                  +---------------------------------------+
                                  |         ANGULAR 18 DASHBOARD          |
                                  |  - Real-Time Trading Desk             |
                                  |  - Pipeline Request Tracer (6-Hop DAG)|
                                  |  - Infrastructure Telemetry Status    |
                                  +---+---------------+---------------+---+
                                      |               |               |
               WebSocket /ws/odds     |   HTTP 202    |   HTTP GET    |
               (Real-Time Market Data)|   (JWT Auth)  |   /api/v1/trace
                                      v               v               v
                      +-------------------+   +---------------+   +--------------------+
                      |   Odds Service    |   |    Ingress    |   |   Settlement API   |
                      |  (FastAPI :8001)  |   | (FastAPI :8000|   |  (FastAPI :8002)   |
                      +---------+---------+   +-------+-------+   +---------+----------+
                                ^                     |                     ^
                                | Produce Ticks       | Produce Event       | Read State
                                |                     v                     |
              +-----------------+---------------------+---------------------+------------------+
              |                             APACHE KAFKA BROKER (:9092)                        |
              |   • Topic: odds-updates      • Topic: bets-submitted      • Topic: bets-results |
              +-----------------+---------------------+---------------------+------------------+
                                                      |                     ^
                                                Consume Event         Produce Decision
                                                      |                     |
                                                      v                     |
                                      +-------------------------------------+------------------+
                                      |              C++20 PRE-TRADE RISK ENGINE               |
                                      |   • Stale Quote Validation (<200ms age)                |
                                      |   • Single-Account Exposure Cap (SAEC <= $10,000)      |
                                      |   • Lock-Free Atomic Compare-And-Swap (CAS) Debit      |
                                      +--------------------------------------------------------+
                                                                            |
                                                               Consume Decision
                                                                            v
                                                              +--------------------------------+
                                                              |   Settlement Worker (Python)   |
                                                              |   • Idempotent User/Wallet Init|
                                                              |   • ACID Stake Debit & Locking |
                                                              |   • Append-Only Audit Ledger   |
                                                              +----------------+---------------+
                                                                               |
                                                                               v
                                                              +--------------------------------+
                                                              |     PostgreSQL 16 Database     |
                                                              |   • users, wallets, bets       |
                                                              |   • wallet_ledger (ACID WAL)   |
                                                              +--------------------------------+
```

---

## ⚡ Key Capabilities & Technical Highlights

1. **Deterministic Idempotency & Ingress Gateway (`ingress_service`)**:
   - Computes deterministic order identity: `idempotency_key = sha256(user_id:match_id:timestamp)`.
   - Generates trace UUID5: `event_id = uuid5(NAMESPACE_DNS, f"bets-submitted:{idempotency_key}")`.
   - Enforces HMAC SHA-256 JWT security and produces to Kafka with zero blocking database roundtrips.

2. **Ultra-Low Latency Pre-Trade Risk Engine (`risk_engine`)**:
   - Modern C++20 engine consuming from `bets-submitted` and publishing to `bets-results`.
   - Sub-millisecond pre-trade validation:
     - **Stale Quote Defense**: Rejects ticks older than $200\text{ms}$.
     - **Exposure Control**: Single-Account Exposure Cap (SAEC $\le \$10,000$).
     - **Atomic CAS Execution**: Thread-safe lock-free balance verification and deduction.

3. **ACID Transactional Ledger & Settlement Worker (`settlement_service`)**:
   - Consumes risk evaluation results from `bets-results`.
   - Executes atomic multi-table updates inside PostgreSQL `READ COMMITTED` transactions with row-level locking.
   - Enforces non-negative balances (`CONSTRAINT ck_wallets_balance_non_negative`).
   - Maintains an append-only, immutable `wallet_ledger` audit trail for `BET_STAKE` and `BET_PAYOUT` operations.

4. **Distributed Request Tracing & Health APIs**:
   - **`GET /api/v1/trace/{query}`**: Traverses the end-to-end 6-hop DAG (Ingress &rarr; Ingestion Queue &rarr; C++ Risk Engine &rarr; Decision Dispatch &rarr; Settlement DB &rarr; Client Broadcast) with hop latencies ($\Delta t$) and ledger entries.
   - **`GET /api/v1/bets/recent`**: Quick index of the latest bets for instantaneous tracing.
   - **`GET /api/v1/health/system`**: Live telemetry probing Kafka active topics and PostgreSQL latency.

5. **Angular 18 Observability & Trading Dashboard (`frontend`)**:
   - **Pipeline Request Tracer**: Interactive DAG stage cards, latency waterfall visualizer, preset scenarios (*Happy Path*, *Stale Quote*, *SAEC Cap Exceeded*), and raw JSON inspector.
   - **Real-Time Telemetry Bar**: Cluster status indicators for Kafka (:9092), Postgres (:5432), Ingress (:8000), Odds (:8001), and Settlement (:8002).
   - **Metrics Banner**: High-throughput live metric counters (Ticks/sec, P99 Latency, Ingestion throughput).
   - **Trading Desk**: Live odds feed, execution bet slip with fast stakes, and operator match settlement controls.

---

## 🚀 Quickstart Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js 18+](https://nodejs.org/) & `npm`
- Python 3.11+ / 3.12+
- CMake 3.20+ & GCC 13+ (for compiling C++ risk engine on host)

---

### Option A: Running with Docker Compose

Start the full microservices cluster:

```bash
# 1. Start Infrastructure (Kafka & PostgreSQL)
docker compose -f docker-compose.infra.yml up -d

# 2. Build & Launch Microservices Stack
docker compose up -d --build
```

---

### Option B: Running Locally (Native Process Runner)

To run the full stack natively on your host machine:

```bash
# 1. Start Kafka and PostgreSQL containers
docker compose -f docker-compose.infra.yml up -d

# 2. Launch all backend microservices via the runner script
bash scripts/run_local.sh
```

---

### Starting the Angular Frontend

```bash
cd frontend
npm install
npm start
```
Open your browser and navigate to: **`http://localhost:4200`**

---

## 🧪 Testing & Verification

Run the automated 7-step end-to-end integration test suite:

```bash
./settlement_service/.venv/bin/python scripts/test_e2e.py
```

### Test Pipeline Verification:
1. `[1/7]` Initialize database schema and seed test wallet.
2. `[2/7]` Register and authenticate through `ingress_service` (JWT cookie validation).
3. `[3/7]` Connect to `odds_service` WebSocket and capture real-time market tick.
4. `[4/7]` Submit bet order through `ingress_service` (HTTP 202).
5. `[5/7]` C++ `risk_engine` consumes order, runs pre-trade checks, and publishes to `bets-results`.
6. `[6/7]` `settlement_worker` acquires row lock, executes balance deduction, and appends `BET_STAKE` to `wallet_ledger`.
7. `[7/7]` Trigger match settlement via `settlement_api`, credit payout, and verify `BET_PAYOUT` ledger entry.

---

## 📚 Service Endpoints Reference

| Service | Port | Protocol | Key Endpoints |
|---|---|---|---|
| **Ingress Service** | `8000` | HTTP / REST | `POST /register`, `POST /login`, `POST /api/v1/bets`, `GET /healthz` |
| **Odds Service** | `8001` | HTTP & WebSocket | `WS /ws/odds`, `GET /healthz` |
| **Settlement Core** | `8002` | HTTP / REST | `POST /api/v1/settle-match`, `GET /api/v1/trace/{query}`, `GET /api/v1/bets/recent`, `GET /api/v1/health/system`, `GET /healthz` |
| **Apache Kafka** | `9092` | TCP | Topics: `bets-submitted`, `bets-results`, `odds-updates` |
| **PostgreSQL** | `5432` | TCP | Tables: `users`, `wallets`, `bets`, `wallet_ledger` |
| **Angular UI** | `4200` | HTTP | Trading Desk, Request Tracer, Telemetry Dashboard |

---

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
