# PayNexus Wallet Service — Complete Reference Guide

> **Port:** 8082 | **DB:** PostgreSQL + Redis | **Auth:** Open (V1) → Keycloak JWT (V3)

---

## Architecture Diagram

```
                              ┌─────────────────────────────────────────────────────────────────┐
                              │                        PayNexus System                          │
                              │                                                                 │
  Mobile App / Frontend       │  ┌──────────────┐      ┌────────────────────────────────────┐  │
       │                      │  │  API Gateway │─────►│         wallet-service :8082        │  │
       └──────────────────────┼─►│  (port 8080) │      │                                    │  │
                              │  └──────────────┘      │  ┌────────────┐  ┌───────────────┐ │  │
                              │                        │  │ PostgreSQL │  │     Redis     │ │  │
                              │  ┌──────────────┐      │  │ (paynexus_ │  │ (Distributed  │ │  │
                              │  │  Razorpay    │──────┼─►│  wallet)   │  │  Locks +      │ │  │
                              │  │  Webhook     │      │  └────────────┘  │  Idempotency) │ │  │
                              │  └──────────────┘      │                  └───────────────┘ │  │
                              │                        └────────────────────────────────────┘  │
                              │                                    │                           │
                              │                    ┌───────────────┴───────────────┐           │
                              │                    │                               │           │
                              │         ┌──────────▼──────────┐      ┌────────────▼──────────┐ │
                              │         │   order-engine       │      │  notification-service │ │
                              │         │   (via /internal)   │      │   (via Feign/Eureka)  │ │
                              │         └─────────────────────┘      └───────────────────────┘ │
                              │                                                                 │
                              │  ┌─────────────────────────────────────────────────────────┐   │
                              │  │                  Eureka Discovery Server :8761           │   │
                              │  └─────────────────────────────────────────────────────────┘   │
                              └─────────────────────────────────────────────────────────────────┘
```

### Data Flow: P2P Transfer (Alice → Bob)

```
Alice's App
    │
    ├─ POST /api/v1/wallet/transfer
    │   Header: X-Idempotency-Key: <uuid>
    │   Body: { senderId, receiverId, amount, transactionPin }
    │
    ▼
API Gateway ──► wallet-service
                    │
                    ├─ 1. Redis: checkAndMark(idempotencyKey)   ──► [SET NX 120s]
                    │
                    ├─ 2. Redis: MultiLock(senderWalletId, receiverWalletId)
                    │         [Atomic Lua script: both locks or none]
                    │
                    ├─ 3. PostgreSQL: Verify PIN (BCrypt.matches)
                    │
                    ├─ 4. PostgreSQL: Check balance, frozen, daily limit
                    │
                    ├─ 5. PostgreSQL: UPDATE wallets SET available_balance = ...   (sender debit)
                    ├─ 6. PostgreSQL: UPDATE wallets SET available_balance = ...   (receiver credit)
                    ├─ 7. PostgreSQL: INSERT ledger_entries (DEBIT row for sender)
                    ├─ 8. PostgreSQL: INSERT ledger_entries (CREDIT row for receiver)
                    │                [All in ONE @Transactional — commit together]
                    │
                    ├─ 9. Redis: multiLock.unlock()
                    │
                    └─ 10. Return HTTP 200
```

### Data Flow: Wallet Top-Up (Razorpay)

```
User App
    │
    ├─ POST /api/v1/payments/initiate { userId, amount: 5000 }
    │
    ▼
wallet-service ──► Razorpay API ──► Returns order_id: "order_Abc123"
    │
    └─ Response: { razorpayOrderId, amount, currency, razorpayKeyId }

User opens Razorpay Checkout Modal (frontend) ──► User pays via UPI/Card

    Razorpay Server
        │
        ├─ POST /api/v1/payments/webhook
        │   Header: X-Razorpay-Signature: <hmac>
        │
        ▼
wallet-service
    ├─ 1. HMAC-SHA256 verify (signature vs webhookSecret)
    ├─ 2. Redis: SET NX webhook:processed:{paymentId} (48h TTL) — idempotency
    ├─ 3. RLock(wallet:lock:{userId})
    ├─ 4. PostgreSQL: UPDATE wallet available_balance += amount
    ├─ 5. PostgreSQL: INSERT ledger_entries (CREDIT)
    └─ 6. Return HTTP 200 "OK"
```

