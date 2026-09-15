### 1. Event & State Flow Architecture

    +---------------+      1. Bet Placed/Settled       +---------
------------+
    | User / Client | -------------------------------> |
  Ingress / Risk     |
    +---------------+                                  |
  Engine Gateway     |
                                                       +---------
------------+
    
|
    
|
  2. Produce Bet Ingestion
    
  v
    
  =======================
                                                       Kafka:
  [payments.initiate]
    
  =======================
    
|
    
|
  3. Consume Payment Request
    
  v
    +-----------------------+   4. STK Push Process    +---------
------------+
    | Safaricom Daraja API  | <----------------------- |  M-
  PESA Dispatcher  |
    | (Sandbox / Prod)      | -----------------------> |
  Worker             |
    +-----------------------+   5. Sync HTTP 200       +---------
------------+
               |                   (CheckoutRequestID)
|
               |
|
  6. Persist Pending State
               |
  v
               |                                       +---------
------------+
               | 7. SIM Toolkit Push                   |
  PostgreSQL DB:      |
               |    (Non-blocking user prompt)         |
  [mpesa_transactions]|
               v                                       +---------
------------+
    +-----------------------+
|
    |  User Mobile Handset  |
|
  (Waiting for PIN)
    |  (Enters PIN/Cancels) |
|
    +-----------------------+
|
               |
|
               | 8. PIN verified / cancelled
|
               v
|
    +-----------------------+
|
    | Safaricom Daraja API  |
|
    +-----------------------+
|
               |
|
               | 9. HTTP POST Async Callback
|
               v
  v
    +------------------------------------------------------------
------------+
    | Callback Webhook Ingress (FastAPI:
  /api/v1/mpesa/callback)             |
    |   - Sends immediate 200 OK: {"ResultCode": 0,
  "ResultDesc": "Accepted"}|
    +------------------------------------------------------------
