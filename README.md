# Distributed FinTech Betting Platform (Kenyan Stack Integration)

An event-driven Betting application utilizing a modern Kenyan technology stack. Features asynchronous Safaricom M-PESA STK Push validation, Africa's Talking SMS notifications, and high-performance Redis OTP registration services.

---

## 🇰🇪 Localized System Topology & Event Flow

The architecture decouples third-party API communication boundaries via distributed queues to ensure payment latency drops do not bottleneck transaction execution.

Use code with caution.
+---------------+      1. Bet Deposit Intent         +--------------------+
| User / Client | ---------------------------------> | Ingress Gateway    |
+---------------+                                    +---------+----------+
|
2. Emit payments.initiate
v
======================
Kafka Event Broker
======================
|
3. Consume Stream
v
+-----------------------+    4. STK Push Call        +--------------------+
| Safaricom Daraja API  | <------------------------- | M-PESA Dispatcher  |
+-----------+-----------+                            +--------------------+
|
| 5. Push SIM Prompt (Enter PIN)
v
+-----------------------+    6. HTTP Async Webhook   +--------------------+
| Customer Handset App  | -------------------------> | FastAPI Webhook    |
+-----------------------+                            +---------+----------+
|
7. Emit payments.events
v
+-----------------------+    8. Process ACID Ledger  +--------------------+
| PostgreSQL Database   | <------------------------- | Settlement Worker  |
+-----------------------+                            +--------------------+

### Technical Highlight Specifications

1. **Safaricom M-PESA Daraja API Subsystem**:
   - **Asynchronous STK Push Processing**: Uses `stk_push.py` to trigger immediate SIM Toolkit pop-ups on user devices via `/mpesa/stkpush/v1/processrequest`.
   - **Non-Blocking Ingestion**: Transaction states are kept at `PENDING_USER_PIN` mapped by a unique `CheckoutRequestID`, bypassing blocking database processing loops.
   - **Idempotent Callbacks**: The webhook endpoint `/api/v1/mpesa/callback` parses incoming metadata and acknowledges with a quick `200 OK` to prevent duplicate traffic loops.

2. **Redis & Africa's Talking OTP Authentication**:
   - **Registration Handshake**: Generates a temporary secure numeric passcode during register operations via `auth-register.component.ts`.
   - **Redis Key-Value Cache Engine**: Stores the generated code mapped to the user profile with an absolute 5-minute expiration time.
   - **SMS Delivery Routing**: Employs Africa's Talking SMS gateway platform to broadcast the registration passcode directly to the target mobile device (`^254[17]\d{8}$`).

---

## API Interface Contracts & Database Ledger

### M-PESA Payment Initiation Contract (`Kafka: payments.initiate`)
```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class PaymentInitiationRequest(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    correlation_id: str = Field(description="Maps to target bet_id or deposit token")
    user_id: UUID
    phone_number: str = Field(pattern=r"^254[17]\d{8}$", description="Valid Kenyan MSISDN")
    amount_cents: int = Field(gt=0, description="Amount in Cents (e.g. 50000 = 500 KES)")
    account_reference: str = Field(max_length=12, description="Reference displayed on handset")
```

### Transaction Failure & Resolution Traversal Matrix

| Operational Scenario | Third-Party Gateway Signal | Automated Application Recovery |
| :--- | :--- | :--- |
| **User Cancels PIN Prompt** | `ResultCode: 1032` (Cancelled) | Webhook fires `PAYMENT_FAILED`; marks target bet status as `REJECTED`. |
| **Insufficient Wallet Funds** | `ResultCode: 1` (Low Balance) | Drops payment event; updates user context logs with `INSUFFICIENT_FUNDS`. |
| **Handset Inactivity Timeout** | `ResultCode: 1037` (Timeout) | Registers transaction as closed; triggers immediate message cleanup. |
| **Safaricom Dropouts** | No callback reply within 120s | A background task queries the API endpoint `/mpesa/stkpushquery/v1/query`. |

---

## Environment Infrastructure Deployment

Configure the variables inside your localized environment `.env` layout:

```env
# Safaricom M-PESA Configuration Settings
MPESA_CONSUMER_KEY=your_daraja_key_here
MPESA_CONSUMER_SECRET=your_daraja_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.co.ke

# Africa's Talking SMS API Keys
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=your_at_key_here

# Cache Layer Configuration
REDIS_URL=redis://localhost:6379/0
```