---

## Package Structure

```
wallet-service/
└── src/main/
    ├── java/com/paynexus/walletservice/
    │   ├── WalletServiceApplication.java       # @EnableFeignClients, @EnableScheduling
    │   ├── config/
    │   │   ├── RedissonConfig.java             # Distributed lock infrastructure
    │   │   ├── RazorpayConfig.java             # Razorpay SDK bean
    │   │   └── PasswordEncoderConfig.java      # BCryptPasswordEncoder (strength=10)
    │   ├── entity/
    │   │   ├── User.java                       # password_hash, transaction_pin_hash
    │   │   ├── Wallet.java                     # @Version optimistic locking
    │   │   ├── LedgerEntry.java                # IMMUTABLE — no setters on financial fields
    │   │   └── UserKyc.java                    # PAN, Aadhaar last 4, DOB — text-based, no file uploads
    │   ├── enums/
    │   │   ├── TransactionType.java            # CREDIT | DEBIT | HOLD | RELEASE
    │   │   ├── KycStatus.java                  # PENDING | SUBMITTED | VERIFIED | REJECTED
    │   │   └── NotificationChannel.java
    │   ├── repository/
    │   │   ├── UserRepository.java             # findByEmail, existsByEmail
    │   │   ├── WalletRepository.java           # findByUserId, resetAllDailySpent()
    │   │   ├── LedgerEntryRepository.java      # paginated, sumAmountByWalletIdAndType
    │   │   └── UserKycRepository.java          # findByUserId, findByUser_KycStatus
    │   ├── dto/
    │   │   ├── request/                        # RegisterRequest, LoginRequest, etc.
    │   │   └── response/                       # ApiResponse<T>, WalletResponse, etc.
    │   ├── service/
    │   │   ├── IdempotencyService.java         # Redis SET NX duplicate check
    │   │   ├── UserService.java                # register, login, setPin, submitKyc
    │   │   ├── WalletService.java              # credit, hold, settle, release, freeze
    │   │   ├── LedgerService.java              # recordCredit/Debit/Hold/Release
    │   │   ├── P2PTransferService.java         # RedissonMultiLock P2P transfer
    │   │   └── RazorpayService.java            # createOrder, processWebhook
    │   ├── client/
    │   │   └── NotificationFeignClient.java    # Feign → notification-service
    │   ├── controller/
    │   │   ├── UserController.java             # /api/v1/users/**
    │   │   ├── WalletController.java           # /api/v1/wallet/**
    │   │   ├── PaymentController.java          # /api/v1/payments/**
    │   │   ├── InternalWalletController.java   # /internal/wallet/**
    │   │   └── AdminController.java            # /admin/**
    │   └── exception/
    │       ├── GlobalExceptionHandler.java     # @RestControllerAdvice
    │       └── [8 custom exception classes]
    └── resources/
        ├── application.yaml
        └── db/migration/
            ├── V1__create_users_table.sql
            ├── V2__create_wallets_table.sql
            ├── V3__create_ledger_entries_table.sql
            ├── V4__create_kyc_documents_table.sql  ← original (never modified — Flyway rule)
            └── V5__migrate_kyc_to_text_based.sql   ← drops kyc_documents, creates user_kyc
```

---

## API Endpoints

### User Endpoints (`/api/v1/users/**`)

---

#### `POST /api/v1/users/register`
Creates a new user account AND a linked wallet in a single atomic transaction.

**Request Body:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "SecurePass@123"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `name` | Required, 2–100 characters |
| `email` | Required, valid email format |
| `password` | Required, minimum 8 characters |

**Success Response — `201 Created`:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "walletId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "email": "rahul@example.com"
  }
}
```

**Error Responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `409 Conflict` | Email already registered | `{ "success": false, "message": "Email is already registered: rahul@example.com" }` |
| `400 Bad Request` | Validation failure | `{ "success": false, "message": "Validation failed", "data": { "password": "must be at least 8 characters" } }` |

---

#### `POST /api/v1/users/login`
Validates credentials. Returns userId (V1). Will return JWT in V3.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "password": "SecurePass@123"
}
```

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "rahul@example.com",
    "name": "Rahul Sharma"
  }
}
```

**Error Responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `404 Not Found` | Invalid email or password (generic to prevent enumeration) | `{ "success": false, "message": "Invalid email or password" }` |

---

#### `GET /api/v1/users/{userId}/profile`
Returns user profile without any sensitive data.

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-...",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "kycStatus": "PENDING",
    "hasPinSet": false,
    "isActive": true
  }
}
```

