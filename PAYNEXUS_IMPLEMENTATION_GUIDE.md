# 🏗️ PayNexus: Complete Implementation Guide
### Your Backend-Focused Learning Roadmap — From Zero to Production-Ready FinTech Platform

> **Your Skill Context**: Microservices core (Eureka, Feign, Gateway, Config Server, Resilience4j) ✅ ready to build. Kafka deferred to V2. Security (Keycloak/JWT) deferred to V3.

---

## 📑 Table of Contents

1. [Project Philosophy & What You Will Learn](#1-project-philosophy--what-you-will-learn)
2. [Trimmed Architecture (4 Services)](#2-trimmed-architecture-4-services)
3. [Build Phases Overview](#3-build-phases-overview)
4. [What the User Can Do on the Website](#4-what-the-user-can-do-on-the-website)
5. [External APIs & What We Get From Them](#5-external-apis--what-we-get-from-them)
6. [Phase V1 — Core Backend (Start Here)](#6-phase-v1--core-backend-start-here)
7. [Database Schemas — Complete](#7-database-schemas--complete)
8. [REST API Endpoints — All Services](#8-rest-api-endpoints--all-services)
9. [The Stock Order Saga Flow (Core Technical Achievement)](#9-the-stock-order-saga-flow-core-technical-achievement)
10. [Upstox Integration — OAuth + Live Feed](#10-upstox-integration--oauth--live-feed)
11. [Razorpay Integration — Wallet Top-Up Flow](#11-razorpay-integration--wallet-top-up-flow)
12. [Phase V2 — Kafka Event Bus (Add-On Layer)](#12-phase-v2--kafka-event-bus-add-on-layer)
13. [Phase V3 — Security Layer (Keycloak + JWT)](#13-phase-v3--security-layer-keycloak--jwt)
14. [Week-by-Week Build Sequence](#14-week-by-week-build-sequence)
15. [Docker Compose Setup](#15-docker-compose-setup)
16. [Resume Bullet Points & Interview Answers](#16-resume-bullet-points--interview-answers)

---

## 1. Project Philosophy & What You Will Learn

### The Core Problem PayNexus Solves (For Your Interview)
Most student projects are isolated CRUD apps. PayNexus is different because **financial operations span multiple independent services** and money cannot be lost or duplicated. This forces you to solve real distributed systems problems.

### Skills You Will Have After This Project

| Skill | Where You Learn It |
|---|---|
| Spring Cloud Gateway (rate limiting, routing, proxying) | API Gateway service |
| OpenFeign with Resilience4j circuit breakers | Order Engine to Wallet calls |
| Distributed locking with Redisson | Wallet concurrency control |
| Double-entry immutable ledger | Wallet DB design |
| Idempotent API design | All financial endpoints |
| Distributed Saga Pattern (compensating transactions) | Stock purchase flow |
| OAuth 2.0 Authorization Code Flow | Upstox integration |
| Razorpay Webhook HMAC-SHA256 validation | Payment integration |
| Apache Kafka (async event bus) | V2 phase |
| Keycloak / JWT security | V3 phase |
| Docker Compose multi-service local setup | Throughout |

---

## 2. Trimmed Architecture (4 Services)

Based on our discussion, we are NOT building 10 services. We are building **4 focused services** that cover **all the same distributed systems concepts** with far less DevOps overhead.

```
                        [ React Frontend (Vibe-Coded) ]
                                      |
                                      | HTTPS / WebSocket
                                      v
                  +------------------------------------------+
                  |        API Gateway  (Port: 8080)         |
                  |  - Route all requests                    |
                  |  - Global Rate Limiting (Redis)          |
                  |  - JWT validation (V3)                   |
                  +------------------+-----------------------+
                                     |
         +---------------------------+-------------------------+
         |                           |                         |
         v                           v                         v
  +----------------+   +------------------------+  +------------------+
  | wallet-service |   | order-engine-service   |  | notif-service    |
  |  Port: 8082    |   |    Port: 8083          |  |  Port: 8084      |
  |                |<--|                        |  |                  |
  | - User Accounts|   | - Stock Orders & P&L   |  | - Email Alerts   |
  | - Ledger       |   | - Live Price Feed      |  | - WS Push Notif  |
  | - P2P Transfer |   | - Market Simulator     |  | - Notif Log      |
  | - Razorpay     |   | - Upstox OAuth         |  |   (MongoDB)      |
  |   Top-ups      |   | - Price Alerts         |  |                  |
  |                |   |                        |  |                  |
  | PostgreSQL     |   | PostgreSQL + Redis      |  | MongoDB          |
  | + Redis        |   |                        |  |                  |
  +----------------+   +------------------------+  +------------------+

  ------------- Supporting Infrastructure ----------------
  Eureka Discovery Server (Port: 8761)
  Spring Cloud Config Server (Port: 8888)
  PostgreSQL (Port: 5432)
  Redis (Port: 6379)
  MongoDB (Port: 27017)
  [V2] Apache Kafka (Port: 9092)
  [V3] Keycloak (Port: 8180)
  [Optional] Zipkin Tracing (Port: 9411)
```

### Why This Architecture Is Still Technically Impressive
Even with 4 services you have:
- Cross-service synchronous HTTP calls (Feign)
- Circuit breakers on those calls (Resilience4j)
- Independent databases per service (DB-per-service pattern)
- Distributed locks (Redisson/Redis)
- Compensation/rollback logic (Saga pattern)
- [V2] Asynchronous event bus (Kafka)
- [V3] Token-based security (Keycloak/JWT)

---

## 3. Build Phases Overview

```
V1: CORE (Build This First — Completable in ~6 weeks)
    API Gateway + Wallet Service + Order Engine + Basic Notif Service
    Razorpay top-up, P2P transfer, stock buy/sell, price alerts
    Upstox OAuth + Strategy Pattern (live feed + simulation fallback)
    Feign + Resilience4j between Order Engine and Wallet
    The full Stock Order Saga (the crown jewel of the project)

V2: KAFKA (Add-On — 1-2 weeks after V1 is solid)
    Replace synchronous notification calls with Kafka events
    Topics: payment.completed, order.placed, order.failed, price.alert.triggered
    Notification service becomes a pure Kafka consumer

V3: SECURITY (Final Polish — 1-2 weeks)
    Add Keycloak as Identity Provider
    JWT validation in API Gateway
    JWT propagation via Feign RequestInterceptor
    Role-based access (USER, ADMIN)
```

---

## 4. What the User Can Do on the Website

This section defines every feature the frontend (vibe-coded) will expose.

### 4.1 Account & Onboarding

| Feature | Description |
|---|---|
| Register | Fill name, email, password. User account + wallet created simultaneously. |
| Login | Email + password. Returns JWT token (V3: via Keycloak). |
| View Profile | See name, email, wallet ID, account creation date. |
| KYC Status | See if KYC is submitted/verified. Stock trading locked until KYC approved. |
| Set Transaction PIN | 6-digit PIN required before any P2P transfer or stock trade. |

### 4.2 Wallet Features

| Feature | Description |
|---|---|
| View Wallet Balance | See Available Balance and Reserved/On-Hold Balance separately. |
| Add Money (Top-up) | Enter amount, Razorpay checkout modal, UPI/card, balance credited. |
| P2P Transfer | Enter recipient user ID + amount + 6-digit PIN — money moves instantly. |
| View Transaction History | Paginated ledger: every CREDIT, DEBIT, HOLD, RELEASE with timestamp and amount. |
| Daily Spend Limit | User can see remaining daily transfer limit (default: Rs.50,000/day). |

### 4.3 Market & Investing Features

| Feature | Description |
|---|---|
| Browse Live Market | List of stocks with live prices ticking every 2 seconds. Market closed = simulation mode auto-activates. |
| View Stock Detail | Current price, day high/low, % change, last 20 price ticks chart. |
| Buy a Stock | Enter quantity, see total cost, confirm with 6-digit PIN, Saga executes. |
| Sell a Stock | Select holding, enter quantity to sell, confirm, Saga executes in reverse. |
| View Portfolio | All holdings: symbol, quantity, avg buy price, current price, unrealized P&L (amount and %). |
| View Order History | Past BUY/SELL orders with status: PENDING, EXECUTED, FAILED, COMPENSATED. |
| Set Price Alert | Choose stock, choose trigger price and direction (above/below), get notified when hit. |
| View Active Alerts | List of all active price alerts. Ability to delete them. |

### 4.4 AI Advisor Features (Auxiliary — Build Last)

| Feature | Description |
|---|---|
| Chat with AI Advisor | Text input, AI sees your live balance + portfolio, gives contextual advice. |
| Conversation History | Past 10 chat sessions stored in MongoDB. |

### 4.5 Notifications

| Feature | Description |
|---|---|
| Notification Bell | Shows unread count in UI. Click to see list. |
| In-App Notifications | Wallet credited, transfer received, order executed, price alert triggered. |
| Email Notifications | [V2 Kafka] Transaction receipts via SendGrid. |

### 4.6 Admin Panel

| Feature | Description |
|---|---|
| Connect Upstox | Button that initiates the OAuth flow. One click every trading morning. |
| Market Feed Status | Shows if system is in LIVE (Upstox) or SIMULATION mode. |
| KYC Approval | View pending KYC requests, approve or reject. |
| Freeze/Unfreeze Wallet | Admin can freeze a user's wallet for fraud prevention. |

---

## 5. External APIs & What We Get From Them

### 5.1 Upstox API (Stock Market Data)

**Account**: Create at https://developer.upstox.com  
**Cost**: Free for sandbox/paper trading

| Data Point | API Used | How We Use It |
|---|---|---|
| Live stock prices (every few seconds) | WebSocket wss://api.upstox.com/v2/feed/market-data-feed | Stream into Redis, broadcast to frontend |
| Stock snapshot (one-time price fetch) | GET /v2/market-quote/quotes | Used when placing order to lock price |
| Historical candle data | GET /v2/historical-candle/{instrumentKey}/1minute | Price history charts in UI |

**The OAuth Flow (run once every trading morning):**
```
1. You click "Connect Upstox" in Admin Panel
2. Backend redirects browser to:
   https://api.upstox.com/v2/login/authorization/dialog
   ?client_id=YOUR_API_KEY
   &redirect_uri=http://localhost:8080/api/v1/admin/upstox/callback
   &response_type=code

3. You log in with mobile + OTP on Upstox screen
4. Upstox redirects to YOUR backend:
   http://localhost:8080/api/v1/admin/upstox/callback?code=abc123

5. Your backend exchanges code for access_token (one HTTP POST)
6. Saves to Redis: SET upstox:access_token "eyJhbGciOi..." EX 86400
7. WebSocket client picks up token and starts streaming
```

**Fallback (Simulation Mode)**: When `upstox:access_token` is missing or market is outside 9:15–15:30 IST, a Spring `@Scheduled` task fires every 2 seconds, takes 10 hardcoded stocks, and applies a random +-0.2% fluctuation. This feeds into Redis exactly the same as real prices.

### 5.2 Razorpay Payment Gateway (Wallet Top-Up)

**Account**: https://dashboard.razorpay.com  
**Cost**: Free test mode. Use test UPI ID: `success@razorpay`

| What | How |
|---|---|
| order_id | We call Razorpay server-side to create a payment order |
| payment_id, signature | Razorpay sends these to your WEBHOOK after payment success |
| HMAC-SHA256 Signature | We verify this to ensure the webhook is genuinely from Razorpay |

**Complete Top-Up Flow:**
```
1. User enters Rs.5,000 in UI and clicks "Add Money"
2. Backend: POST to Razorpay, receive order_id
3. Backend returns order_id to frontend
4. Frontend opens Razorpay Checkout modal (their JS widget)
5. User completes payment (test UPI: success@razorpay)
6. Razorpay sends WEBHOOK POST to: /api/v1/payments/webhook
7. Your backend: verify HMAC-SHA256 signature
8. If valid: credit Rs.5,000 to user wallet
9. Write CREDIT entry to ledger
10. Notify user
```

### 5.3 SendGrid (Email Notifications — V2)

**Account**: https://sendgrid.com  
**Cost**: Free tier = 100 emails/day

Emails sent for: Payment receipt, transfer confirmation, price alert triggered, order execution.

### 5.4 OpenAI via Spring AI (Auxiliary Feature)

**Account**: https://platform.openai.com  
**Cost**: ~$0.001 per chat query with GPT-4o-mini

Before sending user query to OpenAI, fetch: (a) wallet balance from wallet-service, (b) portfolio holdings from order-engine-service. Prepend that data to system prompt for full financial context. Stream response back via Server-Sent Events (SSE).

---

## 6. Phase V1 — Core Backend (Start Here)

### Service 1: API Gateway

**Port**: 8080  
**Dependencies**: Spring Cloud Gateway, Eureka Client, Redis (rate limiting)

**Responsibilities:**
- Route all incoming requests to correct downstream service
- Global rate limiting (20 requests/second per IP via Redis token bucket)
- V3: Validate JWT tokens from Keycloak before forwarding

**Route Configuration (application.yml):**
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: wallet-service
          uri: lb://WALLET-SERVICE
          predicates:
            - Path=/api/v1/wallet/**,/api/v1/payments/**,/api/v1/users/**

        - id: order-engine-service
          uri: lb://ORDER-ENGINE-SERVICE
          predicates:
            - Path=/api/v1/orders/**,/api/v1/market/**,/api/v1/portfolio/**,/api/v1/alerts/**,/api/v1/admin/upstox/**

        - id: notification-service
          uri: lb://NOTIFICATION-SERVICE
          predicates:
            - Path=/api/v1/notifications/**

      default-filters:
        - name: RequestRateLimiter
          args:
            redis-rate-limiter.replenishRate: 20
            redis-rate-limiter.burstCapacity: 40
```

---

### Service 2: Wallet Service

**Port**: 8082  
**Database**: PostgreSQL + Redis  
**Dependencies**: Spring Data JPA, Redisson, Eureka Client, Razorpay Java SDK, OpenFeign

**Core Responsibilities:**
1. Manage user accounts and wallet balances
2. Atomic double-entry ledger for all financial operations
3. Distributed locking during concurrent transfers (Redisson)
4. Razorpay webhook verification and balance crediting
5. P2P transfers with idempotency

**Key Design Decisions:**
- **Two balance columns**: `available_balance` and `reserved_balance` — money moves to reserved during stock orders
- **Immutable ledger**: Never UPDATE a ledger row. Every financial event is a new INSERT
- **Optimistic locking**: `@Version` on the Wallet entity prevents lost updates under concurrency
- **Idempotency**: Every POST endpoint that changes money requires `X-Idempotency-Key` header. Key cached in Redis for 120 seconds

---

### Service 3: Order Engine Service

**Port**: 8083  
**Database**: PostgreSQL + Redis  
**Dependencies**: Spring Data JPA, OpenFeign, Resilience4j, Spring WebSocket, Upstox SDK

**Core Responsibilities:**
1. Handle BUY and SELL stock orders
2. Orchestrate the Stock Order Saga (coordinate with wallet-service via Feign)
3. Maintain current portfolio holdings per user
4. Calculate real-time P&L
5. Manage price alerts
6. Run the Upstox WebSocket connection OR the Market Simulation engine
7. Handle the Upstox OAuth callback

**The Market Feed Strategy Pattern (Critical Design):**
```java
@Configuration
public class MarketFeedConfig {

    @Value("${market.feed.provider:simulation}")
    private String provider;

    @Bean
    public MarketFeedProvider marketFeedProvider(
            UpstoxLiveMarketFeed live,
            SimulatedMarketFeed simulation,
            RedisTemplate<String, String> redis) {

        if ("upstox".equals(provider)) {
            String token = redis.opsForValue().get("upstox:access_token");
            if (token != null) return live;
        }
        return simulation;
    }
}
```

```yaml
# application.yml
market:
  feed:
    provider: simulation   # Change to 'upstox' when live token is available
```

---

### Service 4: Notification Service

**Port**: 8084  
**Database**: MongoDB  
**Dependencies**: Spring Data MongoDB, Spring Web, SendGrid (V2)

**V1**: Called directly by other services via Feign after a transaction completes. Stores notification in MongoDB.  
**V2**: Becomes a pure Kafka consumer. No longer called via Feign.

---

## 7. Database Schemas — Complete

### 7.1 Wallet Service — PostgreSQL

```sql
-- Users Table
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(100) NOT NULL,
    email                VARCHAR(150) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    transaction_pin_hash VARCHAR(255),
    kyc_status           VARCHAR(20) DEFAULT 'PENDING',
    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets Table
CREATE TABLE wallets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID UNIQUE NOT NULL REFERENCES users(id),
    available_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    reserved_balance  DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency          VARCHAR(3) DEFAULT 'INR',
    is_frozen         BOOLEAN DEFAULT FALSE,
    daily_spent       DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    daily_limit       DECIMAL(15, 2) NOT NULL DEFAULT 50000.00,
    version           BIGINT NOT NULL DEFAULT 0,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Immutable Double-Entry Ledger
-- RULE: Only INSERT here. Never UPDATE or DELETE.
CREATE TABLE ledger_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        UUID NOT NULL REFERENCES wallets(id),
    transaction_type VARCHAR(16) NOT NULL,   -- CREDIT | DEBIT | HOLD | RELEASE
    amount           DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    running_balance  DECIMAL(15, 2) NOT NULL,
    reference_id     VARCHAR(100) NOT NULL UNIQUE,  -- idempotency key
    narration        TEXT,
    related_user_id  UUID,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KYC Documents Table
CREATE TABLE kyc_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    doc_type     VARCHAR(20) NOT NULL,   -- PAN | AADHAAR
    doc_number   VARCHAR(20) NOT NULL,
    status       VARCHAR(20) DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at  TIMESTAMP WITH TIME ZONE
);
```

### 7.2 Order Engine Service — PostgreSQL

```sql
-- Stock Orders Table
CREATE TABLE stock_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    order_type      VARCHAR(10) NOT NULL,   -- BUY | SELL
    quantity        INT NOT NULL CHECK (quantity > 0),
    requested_price DECIMAL(10, 2) NOT NULL,
    executed_price  DECIMAL(10, 2),
    total_value     DECIMAL(15, 2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING -> FUNDS_RESERVED -> EXECUTED -> FAILED -> COMPENSATED
    wallet_hold_ref VARCHAR(100),
    failure_reason  TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Holdings Table (Current Portfolio)
CREATE TABLE holdings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL,
    symbol         VARCHAR(20) NOT NULL,
    quantity       INT NOT NULL DEFAULT 0,
    avg_buy_price  DECIMAL(10, 2) NOT NULL,
    total_invested DECIMAL(15, 2) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_symbol UNIQUE (user_id, symbol)
);

-- Price Alerts Table
CREATE TABLE price_alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    symbol       VARCHAR(20) NOT NULL,
    target_price DECIMAL(10, 2) NOT NULL,
    direction    VARCHAR(10) NOT NULL,   -- ABOVE | BELOW
    is_active    BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7.3 Notification Service — MongoDB

```json
{
  "_id": "ObjectId",
  "userId": "UUID string",
  "eventType": "string",
  "title": "string",
  "message": "string",
  "channel": "IN_APP | EMAIL | IN_APP_AND_EMAIL",
  "isRead": false,
  "metadata": {
    "amount": 5000,
    "symbol": "RELIANCE",
    "referenceId": "pay_QW12345"
  },
  "createdAt": "ISODate"
}
```

Possible eventTypes: `WALLET_CREDITED | WALLET_DEBITED | TRANSFER_SENT | TRANSFER_RECEIVED | ORDER_EXECUTED | ORDER_FAILED | PRICE_ALERT_TRIGGERED | KYC_STATUS_CHANGED`

---

## 8. REST API Endpoints — All Services

> **Note**: In V1, all endpoints are open (no auth). In V3, JWT Bearer token required for all except login/register.
> 
> **Idempotency Rule**: All endpoints that change financial state require the `X-Idempotency-Key: <uuid>` header.

### 8.1 Wallet Service (`/api/v1`)

#### User Endpoints
```
POST   /users/register                   Register new user + auto-create wallet
POST   /users/login                      Login, returns JWT (V3) or just userId (V1)
GET    /users/{userId}/profile           Get user profile
PUT    /users/{userId}/pin               Set or update 6-digit transaction PIN
GET    /users/{userId}/kyc-status        Check KYC status
POST   /users/{userId}/kyc               Submit KYC documents (PAN + Aadhaar)
```

#### Wallet Endpoints
```
GET    /wallet/{userId}                  Get wallet details (available + reserved balance)
GET    /wallet/{userId}/ledger           Paginated ledger history (?page=0&size=20)
GET    /wallet/{userId}/ledger/summary   Aggregated totals: credits and debits
```

#### Payment Endpoints (Razorpay Top-Up)
```
POST   /payments/initiate                Create Razorpay order_id for top-up
                                         Body: { userId, amount }
                                         Returns: { orderId, amount, currency, key }

POST   /payments/webhook                 Razorpay webhook receiver (public, no auth)
                                         Verifies HMAC-SHA256 and credits wallet
```

#### Internal Feign Endpoints (Called by Order Engine only, not in gateway)
```
POST   /internal/wallet/hold             Reserve funds for a stock order
                                         Body: { userId, amount, referenceId }

POST   /internal/wallet/settle           Convert hold to permanent DEBIT after order success
                                         Body: { holdId, userId }

POST   /internal/wallet/release          Release hold back to available after order failure
                                         Body: { holdId, userId }

POST   /internal/wallet/credit           Credit wallet (after stock SELL)
                                         Body: { userId, amount, narration, referenceId }

GET    /internal/wallet/{userId}/balance  Get current balance (for AI advisor feign call)
```

#### Admin Endpoints
```
PUT    /admin/users/{userId}/freeze      Freeze a user's wallet
PUT    /admin/users/{userId}/unfreeze    Unfreeze a user's wallet
GET    /admin/kyc/pending               List all users with KYC status = SUBMITTED
PUT    /admin/kyc/{userId}/approve       Approve KYC
PUT    /admin/kyc/{userId}/reject        Reject KYC
```

---

### 8.2 Order Engine Service (`/api/v1`)

#### Market Data Endpoints
```
GET    /market/prices                    Get latest cached prices for all tracked stocks
GET    /market/prices/{symbol}           Get price detail for one stock (+ last 20 ticks)
GET    /market/feed-status               Returns: { mode: "LIVE" | "SIMULATION", lastUpdated }
GET    /admin/upstox/connect             Initiates Upstox OAuth (redirects to Upstox login)
GET    /admin/upstox/callback            Upstox OAuth callback (gets token, saves to Redis)
```

#### Order Endpoints
```
POST   /orders/buy                       Place a BUY order (triggers Saga)
                                         Header: X-Idempotency-Key
                                         Body: { userId, symbol, quantity, transactionPin }
                                         Returns: { orderId, status, totalValue, message }

POST   /orders/sell                      Place a SELL order (triggers Saga in reverse)
                                         Header: X-Idempotency-Key
                                         Body: { userId, symbol, quantity, transactionPin }

GET    /orders/{userId}/history          Paginated order history (?page=0&size=20&status=EXECUTED)
```

#### Portfolio Endpoints
```
GET    /portfolio/{userId}               Full portfolio with live P&L
                                         Returns holdings with currentPrice from Redis,
                                         unrealizedPnL, totalInvested, currentValue, totalPnL

GET    /portfolio/{userId}/holdings      Just the holdings list (no live price computation)
```

#### Price Alert Endpoints
```
POST   /alerts                           Create a price alert
                                         Body: { userId, symbol, targetPrice, direction: "ABOVE"|"BELOW" }

GET    /alerts/{userId}                  Get all active alerts for a user
DELETE /alerts/{alertId}                 Delete an alert
```

---

### 8.3 Notification Service (`/api/v1`)

```
GET    /notifications/{userId}                Paginated notifications (?page=0&size=20)
PUT    /notifications/{notificationId}/read   Mark one notification as read
PUT    /notifications/{userId}/read-all       Mark all as read
GET    /notifications/{userId}/unread-count   Get unread count for bell icon badge

POST   /internal/notifications/create         [Internal Feign] Create and store a notification
                                              Body: { userId, eventType, title, message, channel, metadata }
```

---

## 9. The Stock Order Saga Flow (Core Technical Achievement)

### What is a Saga?
A Saga maintains data consistency across multiple independent services without a distributed transaction. If any step fails, we run **compensating transactions** to undo previous steps.

### BUY Order Saga — Step by Step

```
User sends: POST /api/v1/orders/buy
Body: { userId: "U1", symbol: "RELIANCE", quantity: 5, transactionPin: "123456" }

STEP 0: Pre-checks in order-engine-service
  - Verify transaction PIN (Feign call to wallet-service)
  - Check KYC is VERIFIED
  - Fetch current price from Redis: Rs.2,450 -> Total = Rs.12,250

STEP 1: Reserve Funds (HOLD)
  - Generate idempotency ref: hold_ref = UUID.randomUUID()
  - Call wallet-service via Feign: POST /internal/wallet/hold
    Body: { userId: "U1", amount: 12250, referenceId: hold_ref }
  - wallet-service:
    - Acquires Redisson distributed lock on "wallet:lock:U1"
    - Checks: available_balance (Rs.15,000) >= Rs.12,250
    - available_balance -= 12250 -> Rs.2,750
    - reserved_balance += 12250 -> Rs.12,250
    - INSERTs HOLD ledger entry
    - Releases lock. Returns { success: true }
  - order-engine saves: Order{ status: FUNDS_RESERVED, holdRef: hold_ref }

STEP 2: Execute the Order
  - order-engine-service performs internal order matching
  - For paper trading: treat locked price as execution price
  - 99% success -> proceed to STEP 3
  - If failure -> jump to COMPENSATION

STEP 3: Settlement (SUCCESS PATH)
  - Call wallet-service Feign: POST /internal/wallet/settle
    Body: { holdId: hold_ref, userId: "U1" }
  - wallet-service:
    - reserved_balance -= 12250 -> Rs.0
    - Writes DEBIT ledger entry
  - order-engine-service:
    - Creates/updates Holdings record
    - Updates Order status: EXECUTED
    - Notifies notification-service: ORDER_EXECUTED
  - Returns: { orderId, status: "EXECUTED", message: "5 RELIANCE bought at Rs.2,450" }

COMPENSATION PATH (If STEP 2 fails):
  - Call wallet-service Feign: POST /internal/wallet/release
    Body: { holdId: hold_ref, userId: "U1" }
  - wallet-service:
    - reserved_balance -= 12250 -> Rs.0
    - available_balance += 12250 -> Rs.15,000 (restored)
    - INSERTs RELEASE ledger entry
  - Order status updated: COMPENSATED
  - Returns: { orderId, status: "FAILED", message: "Order failed. Funds released." }
```

### SELL Order Saga

```
STEP 1: Validate holding (user must have >= quantity they want to sell)
STEP 2: Mark holding as PENDING_SELL to prevent duplicate sell
STEP 3: Calculate proceeds = quantity * currentPrice
STEP 4: Credit proceeds to wallet: POST /internal/wallet/credit
STEP 5: Update holding (reduce quantity, or delete if quantity == 0)
STEP 6: Update Order status to EXECUTED
COMPENSATION: If wallet credit fails -> restore holding quantity, mark Order COMPENSATED
```

### Resilience4j Circuit Breaker Configuration

```yaml
# order-engine-service/application.yml
resilience4j:
  circuitbreaker:
    instances:
      walletService:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 5s
        permittedNumberOfCallsInHalfOpenState: 3
  retry:
    instances:
      walletService:
        maxAttempts: 2
        waitDuration: 500ms
```

### Feign Client With Fallback

```java
@FeignClient(name = "WALLET-SERVICE", fallbackFactory = WalletFallbackFactory.class)
public interface WalletServiceClient {

    @PostMapping("/internal/wallet/hold")
    HoldResponse holdFunds(@RequestBody HoldRequest request);

    @PostMapping("/internal/wallet/settle")
    SettleResponse settleFunds(@RequestBody SettleRequest request);

    @PostMapping("/internal/wallet/release")
    ReleaseResponse releaseFunds(@RequestBody ReleaseRequest request);
}

@Component
public class WalletFallbackFactory implements FallbackFactory<WalletServiceClient> {
    @Override
    public WalletServiceClient create(Throwable cause) {
        return new WalletServiceClient() {
            @Override
            public HoldResponse holdFunds(HoldRequest request) {
                throw new ServiceUnavailableException("Wallet service unavailable. Order cancelled.");
            }
            // implement other methods similarly
        };
    }
}
```

---

## 10. Upstox Integration — OAuth + Live Feed

### Step 1: Register Your App on Upstox Developer Portal
1. Go to https://developer.upstox.com
2. Create a new app
3. Set Redirect URL to: `http://localhost:8080/api/v1/admin/upstox/callback`
4. Copy your API Key (client_id) and API Secret (client_secret)
5. Add them to application.yml using environment variables — NEVER hardcode or commit:

```yaml
upstox:
  client-id: ${UPSTOX_CLIENT_ID}
  client-secret: ${UPSTOX_CLIENT_SECRET}
  redirect-uri: http://localhost:8080/api/v1/admin/upstox/callback
  auth-url: https://api.upstox.com/v2/login/authorization/dialog
  token-url: https://api.upstox.com/v2/login/authorization/token
```

### Step 2: OAuth Controller in Order Engine Service

```java
@RestController
@RequestMapping("/api/v1/admin/upstox")
public class UpstoxAuthController {

    @Value("${upstox.client-id}") private String clientId;
    @Value("${upstox.client-secret}") private String clientSecret;
    @Value("${upstox.redirect-uri}") private String redirectUri;

    @Autowired
    private StringRedisTemplate redisTemplate;

    // Step 1: Admin clicks this -> redirected to Upstox login
    @GetMapping("/connect")
    public RedirectView connect() {
        String upstoxLoginUrl = "https://api.upstox.com/v2/login/authorization/dialog"
            + "?client_id=" + clientId
            + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
            + "&response_type=code";
        return new RedirectView(upstoxLoginUrl);
    }

    // Step 2: Upstox calls this with authorization code
    @GetMapping("/callback")
    public ResponseEntity<String> callback(@RequestParam("code") String code) {
        RestClient client = RestClient.create();

        UpstoxTokenResponse tokenResponse = client.post()
            .uri("https://api.upstox.com/v2/login/authorization/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body("code=" + code + "&client_id=" + clientId
                + "&client_secret=" + clientSecret
                + "&redirect_uri=" + redirectUri
                + "&grant_type=authorization_code")
            .retrieve()
            .body(UpstoxTokenResponse.class);

        // Save in Redis with 24-hour TTL
        redisTemplate.opsForValue()
            .set("upstox:access_token", tokenResponse.getAccessToken(), Duration.ofHours(24));

        return ResponseEntity.ok("Upstox connected! Live market data is now active.");
    }
}
```

### Step 3: The Simulated Market Feed

```java
@Component
public class SimulatedMarketFeed {

    private static final List<String> SYMBOLS = List.of(
        "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO",
        "WIPRO", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY50"
    );

    private final Map<String, Double> prices = new HashMap<>(Map.of(
        "RELIANCE", 2450.0, "TCS", 3800.0, "INFY", 1620.0,
        "HDFCBANK", 1710.0, "ZOMATO", 221.0, "WIPRO", 465.0,
        "ICICIBANK", 1230.0, "SBIN", 810.0, "TATAMOTORS", 940.0,
        "NIFTY50", 24800.0
    ));

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Scheduled(fixedDelay = 2000)
    public void emitTicks() {
        Random rand = new Random();
        for (String symbol : SYMBOLS) {
            double current = prices.get(symbol);
            double change = current * (rand.nextGaussian() * 0.002);
            double newPrice = Math.max(current + change, 1.0);
            prices.put(symbol, newPrice);
            redisTemplate.opsForValue().set("price:" + symbol, String.valueOf(newPrice));
        }
        checkPriceAlerts();
    }
}
```

The Upstox live feed implementation writes to the exact same Redis keys (`price:SYMBOL`), so the rest of the system is identical regardless of which feed is active.

---

## 11. Razorpay Integration — Wallet Top-Up Flow

```xml
<!-- pom.xml in wallet-service -->
<dependency>
    <groupId>com.razorpay</groupId>
    <artifactId>razorpay-java</artifactId>
    <version>1.4.5</version>
</dependency>
```

```yaml
razorpay:
  key-id: ${RAZORPAY_KEY_ID}
  key-secret: ${RAZORPAY_KEY_SECRET}
  webhook-secret: ${RAZORPAY_WEBHOOK_SECRET}
```

### Create Order Endpoint
```java
@PostMapping("/payments/initiate")
public ResponseEntity<InitiatePaymentResponse> initiatePayment(@RequestBody InitiatePaymentRequest req) {
    RazorpayClient razorpay = new RazorpayClient(keyId, keySecret);

    JSONObject orderRequest = new JSONObject();
    orderRequest.put("amount", req.getAmount() * 100);  // in paise
    orderRequest.put("currency", "INR");
    orderRequest.put("receipt", "order_" + UUID.randomUUID());
    orderRequest.put("notes", new JSONObject().put("userId", req.getUserId()));

    Order order = razorpay.orders.create(orderRequest);

    return ResponseEntity.ok(new InitiatePaymentResponse(
        order.get("id"), req.getAmount(), "INR", keyId
    ));
}
```

### Webhook Receiver
```java
@PostMapping("/payments/webhook")
public ResponseEntity<String> handleWebhook(
        @RequestBody String payload,
        @RequestHeader("X-Razorpay-Signature") String signature) {

    // 1. Verify signature
    boolean isValid = Utils.verifyWebhookSignature(payload, signature, webhookSecret);
    if (!isValid) return ResponseEntity.badRequest().body("Invalid signature");

    JSONObject event = new JSONObject(payload);
    if ("payment.captured".equals(event.getString("event"))) {
        JSONObject payment = event.getJSONObject("payload")
                                   .getJSONObject("payment")
                                   .getJSONObject("entity");

        String paymentId = payment.getString("id");
        double amount    = payment.getInt("amount") / 100.0;
        String userId    = payment.getJSONObject("notes").getString("userId");

        // 2. Idempotency check
        if (Boolean.TRUE.equals(redisTemplate.hasKey("processed:webhook:" + paymentId))) {
            return ResponseEntity.ok("Already processed");
        }
        redisTemplate.opsForValue().set("processed:webhook:" + paymentId, "1", Duration.ofHours(48));

        // 3. Credit wallet
        walletService.creditWallet(userId, amount, paymentId, "Wallet top-up via Razorpay");

        // 4. Notify user
        notificationFeignClient.createNotification(new CreateNotificationRequest(
            userId, "WALLET_CREDITED",
            "Rs." + amount + " Added to Wallet",
            "Your wallet was credited Rs." + amount + ". Ref: " + paymentId,
            "IN_APP"
        ));
    }
    return ResponseEntity.ok("OK");
}
```

---

## 12. Phase V2 — Kafka Event Bus (Add-On Layer)

> Build this AFTER V1 is working end-to-end.

### Why Add Kafka?
In V1, services call each other synchronously via Feign even for non-critical operations (notifications). If notification-service is down, the entire operation fails. Kafka decouples these concerns.

### Kafka Topics

| Topic | Producer | Consumer | Payload |
|---|---|---|---|
| `payment.completed` | wallet-service | notification-service | { userId, amount, paymentId } |
| `wallet.transfer.completed` | wallet-service | notification-service | { senderId, receiverId, amount } |
| `order.executed` | order-engine | notification-service | { userId, symbol, quantity, type, executedPrice } |
| `order.failed` | order-engine | notification-service | { userId, symbol, reason } |
| `price.alert.triggered` | order-engine | notification-service | { userId, symbol, targetPrice, currentPrice } |

### What Changes in V2
- Remove `notificationFeignClient.createNotification(...)` calls from wallet-service and order-engine-service
- Replace with `kafkaTemplate.send("payment.completed", event)`
- Notification-service gets a `@KafkaListener` for each topic
- Notification-service still writes to MongoDB and sends emails via SendGrid

### Kafka Config in Docker Compose (uncomment in V2)
```yaml
kafka:
  image: confluentinc/cp-kafka:7.5.0
  ports:
    - "9092:9092"
  environment:
    KAFKA_NODE_ID: 1
    KAFKA_PROCESS_ROLES: broker,controller
    KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093
    KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:29092,CONTROLLER://0.0.0.0:29093,PLAINTEXT_HOST://0.0.0.0:9092
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
    KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
```

---

## 13. Phase V3 — Security Layer (Keycloak + JWT)

> Build this LAST. This is polish, not the core engineering.

### What Changes
1. Keycloak runs on port 8180 in Docker
2. Users register and login via Keycloak
3. Keycloak issues JWT access tokens
4. API Gateway validates every incoming JWT against Keycloak's JWKS endpoint
5. Downstream services extract `userId` from JWT claims
6. Feign JWT Propagation: `RequestInterceptor` copies the Authorization header to all Feign calls

### JWT Propagation Feign Interceptor
```java
@Component
public class FeignJwtInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            template.header("Authorization", "Bearer " + jwtAuth.getToken().getTokenValue());
        }
    }
}
```

**Resource**: Use JavaTechie's Keycloak + Spring Boot playlist (as you planned).

---

## 14. Week-by-Week Build Sequence

### Phase V1 — Target: 6-7 Weeks

```
WEEK 1: Infrastructure Foundation
  - Create Spring Boot parent POM (multi-module Maven project)
  - Create and run: discovery-server (Eureka), config-server
  - Create api-gateway with basic routing to all 3 services
  - Set up Docker Compose: postgres, redis, mongodb
  - Verify: all services register with Eureka, gateway routes work

WEEK 2: Wallet Service — Users & Accounts
  - User entity + UserRepository + UserService
  - POST /users/register (creates user + wallet in one @Transactional)
  - POST /users/login (returns userId for now, JWT in V3)
  - GET /users/{userId}/profile
  - PUT /users/{userId}/pin (BCrypt the PIN)
  - Test: Postman collection for all user endpoints

WEEK 3: Wallet Service — Core Financial Logic
  - Wallet entity with @Version (optimistic locking)
  - LedgerEntry entity (immutable inserts only)
  - P2P Transfer with Redisson distributed lock
    - Acquire lock -> check balance -> @Transactional double debit/credit -> release
    - X-Idempotency-Key check via Redis
  - GET /wallet/{userId} and GET /wallet/{userId}/ledger
  - Test: simulate concurrent transfers

WEEK 4: Payment Service (Razorpay)
  - Integrate Razorpay Java SDK
  - POST /payments/initiate (create Razorpay order)
  - POST /payments/webhook (HMAC verify + credit wallet + notify)
  - Idempotency: Redis cache processed payment IDs
  - Test: use Razorpay test dashboard to simulate webhook

WEEK 5: Order Engine — Market Feed + Price Alerts
  - Create order-engine-service
  - Implement SimulatedMarketFeed with @Scheduled (2s interval)
  - Write prices to Redis (key: "price:SYMBOL")
  - GET /market/prices (reads from Redis)
  - Implement Upstox OAuth callback controller
  - Implement UpstoxLiveMarketFeed (connects to Upstox WebSocket)
  - Implement Strategy Pattern to switch between feeds
  - Implement Price Alert engine (check thresholds after each tick)
  - POST /alerts, GET /alerts/{userId}, DELETE /alerts/{id}

WEEK 6: Order Engine — The Stock Order Saga
  - POST /orders/buy — full Saga implementation
    - Feign call to wallet-service: holdFunds
    - Internal order execution
    - Feign call to wallet-service: settleFunds OR releaseFunds
    - Update holdings table
  - POST /orders/sell — reverse saga
  - GET /portfolio/{userId} — compute P&L using Redis prices
  - GET /orders/{userId}/history
  - Add Resilience4j circuit breaker on all wallet Feign calls
  - Integration test: full buy -> portfolio update -> sell flow

WEEK 7: Notification + Polish
  - Notification service: MongoDB storage + Feign endpoint
  - Wire notifications: wallet top-up, order executed, price alert
  - GET /notifications/{userId}, mark as read
  - End-to-end test: full user flow (register -> top-up -> buy stock -> price alert)
  - Write README.md with architecture diagram
```

### Phase V2 — 1 Week (After V1 Complete)
```
WEEK 8:
  - Add Kafka to Docker Compose
  - Replace Feign notification calls with Kafka producers in wallet-service and order-engine
  - Notification-service: add @KafkaListener for all topics
  - Add SendGrid email on payment.completed event
  - Verify notifications still work
```

### Phase V3 — 1 Week (Final Polish)
```
WEEK 9:
  - Add Keycloak to Docker Compose
  - Configure Keycloak realm (follow JavaTechie resource)
  - Update API Gateway: add JWT validation filter
  - Add Spring Security + Resource Server to wallet and order-engine services
  - Implement Feign JWT propagation interceptor
  - End-to-end secured flow test
```

### Week 10 — Demo and Resume Prep
```
  - Deploy Docker Compose to cloud VM (AWS EC2 free tier or Render)
  - Record a 3-minute demo video
  - Create architectural diagram (draw.io or Excalidraw)
  - Update resume with bullet points from section 16
  - Practice Saga explanation for interviews
```

---

## 15. Docker Compose Setup

Save this as `docker-compose.yml` in the root of your project:

```yaml
version: '3.8'

services:
  # ── Databases ──────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: paynexus
      POSTGRES_PASSWORD: paynexus123
      POSTGRES_DB: paynexus_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: paynexus_notifications
    volumes:
      - mongo_data:/data/db

  # ── [V2] Apache Kafka — Uncomment when starting Phase V2 ───────
  # kafka:
  #   image: confluentinc/cp-kafka:7.5.0
  #   ports:
  #     - "9092:9092"
  #   environment:
  #     KAFKA_NODE_ID: 1
  #     KAFKA_PROCESS_ROLES: broker,controller
  #     KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093
  #     KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:29092,CONTROLLER://0.0.0.0:29093,PLAINTEXT_HOST://0.0.0.0:9092
  #     KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
  #     KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
  #     KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER

  # ── [V3] Keycloak — Uncomment when starting Phase V3 ──────────
  # keycloak:
  #   image: quay.io/keycloak/keycloak:24.0
  #   command: start-dev
  #   environment:
  #     KEYCLOAK_ADMIN: admin
  #     KEYCLOAK_ADMIN_PASSWORD: admin
  #   ports:
  #     - "8180:8080"

  # ── [Optional] Zipkin Tracing ─────────────────────────────────
  # zipkin:
  #   image: openzipkin/zipkin:latest
  #   ports:
  #     - "9411:9411"

  # ── Spring Cloud Infrastructure ───────────────────────────────
  discovery-server:
    build: ./discovery-server
    ports:
      - "8761:8761"

  config-server:
    build: ./config-server
    ports:
      - "8888:8888"
    environment:
      SPRING_PROFILES_ACTIVE: native
    depends_on:
      - discovery-server

  api-gateway:
    build: ./api-gateway
    ports:
      - "8080:8080"
    depends_on:
      - discovery-server
      - redis
    environment:
      SPRING_DATA_REDIS_HOST: redis

  wallet-service:
    build: ./wallet-service
    ports:
      - "8082:8082"
    depends_on:
      - postgres
      - redis
      - discovery-server
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/paynexus_db
      SPRING_DATA_REDIS_HOST: redis
      RAZORPAY_KEY_ID: ${RAZORPAY_KEY_ID}
      RAZORPAY_KEY_SECRET: ${RAZORPAY_KEY_SECRET}
      RAZORPAY_WEBHOOK_SECRET: ${RAZORPAY_WEBHOOK_SECRET}

  order-engine-service:
    build: ./order-engine-service
    ports:
      - "8083:8083"
    depends_on:
      - postgres
      - redis
      - discovery-server
      - wallet-service
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/paynexus_db
      SPRING_DATA_REDIS_HOST: redis
      UPSTOX_CLIENT_ID: ${UPSTOX_CLIENT_ID}
      UPSTOX_CLIENT_SECRET: ${UPSTOX_CLIENT_SECRET}

  notification-service:
    build: ./notification-service
    ports:
      - "8084:8084"
    depends_on:
      - mongodb
      - discovery-server
    environment:
      SPRING_DATA_MONGODB_URI: mongodb://mongodb:27017/paynexus_notifications

volumes:
  postgres_data:
  redis_data:
  mongo_data:
```

---

## 16. Resume Bullet Points & Interview Answers

### Resume Bullets (Use These Directly)

- Architected a **FinTech microservices platform** across 4 independent Spring Boot services (wallet, order engine, notifications, API gateway) with dedicated PostgreSQL and MongoDB datastores per service boundary.

- Implemented a **distributed Saga pattern** for stock order execution: `order-engine-service` reserves wallet funds via Feign, executes the order, and either settles or triggers a **compensating transaction** that atomically releases the escrow hold — guaranteeing zero fund loss across independent service failures.

- Engineered concurrent transfer safety using **Redisson distributed locks** and an **immutable double-entry ledger** (insert-only), preventing race conditions and balance corruption under high-throughput P2P transaction load.

- Designed **idempotent financial APIs** with Redis-backed request deduplication, eliminating double-spend anomalies on duplicate webhook retries from Razorpay payment gateway.

- Integrated **Upstox OAuth 2.0 Authorization Code Flow** with Redis token caching and a **Strategy Pattern** market feed that auto-falls back to a deterministic simulation engine during off-market hours, ensuring 100% demo reliability.

- Configured **Resilience4j circuit breakers** on all Feign RPCs between services, with sliding window failure detection and automatic state transitions preventing cascading failures.

- [V2] Built an **Apache Kafka event bus** decoupling payment, order, and alert events from notification delivery, converting synchronous Feign dependencies into fully async consumer pipelines.

### The Most Important Interview Question

**"Walk me through the hardest engineering problem in your project."**

> "The hardest problem was maintaining financial consistency during stock purchases across two services that each own their own PostgreSQL database — which means I cannot use a database transaction to span both.
>
> I engineered a Saga pattern. When a user places a BUY order, order-engine-service calls wallet-service via Feign to move the required funds into a reserved/hold state. This is an escrow — the money is locked but not spent. wallet-service uses a Redisson distributed lock to prevent race conditions and writes an immutable HOLD entry to the ledger.
>
> If the order succeeds, a second Feign call settles the hold into a permanent DEBIT. If any step fails — database error, network timeout, circuit breaker open — a compensating Feign call releases the hold back to available balance. The user never loses money.
>
> The trickiest edge case is: what if the settlement Feign call itself fails after the order is already executed? I handle this with an idempotency key on every Feign call, so the settlement is retried safely without double-debiting."

That answer will win your interview.

---

*Guide created: 2026-09-09 | Version: V1.0*
*Project: PayNexus | Author: Alakh Agarwal | LNMIIT Jaipur, 5th Semester*