------------+
                                       |
                                       | 10. Produce Reconciled
  Event
                                       v
                            ========================
                            Kafka: [payments.events]
                            ========================
                                       |
                                       | 11. Consume
  PAYMENT_COMPLETED / FAILED
                                       v
                            +----------------------+
                            |  Settlement Engine   |
                            |  & Ledger Service    |
                            +----------------------+
                                       |
                                       | 12. Single ACID
  Transaction:
                                       |     - Row lock on
  Wallet
                                       |     - Append to
  wallet_ledger
                                       |     - Update Wallet
  balance
                                       |     - Update Bet
  status (ACCEPTED / REJECTED)
                                       v
                            +----------------------+
                            | PostgreSQL ACID DB   |
                            | - wallets            |
                            | - wallet_ledger      |
                            | - bets               |
                            +----------------------+

  #### Step Sequence Detail:

  1. Trigger: When a wager requires fiat funding (or wallet
  deposit), the gateway registers a pending bet ticket and
  emits a PaymentInitiationRequest event to Kafka topic
  payments.initiate.
  2. Asynchronous STK Dispatch:
      • The M-PESA Dispatcher worker consumes the event.
      • It retrieves/caches an OAuth bearer token using logic
      from oauth_request.py.
      • It generates the base64 password signature SHORTCODE +
      PASSKEY + timestamp and calls Safaricom's
      /mpesa/stkpush/v1/processrequest as structured in
      stk_push.py.
      • Safaricom returns a synchronous response with a
      CheckoutRequestID.
      • The worker inserts a row into mpesa_transactions in
      state PENDING_USER_PIN mapping checkout_request_id ->
      (bet_id, user_id, amount_cents) and exits. The settlement
      engine does not block.
  3. User Interaction:
      • Safaricom displays the SIM Toolkit pop-up on the
      customer handset. The platform stays completely
      asynchronous.
  4. Webhook Callback Ingestion:
      • Safaricom calls your public endpoint
      (/api/v1/mpesa/callback).
      • The webhook parses Body.stkCallback (CheckoutRequestID,
      ResultCode, ResultDesc, and CallbackMetadata).
      • The webhook responds immediately with {"ResultCode": 0,
      "ResultDesc": "Accepted"} to prevent Daraja retry floods.
      • It publishes a PaymentCallbackProcessed event to Kafka
      topic payments.events.
  5. Ledger & Settlement Interception:
      • The Settlement Service consumes payments.events.
      • If status == PAYMENT_COMPLETED, it executes an atomic
      DB transaction: acquires a lock on Wallet, appends a
      record to wallet_ledger, updates Wallet.balance_cents,
      and confirms the Bet status to ACCEPTED.
      • If status == PAYMENT_FAILED, the ledger is untouched,
      and the Bet status is marked REJECTED.

  ──────
  ### 2. Interface / Contract Definitions

  The event contracts use Pydantic v2 schemas consistent with
  schemas.py.

  #### A. Payment Initiation Event (Kafka Topic:               
  payments.initiate)

  Emitted by the settlement/betting engine to request STK Push
  execution:

    from datetime import datetime, timezone
    from enum import Enum
    from uuid import UUID
    from pydantic import BaseModel, Field
    
    class PaymentActionType(str, Enum):
        BET_DEPOSIT = "BET_DEPOSIT"
        WALLET_TOPUP = "WALLET_TOPUP"
        PAYOUT = "PAYOUT"
    
    class PaymentInitiationRequest(BaseModel):
        event_id: str = Field(min_length=1, max_length=128)
        correlation_id: str = Field(description="Maps to bet_id
  or deposit reference")
        user_id: UUID
        phone_number: str = Field(pattern=r"^254[17]\d{8}$",
  description="E.g. 254796496063")
        amount_cents: int = Field(gt=0, description="Amount in
  cents (converted to whole KES for STK push)")
        account_reference: str = Field(max_length=12,
  description="Short string displayed on phone, e.g. BET-4291")
        action_type: PaymentActionType
        created_at: datetime = Field(default_factory=lambda:
  datetime.now(timezone.utc))

  #### B. Gateway Synchronous Response Tracking (Database      
  Model)

  To link the asynchronous callback to the originating user and
  bet ticket:

    # models.py table extension: mpesa_transactions
    class MpesaTransactionStatus(str, Enum):
        INITIATED = "INITIATED"
        COMPLETED = "COMPLETED"
        FAILED = "FAILED"
        TIMEOUT = "TIMEOUT"
    
    # Table schema:
    # - checkout_request_id (VARCHAR(128), PRIMARY KEY)
    # - merchant_request_id (VARCHAR(128), INDEX)
    # - correlation_id (VARCHAR(128), INDEX -> bet_id)
    # - user_id (UUID, FK -> users.id)
    # - amount_cents (BIGINT)
    # - status (mpesa_transaction_status, DEFAULT INITIATED)
    # - mpesa_receipt_number (VARCHAR(64), UNIQUE, NULLABLE)
    # - result_code (INT, NULLABLE)
    # - result_desc (TEXT, NULLABLE)
    # - created_at (TIMESTAMPTZ)
    # - updated_at (TIMESTAMPTZ)

  #### C. Safaricom Callback Reconciliation Event (Kafka Topic:
  payments.events)

  Emitted by the webhook receiver after parsing Daraja's
  callback:

    class PaymentCallbackProcessed(BaseModel):
        event_id: str = Field(min_length=1, max_length=128)
        checkout_request_id: str
        correlation_id: str
        user_id: UUID
        amount_cents: int
        status: str = Field(description="PAYMENT_COMPLETED or
  PAYMENT_FAILED")
        result_code: int = Field(description="0 = Success, 1032
  = Cancelled, 1 = Insufficient Funds")
        result_desc: str
        mpesa_receipt_number: str | None = None
        transaction_time: datetime | None = None
        phone_number: str | None = None
  ──────
  ### 3. Ledger & Risk Engine Interception

  In financial settlement systems, the append-only ledger
  (wallet_ledger) must never record provisional or unconfirmed
  transactions.

    async def handle_payment_completed(session: AsyncSession,
  event: PaymentCallbackProcessed):
        async with session.begin():
            # 1. Idempotency Check on Ledger Reference
            existing = await session.scalar(
                select(WalletLedger).where(
                    WalletLedger.reference_id == event.
  mpesa_receipt_number
                )
            )
            if existing:
                # Duplicate webhook delivery from Safaricom
  retry: ignore safely
                return
    
            # 2. Acquire Pessimistic Row Lock on User Wallet
            wallet = await session.scalar(
                select(Wallet).where(Wallet.user_id == event.
  user_id).with_for_update()
            )
            if not wallet:
                raise ValueError(f"Wallet for user {event.
  user_id} not found")
    
            # 3. Append to Append-Only Wallet Ledger
            ledger_entry = WalletLedger(
                user_id=event.user_id,
                amount_cents=event.amount_cents,
                type=LedgerType.DEPOSIT,
                reference_id=event.mpesa_receipt_number,
            )
            session.add(ledger_entry)
    
            # 4. Update Wallet Balance
            wallet.balance_cents += event.amount_cents
    
            # 5. Transition Associated Bet Ticket
            bet = await session.scalar(
                select(Bet).where(Bet.id == UUID(event.
  correlation_id)).with_for_update()
            )
            if bet and bet.status == BetStatus.PENDING:
                bet.status = BetStatus.ACCEPTED
    
            # 6. Mark Transaction Record COMPLETED
            await session.execute(
                update(MpesaTransaction)
                .where(MpesaTransaction.checkout_request_id ==
  event.checkout_request_id)
                .values(
                    status=MpesaTransactionStatus.COMPLETED,
                    mpesa_receipt_number=event.
  mpesa_receipt_number,
                    result_code=event.result_code,
                    result_desc=event.result_desc,
                )
            )
  ──────
  ### 4. Handling Failed Payments, Timeouts, and Edge Cases

   Scenario      | Safaricom Response / Signal | System Action
  ---------------|-----------------------------|---------------
   User Cancels  | Callback received with      | Webhook
   PIN Prompt    | ResultCode: 1032 ("Request  | publishes
                 | cancelled by user")         | PAYMENT_FAILE
                 |                             | D. Settlement
                 |                             | transitions
                 |                             | bet to
                 |                             | REJECTED,
                 |                             | releases
                 |                             | reserved risk
                 |                             | capacity.
                 |                             | Ledger is not
                 |                             | touched.
   Insufficient  | Callback received with      | Webhook
   M-PESA Funds  | ResultCode: 1 ("The balance | publishes
                 | is insufficient")           | PAYMENT_FAILE
                 |                             | D. Bet is
                 |                             | marked
                 |                             | REJECTED with
                 |                             | reason
                 |                             | "INSUFFICIENT
                 |                             | _FUNDS".
   User Ignores  | Callback received with      | Webhook
   Prompt /      | ResultCode: 1037 ("DS       | publishes
   Handset       | timeout user cannot be      | PAYMENT_FAILE
   Timeout       | reached")                   | D. Bet is
                 |                             | marked
                 |                             | REJECTED with
                 |                             | reason
                 |                             | "HANDSET_TIME
                 |                             | OUT".
   Safaricom     | No callback received after  | Reconciliatio
   Network Drops | 90 seconds                  | n Sweeper: A
   Callback      |                             | lightweight
                 |                             | background
                 |                             | task runs
                 |                             | every 60s
                 |                             | looking for
                 |                             | INITIATED
                 |                             | transactions
                 |                             | older than 2
                 |                             | minutes. It
                 |                             | queries
                 |                             | Safaricom's
                 |                             | /mpesa/stkpus
                 |                             | hquery/v1/que
                 |                             | ry with
                 |                             | CheckoutReque
                 |                             | stID.
   Duplicate     | Safaricom retries if HTTP   | Webhook
   Callback      | 200 response exceeds 5      | responds with
   Retries       | seconds                     | {"ResultCode"
                 |                             | : 0,
                 |                             | "ResultDesc":
                 |                             | "Accepted"}
                 |                             | immediately
                 |                             | before Kafka
                 |                             | emission. DB
                 |                             | unique
                 |                             | constraint on
                 |                             | mpesa_receipt
                 |                             | _number
                 |                             | prevents
                 |                             | duplicate
                 |                             | credit.
   Out-of-Order  | Webhook callback arrives    | The webhook
   Execution     | before sync DB commit       | handler uses
                 | finishes                    | checkout_requ
                 |                             | est_id upsert
                 |                             | / polling
                 |                             | retry or
                 |                             | pushes to
                 |                             | Kafka where
                 |                             | consumer
                 |                             | order
                 |                             | guarantees
                 |                             | consistency.
  ──────
  ### Recommended File Placement in settlement_service

  To integrate this cleanly with your current backend:

  1. Move the credentials and URLs from stk_push.py into
  settlement_service/app/config.py using pydantic-settings.
  2. Convert the synchronous requests calls in oauth_request.py
  and stk_push.py to httpx.AsyncClient to avoid blocking the
  asyncio event loop.
  3. Replace the BaseHTTPRequestHandler in stk_push.py with a
  native FastAPI route (@router.post("/mpesa/callback")) inside
  settlement.py or a dedicated payments.py router.