---

#### `PUT /api/v1/users/{userId}/pin`
Sets or updates the 6-digit transaction PIN. Required before any P2P transfer.

**Request Body:**
```json
{ "pin": "123456" }
```

**Validation Rules:** PIN must be exactly 6 digits (0-9 only, no letters).

**Success Response — `200 OK`:**
```json
{ "success": true, "message": "Transaction PIN set successfully" }
```

**Error Responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `400` | PIN is not exactly 6 digits | `{ "success": false, "message": "Validation failed", "data": { "pin": "PIN must be exactly 6 digits" } }` |
| `404` | User not found | `{ "success": false, "message": "User not found" }` |

---

#### `POST /api/v1/users/{userId}/kyc`
Submits identity details for admin review. **No file uploads, no S3** — purely text-based.

Validations performed server-side:
- `panNumber` must match regex `[A-Z]{5}[0-9]{4}[A-Z]{1}` (e.g. `ABCDE1234F`)
- `panNumber[3]` must be `'P'` — confirms it is an **individual** PAN, not a company
- User must be **≥ 18 years old** based on `dateOfBirth`
- User may re-submit if previously `REJECTED` (record is updated, not duplicated)
- User cannot re-submit if already `VERIFIED`

**Request Body:**
```json
{
  "panNumber": "ABCDE1234F",
  "aadhaarLastFour": "1234",
  "dateOfBirth": "1998-05-20"
}
```

**Success Response — `200 OK`:**
```json
{ "success": true, "message": "KYC details submitted successfully. Awaiting admin review." }
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| `400` | Invalid PAN format, Aadhaar not 4 digits, or missing field |
| `400` | User is under 18 years old |
| `400` | PAN 4th character is not `'P'` (not an individual PAN) |
| `400` | KYC is already `VERIFIED` — re-submission not allowed |
| `404` | User not found |

---

### Wallet Endpoints (`/api/v1/wallet/**`)

---

#### `GET /api/v1/wallet/{userId}`
Returns the wallet balance and status.

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "data": {
    "walletId": "6ba7b810-...",
    "userId": "550e8400-...",
    "availableBalance": 15000.00,
    "reservedBalance": 5000.00,
    "currency": "INR",
    "isFrozen": false,
    "dailyLimit": 50000.00,
    "dailySpent": 3000.00,
    "remainingDailyLimit": 47000.00
  }
}
```

> `availableBalance` = what the user can spend  
> `reservedBalance` = held for pending stock orders (not spendable)

---

#### `GET /api/v1/wallet/{userId}/ledger?page=0&size=20`
Returns paginated transaction history (newest first).

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 0 | Page number (0-indexed) |
| `size` | 20 | Number of entries per page |

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "...",
        "transactionType": "CREDIT",
        "amount": 5000.00,
        "runningBalance": 15000.00,
        "narration": "Wallet top-up via Razorpay (Payment ID: pay_AbcXyz)",
        "referenceId": "razorpay:pay_AbcXyz",
        "relatedUserId": null,
        "createdAt": "2026-09-12T10:15:30Z"
      },
      {
        "id": "...",
        "transactionType": "DEBIT",
        "amount": 500.00,
        "runningBalance": 10000.00,
        "narration": "P2P Transfer to user: 7b19e1a3-...",
        "referenceId": "transfer:abc-123-uuid",
        "relatedUserId": "7b19e1a3-...",
        "createdAt": "2026-09-11T18:30:00Z"
      }
    ],
    "totalElements": 47,
    "totalPages": 3,
    "number": 0
  }
}
```

---

#### `GET /api/v1/wallet/{userId}/ledger/summary`
Returns aggregate totals for the dashboard.

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalCredits": 50000.00,
    "totalDebits": 12000.00
  }
}
```

---

#### `POST /api/v1/wallet/transfer`
Transfers money between two users.

**Headers:**
```
X-Idempotency-Key: <client-generated UUID>
Content-Type: application/json
```

**Request Body:**
```json
{
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "receiverId": "7b19e1a3-b21f-4b59-b8a0-ef4c9c20a1b3",
  "amount": 1500.00,
  "transactionPin": "123456"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `amount` | Minimum ₹1.00, max 2 decimal places |
| `transactionPin` | Required, not blank |
| `X-Idempotency-Key` | Required header (client UUID) |

**Success Response — `200 OK`:**
```json
{ "success": true, "message": "Transfer of ₹1500.0 successful" }
```

**Error Responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `401` | Wrong transaction PIN | `{ "success": false, "message": "Incorrect transaction PIN" }` |
| `401` | PIN not yet set | `{ "success": false, "message": "Please set your transaction PIN before making transfers" }` |
| `403` | Sender wallet frozen | `{ "success": false, "message": "Wallet is frozen. Please contact support." }` |
| `409` | Duplicate idempotency key | `{ "success": false, "message": "Duplicate request detected. This operation was already processed. Retry after 2 minutes." }` |
| `422` | Insufficient balance | `{ "success": false, "message": "Insufficient balance. Available: ₹500.00, Requested: ₹1500.00" }` |
| `422` | Daily limit exceeded | `{ "success": false, "message": "Daily limit exceeded. Limit: ₹50000.00, Already spent: ₹49500.00" }` |

---

### Payment Endpoints (`/api/v1/payments/**`)

---

#### `POST /api/v1/payments/initiate`
Creates a Razorpay order. Frontend uses `razorpayOrderId` to open the checkout modal.

**Request Body:**
```json
{
  "userId": "550e8400-...",
  "amount": 5000.00
}
```

**Success Response — `200 OK`:**
```json
{
  "success": true,
  "message": "Payment order created",
  "data": {
    "razorpayOrderId": "order_AbcXyz123",
    "amount": 5000.00,
    "currency": "INR",
    "razorpayKeyId": "rzp_live_xxxx"
  }
}
```

---

#### `POST /api/v1/payments/webhook`
Receives Razorpay payment success events. **Must be registered in Razorpay Dashboard.**

**Headers (sent by Razorpay):**
```
X-Razorpay-Signature: <hmac-sha256>
Content-Type: application/json
```

**Success Response — `200 OK`:**
```
"OK"
```

**Error Responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `400` | Invalid HMAC signature | `{ "success": false, "message": "Razorpay webhook signature verification failed" }` |

---

### Internal Endpoints (`/internal/wallet/**`)

> These are NOT exposed through the API Gateway. Called only by other services via Feign.

| Method | Path | Called By | Purpose |
|--------|------|-----------|---------|
| `POST` | `/internal/wallet/hold` | order-engine | Reserve funds for stock BUY order |
| `POST` | `/internal/wallet/settle` | order-engine | Confirm hold as permanent debit (order succeeded) |
| `POST` | `/internal/wallet/release` | order-engine | Return held funds (order failed/cancelled) |
| `POST` | `/internal/wallet/credit` | order-engine | Credit wallet after stock SELL |
| `GET` | `/internal/wallet/{userId}/balance` | order-engine, ai-advisor | Check available balance |

---

### Admin Endpoints (`/admin/**`)

| Method | Path | Purpose |
|--------|------|---------|
| `PUT` | `/admin/users/{userId}/freeze` | Freeze wallet (fraud/compliance) |
| `PUT` | `/admin/users/{userId}/unfreeze` | Restore frozen wallet |
| `GET` | `/admin/kyc/pending` | Queue: all SUBMITTED KYC entries awaiting review |
| `GET` | `/admin/kyc/{userId}` | View KYC details (PAN, Aadhaar last 4, DOB) for one user |
| `PUT` | `/admin/kyc/{userId}/approve?remarks=Verified` | Approve KYC → sets status to VERIFIED |
| `PUT` | `/admin/kyc/{userId}/reject?remarks=PAN mismatch` | Reject KYC → sets status to REJECTED |

**Admin KYC Response Example (`GET /admin/kyc/pending`):**
```json
[
  {
    "userId": "a1b2c3...",
    "userName": "Rahul Sharma",
    "userEmail": "rahul@email.com",
    "kycStatus": "SUBMITTED",
    "panNumber": "ABCDE1234F",
    "aadhaarLastFour": "1234",
    "dateOfBirth": "1998-05-20",
    "submittedAt": "2026-09-15T10:00:00Z",
    "reviewedAt": null,
    "remarks": null
  }
]
```

---

## Redisson Concepts Applied in This Project

### Concept 1: RLock (Single Wallet Lock)

**Where Used:** `WalletService.creditWallet()` and `WalletService.holdFunds()`

**Problem It Solves:** If two Razorpay webhooks arrive simultaneously for the same user (Razorpay retries!), both would read balance=₹5,000 and both would credit ₹1,000, resulting in a final balance of ₹6,000 instead of the correct ₹7,000. Without locking, one update is "lost".

```
PayNexus wallet-service (3 replicas):

Pod 1: Webhook pay_001 ──► Reads balance: ₹5000 ──► Adds ₹1000 ──► Writes ₹6000
Pod 2: Webhook pay_001 ──► Reads balance: ₹5000 ──► Adds ₹1000 ──► Writes ₹6000
                                            └──── LOST UPDATE! Should be ₹7000!

WITH RLock:
Pod 1: Acquires lock:wallet:userId ──► Updates balance ₹5000→₹6000 ──► Unlocks
Pod 2: Waits for lock... ──────────────────────────────────────────► Acquires lock ──► Updates ₹6000→₹7000 ──► Unlocks
                                           ✅ Correct: ₹7000
```

**Code Pattern Used:**
```java
RLock lock = redissonClient.getLock("lock:wallet:" + userId);
boolean acquired = lock.tryLock(5, TimeUnit.SECONDS); // Watchdog ACTIVE!
if (!acquired) throw new IllegalStateException("Wallet busy, retry");
try {
    doCreditWallet(...);   // @Transactional — DB changes committed INSIDE lock
} finally {
    if (lock.isHeldByCurrentThread()) lock.unlock();
}
```

---

### Concept 2: Automatic Lock Watchdog

**Where Used:** Everywhere `lock.tryLock(waitTime, unit)` is called WITHOUT a `leaseTime`.

**Problem It Solves:** PostgreSQL queries can be slow under load. If we set a fixed 5-second lock TTL but the DB query takes 6 seconds, Redis expires the lock prematurely and another request enters — causing data corruption.

**How the Watchdog Works:**
```
T=0s  : Lock acquired in Redis (30s TTL set automatically)
T=10s : Watchdog wakes up → Resets Redis TTL back to 30s (DB query still running...)
T=20s : Watchdog wakes up → Resets Redis TTL back to 30s (DB query still running...)
T=23s : DB transaction commits! lock.unlock() called.
        Watchdog cancelled. Lock key deleted from Redis immediately.
        → Zero chance of premature expiry!

IF SERVER CRASHES AT T=21s:
        Java process dies → Watchdog background thread dies.
        Redis TTL counts down... At T=51s → Lock key auto-expires.
        → Zero deadlocks even on hard crashes!
```

**Critical Rule:**
```java
// ✅ Watchdog ACTIVE — do not pass leaseTime
lock.tryLock(waitTime, TimeUnit.SECONDS)

// ❌ Watchdog DISABLED — fixed 10s TTL, no renewal
lock.tryLock(waitTime, leaseTime, TimeUnit.SECONDS)
```

**Lock Must Be Acquired OUTSIDE @Transactional:**
```java
// ✅ CORRECT: Lock → @Transactional method runs & commits → Unlock
public void creditWallet(...) {        // NO @Transactional here
    lock.lock();
    try {
        doCreditWallet(...);           // @Transactional — commits DB before returning
    } finally {
        lock.unlock();                 // Unlock AFTER DB commit complete
    }
}

// ❌ WRONG: Lock inside @Transactional — lock releases before DB commits!
@Transactional
public void creditWallet(...) {
    lock.lock();
    try { ... }
    finally { lock.unlock(); }         // Released here, but DB commits AFTER method returns!
}
```

---

### Concept 3: RedissonMultiLock (P2P Transfer — Two Wallets)

**Where Used:** `P2PTransferService.transfer()`

**Problem It Solves:** To safely transfer from Alice → Bob, we must lock BOTH wallets simultaneously. The classic deadlock:
```
Thread 1 (Alice→Bob):   Locks Alice ──► Waiting for Bob  ┐
Thread 2 (Bob→Alice):   Locks Bob   ──► Waiting for Alice ┘  DEADLOCK!
Both threads freeze forever!
```

**How MultiLock Prevents Deadlocks:**
```
MultiLock tries to acquire [lock:wallet:Alice, lock:wallet:Bob] ATOMICALLY:
  ✅ Both available → Acquires both instantly → Thread proceeds
  ❌ Bob unavailable after 5s → Releases Alice lock → Back off → Retry
     No partial locks = No deadlocks. Ever.
```

**Code Pattern Used:**
```java
RLock senderLock   = redissonClient.getLock("lock:wallet:" + senderId);
RLock receiverLock = redissonClient.getLock("lock:wallet:" + receiverId);
RLock multiLock    = redissonClient.getMultiLock(senderLock, receiverLock);

boolean acquired = multiLock.tryLock(5, TimeUnit.SECONDS);
if (!acquired) throw new IllegalStateException("Wallets busy, retry");
try {
    doTransfer(request);  // @Transactional: debit+credit+2 ledger entries
} finally {
    if (multiLock.isHeldByCurrentThread()) multiLock.unlock();
}
```

**The 8-Step Transfer Flow (inside the MultiLock):**
1. Redis idempotency check (`SET NX 120s`)
2. Verify sender's transaction PIN (BCrypt)
3. Load sender and receiver wallets from DB
4. Check: wallet not frozen, sufficient balance, daily limit not exceeded
5. Debit sender (`available_balance -= amount`)
6. Credit receiver (`available_balance += amount`)
7. Write DEBIT ledger entry for sender
8. Write CREDIT ledger entry for receiver

---

### Concept 4: IdempotencyService (Redis SET NX)

**Where Used:** `IdempotencyService.checkAndMark()` — called at the start of every P2P transfer.

**Problem It Solves:** Networks fail. Users double-click. Mobile apps retry on timeout. Without idempotency, one button click could result in two transfers.

**How It Works:**
```
First request with key "abc-uuid-123":
  Redis: SET idempotency:abc-uuid-123 "1" NX EX 120
  → Returns TRUE (key didn't exist → fresh request → proceed!)

Second request with SAME key (within 120s):
  Redis: SET idempotency:abc-uuid-123 "1" NX EX 120
  → Returns FALSE (key already exists → duplicate → throw 409 Conflict)

After 120 seconds:
  Redis auto-expires the key.
  A new request with this key would be treated as fresh.
```

**Why SET NX is Atomic:**
Redis processes SET NX as a single CPU instruction. Even if 100 concurrent requests arrive at the same millisecond with the same key, only ONE will receive `TRUE`. This is guaranteed by Redis's single-threaded command execution — no two threads can both "win" the NX check.

---

### Concept 5: Optimistic Locking — `@Version` on Wallet Entity

**Where Used:** `Wallet.java` — `@Version private Long version;`

**How It Works:**
- Every time a Wallet row is loaded, Hibernate reads the `version` column value (e.g., `version=5`).
- When saving, Hibernate executes: `UPDATE wallets SET ... WHERE id=? AND version=5`
- If two transactions loaded `version=5` simultaneously:
  - First one saves → DB version becomes `6`
  - Second one tries: `UPDATE ... WHERE version=5` → **0 rows affected** → `OptimisticLockException`

**Role in PayNexus:**
- Redisson is the **primary defense** (prevents concurrent access entirely).
- `@Version` is the **secondary defense** — catches any edge case where Redisson might not be used (e.g., admin operations, future code paths).
- Two layers = maximum financial safety.

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `name` | VARCHAR(100) | User's full name |
| `email` | VARCHAR(150) UNIQUE | Login identifier |
| `password_hash` | VARCHAR(255) | BCrypt hash of password |
| `transaction_pin_hash` | VARCHAR(255) | BCrypt hash of 6-digit PIN (NULL until set) |
| `kyc_status` | VARCHAR(20) | PENDING/SUBMITTED/VERIFIED/REJECTED |
| `is_active` | BOOLEAN | Soft delete flag |
| `created_at` | TIMESTAMP | Immutable |
| `updated_at` | TIMESTAMP | Auto-updated on change |

### `wallets`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK UNIQUE | One wallet per user |
| `available_balance` | NUMERIC(15,2) | Spendable money (≥ 0) |
| `reserved_balance` | NUMERIC(15,2) | Locked for stock orders (≥ 0) |
| `currency` | VARCHAR(3) | Always "INR" in V1 |
| `is_frozen` | BOOLEAN | Admin-controlled freeze |
| `daily_spent` | NUMERIC(15,2) | Resets at midnight |
| `daily_limit` | NUMERIC(15,2) | Default ₹50,000 |
| `version` | BIGINT | Hibernate optimistic lock counter |
| `created_at` | TIMESTAMP | Immutable |

### `ledger_entries`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `wallet_id` | UUID FK | References wallets |
| `transaction_type` | VARCHAR(16) | CREDIT/DEBIT/HOLD/RELEASE |
| `amount` | NUMERIC(15,2) | Always > 0 |
| `running_balance` | NUMERIC(15,2) | Balance after this entry |
| `reference_id` | VARCHAR(100) UNIQUE | Idempotency key — prevents duplicate entries |
| `narration` | VARCHAR(255) | Human-readable description |
| `related_user_id` | UUID | Other party in P2P (nullable) |
| `created_at` | TIMESTAMP | NEVER updated |

### `user_kyc`
Text-based identity verification — **no file uploads, no S3 required**.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK UNIQUE | One-to-one with users |
| `pan_number` | VARCHAR(10) | Format: `ABCDE1234F`. 4th char = `'P'` for individuals |
| `aadhaar_last_four` | VARCHAR(4) | Last 4 digits only (privacy — full Aadhaar never stored) |
| `date_of_birth` | DATE | Must be ≥ 18 years ago at submission time |
| `submitted_at` | TIMESTAMP | When user submitted |
| `reviewed_at` | TIMESTAMP | When admin reviewed (nullable) |
| `remarks` | VARCHAR(500) | Admin approval/rejection reason |

---

## Exception Handling Reference

All exceptions are handled centrally by `GlobalExceptionHandler` and converted to:
```json
{ "success": false, "message": "<description>", "data": null }
```

| Exception Class | HTTP Status | When Thrown |
|-----------------|-------------|-------------|
| `InsufficientBalanceException` | 422 | Available balance < requested amount |
| `WalletFrozenException` | 403 | Wallet is frozen by admin |
| `DailyLimitExceededException` | 422 | Daily spend limit would be exceeded |
| `DuplicateIdempotencyKeyException` | 409 | Same idempotency key used within 120s |
| `UserNotFoundException` | 404 | User ID doesn't exist |
| `WalletNotFoundException` | 404 | Wallet ID / user's wallet doesn't exist |
| `InvalidPinException` | 401 | Wrong PIN or PIN not set |
| `EmailAlreadyExistsException` | 409 | Email already registered |
| `WebhookVerificationException` | 400 | Invalid Razorpay HMAC signature |
| `PaymentInitiationException` | 502 | Razorpay API call failed |
| `MethodArgumentNotValidException` | 400 | Bean Validation failure on request body |
| `Exception` (catch-all) | 500 | Unexpected server errors |

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Migration tool | **Flyway** | Plain SQL files, no XML, zero learning curve |
| Password/PIN hashing | **BCrypt (strength=10)** | Industry standard, one-way, salt included |
| Security library | **spring-security-crypto only** | No endpoint lockdown in V1; full Keycloak in V3 |
| P2P Locking | **RedissonMultiLock** | Atomically locks both wallets — deadlock-proof |
| Webhook idempotency | **Redis SET NX (48h TTL)** | Razorpay retries webhooks; Redis SET NX is atomic |
| Schema management | **Flyway** | `ddl-auto: validate` in production — never `create` or `update` |
| Ledger design | **Append-only, no setters** | Immutable audit trail — no financial record ever modified |
| Daily limit reset | **@Scheduled midnight cron** | `resetAllDailySpent()` resets all wallet daily_spent to 0 |
