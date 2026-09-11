# 🚀 PayNexus: Master Architectural Blueprint & Implementation Guide
### FinTech Super-App: Digital Wallet + Real-Time Stock Investment + Spring AI Advisor

---

## 📑 Table of Contents
1. [Project Overview & Core Value Proposition](#1-project-overview--core-value-proposition)
2. [Complete System Architecture](#2-complete-system-architecture)
3. [Microservices Catalog & Technology Matrix](#3-microservices-catalog--technology-matrix)
4. [Deep Dive: Inter-Service Communication & Distributed Patterns](#4-deep-dive-inter-service-communication--distributed-patterns)
5. [External APIs & Third-Party Integrations](#5-external-apis--third-party-integrations)
6. [End-to-End Application & User Flows](#6-end-to-end-application--user-flows)
7. [Spring AI Financial Advisor Implementation](#7-spring-ai-financial-advisor-implementation)
8. [Data Models & Persistence Strategy](#8-data-models--persistence-strategy)
9. [Enterprise Security & Resilience Architecture](#9-enterprise-security--resilience-architecture)
10. [Local Development & Docker Compose Topology](#10-local-development--docker-compose-topology)
11. [10-Week Phased Build Roadmap](#11-10-week-phased-build-roadmap)
12. [Senior Interview Talking Points & Cheat Sheet](#12-senior-interview-talking-points--cheat-sheet)

---

## 1. Project Overview & Core Value Proposition

**PayNexus** is an enterprise-grade FinTech microservices platform designed to solve the "isolated CRUD" trap common in student portfolios. It integrates three traditionally separate systems into one unified ecosystem:

1. **High-Reliability Digital Wallet**: P2P transfers, instant top-ups via Razorpay, atomic double-entry bookkeeping, and distributed concurrency control.
2. **Real-Time Stock Investment Engine**: Live NSE market quotes via Upstox, paper trading directly from wallet funds, and real-time portfolio P&L tracking.
3. **Context-Aware AI Financial Advisor**: Powered by Spring AI & OpenAI GPT-4o, delivering personalized financial advice conditioned on live portfolio holdings and wallet liquidity.

---

## 2. Complete System Architecture

```
                                 [ React 19 Client (Vite + Tailwind + TradingView) ]
                                                          │
                                                          │ HTTPS / WSS (STOMP)
                                                          ▼
                                ┌───────────────────────────────────────────────────┐
                                │       Spring Cloud API Gateway  (Port: 8080)      │
                                │   - Keycloak JWT Validation & Claims Enrichment   │
                                │   - Global Rate Limiting (Redis Token Bucket)     │
                                │   - WebSocket Handshake & Dynamic Route Proxy     │
                                └─────────────────────────┬─────────────────────────┘
                                                          │
                   ┌──────────────────────────────────────┼──────────────────────────────────────┐
                   │ (Synchronous HTTP/OpenFeign)         │                                      │ (Realtime WebSockets)
                   ▼                                      ▼                                      ▼
       ┌───────────────────────┐              ┌───────────────────────┐              ┌───────────────────────┐
       │     user-service      │              │    wallet-service     │              │  market-data-service  │
       │      (Port: 8081)     │              │      (Port: 8082)     │              │      (Port: 8084)     │
       │   PostgreSQL + Auth   │              │  PostgreSQL + Redis   │              │ Upstox WS + Redis Pub │
       └───────────────────────┘              └───────────┬───────────┘              └───────────┬───────────┘
                   │                                      │                                      │
                   │                                      │ (Saga Coordination)                  │ (Live Price Ticks)
                   ▼                                      ▼                                      ▼
       ┌───────────────────────┐              ┌───────────────────────┐              ┌───────────────────────┐
       │    payment-service    │              │  investment-service   │              │   ai-advisor-service  │
       │      (Port: 8083)     │              │      (Port: 8085)     │              │      (Port: 8086)     │
       │   Razorpay Webhooks   │              │ Portfolio & Order Eng │              │ Spring AI + OpenAI 4o │
       └───────────────────────┘              └───────────┬───────────┘              └───────────────────────┘
                                                          │
                   ┌──────────────────────────────────────┴──────────────────────────────────────┐
                   ▼                                                                             ▼
       ┌───────────────────────┐                                                     ┌───────────────────────┐
       │   Apache Kafka Bus    │ ◄── [payment.completed, order.placed, price.tick] ──│ notification-service  │
       │     (Port: 9092)      │                                                     │      (Port: 8087)     │
       │  Distributed Events   │ ──► [Sends SendGrid Emails & WebSocket Push Alerts] ─│   MongoDB Storage     │
       └───────────────────────┘                                                     └───────────────────────┘
```

### Core Infrastructure Sidecars
* **Eureka Service Registry** (`discovery-server:8761`): Dynamic service discovery.
* **Spring Cloud Config Server** (`config-server:8888`): Centralized, Git-backed configuration.
* **Distributed Tracing** (`zipkin:9411`): OpenTelemetry / Micrometer request correlation.
* **Identity Provider** (`keycloak:8180`): Centralized OAuth2/OIDC realm.

---

## 3. Microservices Catalog & Technology Matrix

| Service | Port | Database | Primary Libraries & Frameworks | Primary Function |
|---|---|---|---|---|
| `discovery-server` | 8761 | None | Spring Cloud Netflix Eureka Server | Service registration and heartbeat monitoring |
| `config-server` | 8888 | None (Git) | Spring Cloud Config Server | Centralized remote configuration management |
| `api-gateway` | 8080 | Redis | Spring Cloud Gateway, Reactive Redis | Auth verification, rate limiting, and reverse proxying |
| `user-service` | 8081 | PostgreSQL | Spring Data JPA, Keycloak Admin Client | User profiles, KYC document processing, settings |
| `wallet-service` | 8082 | PostgreSQL + Redis | Redisson, Spring Data JPA, Hibernate Envers | Balance state, atomic ledger, distributed locking |
| `payment-service` | 8083 | PostgreSQL | Razorpay Java SDK, Commons-Codec (HMAC) | Gateway checkout, webhook signature verification |
| `market-data-service`| 8084 | Redis | Spring WebSocket, Upstox SDK / Java-WebSocket | Real-time quote streaming, price threshold alert engine |
| `investment-service` | 8085 | PostgreSQL | Spring Data JPA, Resilience4j, OpenFeign | Order lifecycle, portfolio aggregation, P&L calculations |
| `ai-advisor-service` | 8086 | MongoDB | Spring AI Starter OpenAI, Spring WebFlux | Contextual LLM prompt assembly, chat persistence |
| `notification-service`| 8087 | MongoDB | Spring Kafka, SendGrid Java, Spring WebSocket | Async event consumer, transactional email & socket dispatcher |

---

## 4. Deep Dive: Inter-Service Communication & Distributed Patterns

To eliminate isolated CRUD silos, PayNexus implements three distributed patterns:

### A. The Distributed Saga Pattern (Stock Execution Saga)
Buying a stock spans `investment-service`, `wallet-service`, and `market-data-service`. If order placement fails at the exchange layer, any debited wallet funds must be gracefully returned.

```
[User: BUY 5 RELIANCE]
         │
         ▼
[investment-service] ──(1. OpenFeign Sync)──► [market-data-service] (Lock live price: ₹2,450)
         │
         ├──(2. OpenFeign Sync)──────────────► [wallet-service] (RESERVE_HOLD: ₹12,250)
         │                                              │
         │                                              └─► Balance held in ESCROW
         ▼
[investment-service] executes internal order matching
         │
    ┌────┴─────────────────────────────┐
    ▼                                  ▼
[SUCCESS]                          [FAILURE] (e.g. Market circuit / DB error)
    │                                  │
    ├─► Emits `order.success`          ├─► Emits `order.failed` (Compensation Event)
    │   to Kafka                       │   to Kafka
    ▼                                  ▼
[wallet-service]                   [wallet-service]
Converts ESCROW into DEBIT         Releases ESCROW back to AVAILABLE balance
Writes permanent Ledger entry      Emits `wallet.hold.released`
```

### B. High-Throughput Event Fan-Out (Kafka Price Stream)
`market-data-service` receives market ticks from Upstox and emits `price.tick` events into Kafka:
* **`investment-service`** consumes ticks: Re-computes unrealized portfolio P&L in memory.
* **`market-data-service` (internal alert worker)**: Compares ticks against stored price alert thresholds.
* **`notification-service`**: Fans out live ticker updates over WebSocket to subscribed frontend clients.

### C. Synchronous Inter-Service Matrix with Resilience4j

```
[Client Request] ──► [API Gateway]
                           │
                           ├──► [investment-service]
                           │           │
                           │           ├──(OpenFeign + Resilience4j)──► [user-service: verifyKYC()]
                           │           │                                     └─ [Fallback: Redis KYC Cache]
                           │           │
                           │           └──(OpenFeign + Resilience4j)──► [wallet-service: holdFunds()]
                           │                                                 └─ [Fallback: Fast-Fail / Return 422]
                           │
                           └──► [ai-advisor-service]
                                       │
                                       ├──(OpenFeign)──► [investment-service: getHoldings()]
                                       └──(OpenFeign)──► [wallet-service: getBalance()]
```

* **JWT Propagation**: Implemented via a Feign `RequestInterceptor` that extracts the `Authorization: Bearer <token>` from the Spring `SecurityContextHolder` and copies it to all outbound headers.
* **Circuit Breaker Configuration**:
  ```yaml
  resilience4j.circuitbreaker:
    instances:
      walletService:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 5000ms
        permittedNumberOfCallsInHalfOpenState: 3
  ```

---

## 5. External APIs & Third-Party Integrations

### 1. Upstox API (Market Feed Provider)
* **Website**: https://upstox.com/developer
* **Protocol**: WebSocket (Protobuf / JSON feeds) + REST v2.
* **Endpoints Used**:
  * `GET /v2/market-quote/quotes`: Snapshot market data.
  * `WSS /v2/feed/market-data-feed`: Live WebSocket streaming.
  * `GET /v2/historical-candle/{instrumentKey}/1minute`: Intraday charts.
* **Implementation Strategy**: A singleton background daemon in `market-data-service` maintains one persistent upstream connection to Upstox and multiplexes data down to local Redis pub/sub.

### 2. Razorpay Payment Gateway
* **Website**: https://dashboard.razorpay.com
* **Mode**: Test Mode (Zero cost, instant mock UPI / Netbanking IDs).
* **Endpoints & Features**:
  * Order creation via `RazorpayClient.orders.create()`.
  * Server-side signature validation: `Utils.verifyWebhookSignature(payload, signature, secret)`.

### 3. OpenAI API via Spring AI
* **Library**: `org.springframework.ai:spring-ai-openai-spring-boot-starter:1.0.0-M1`
* **Model**: `gpt-4o` (or `gpt-4o-mini` for budget optimization).
* **Configuration**:
  ```yaml
  spring:
    ai:
      openai:
        api-key: ${OPENAI_API_KEY}
        chat:
          options:
            model: gpt-4o-mini
            temperature: 0.3
  ```

### 4. SendGrid API
* **Website**: https://sendgrid.com (Free tier: 100 emails/day).
* **Used For**: Automated PDF statement delivery and login security alerts.

---

## 6. End-to-End Application & User Flows

### Flow 1: Registration & KYC Gating
1. User registers via Keycloak UI (OAuth2 Authorization Code flow with PKCE).
2. Keycloak issues JWT ➔ Client stores token in HTTP-only storage.
3. User profile saved in `user-service`; `wallet-service` creates initial wallet record (`balance = ₹0.00`).
4. **KYC Gate**: Unverified users can load money and transfer P2P, but the **"Invest"** tab is locked until PAN and Aadhaar are submitted and approved via the Admin console.

### Flow 2: Wallet Loading via Razorpay Webhook
1. User enters ₹5,000 top-up request ➔ `payment-service` calls Razorpay and returns `order_id`.
2. Frontend launches Razorpay checkout modal.
3. User approves mock UPI payment.
4. Razorpay sends webhook `payment.captured` to `https://api.paynexus.com/api/v1/payments/webhook`.
5. `payment-service` validates HMAC-SHA256 signature.
6. Calls `wallet-service` via OpenFeign ➔ balance increments atomically ➔ writes `CREDIT` ledger row.
7. Emits `payment.completed` event to Kafka ➔ `notification-service` emails receipt.

### Flow 3: P2P Instant Transfer with Redis Locking
1. User A initiates ₹1,000 transfer to User B.
2. User A inputs 6-digit Transaction PIN (verified via BCrypt).
3. `wallet-service` acquires distributed lock: `RLock lock = redisson.getLock("wallet:lock:" + userAId)`.
4. In-memory check: Balance ≥ ₹1,000 and Daily Spend < Limit.
5. In a single `@Transactional` block:
   * Decrement User A by ₹1,000.
   * Increment User B by ₹1,000.
   * Insert two immutable `LedgerEntry` records (`DEBIT` and `CREDIT`).
6. Lock released. `transfer.completed` published to Kafka.

### Flow 4: Stock Purchase & Live Portfolio Tracking
1. User browses live market tab. Real-time prices tick over WebSocket without polling.
2. User clicks "Buy" on TCS: Quantity: 2 @ ₹3,800 = ₹7,600.
3. Order Saga executes (Funds reserved ➔ Order matched ➔ Funds settled).
4. Holdings record created in `investment-service`.
5. Portfolio view displays:
   $$\text{Unrealized P\&L} = (\text{Live Price} - \text{Average Buy Price}) \times \text{Quantity}$$
6. As Upstox feeds new prices to `market-data-service`, portfolio card numbers update dynamically.

### Flow 5: Automated Price Alerts
1. User sets trigger: *"Alert me if ZOMATO drops below ₹220"*.
2. Alert record persisted in `investment-service` and mirrored in Redis: `HSET alerts:ZOMATO {userId} 220`.
3. When tick hits ₹219.50, `market-data-service` fires `price.alert.triggered` to Kafka.
4. `notification-service` dispatches an in-app WebSocket alert modal and SendGrid email.

---

## 7. Spring AI Financial Advisor Implementation

The AI Advisor acts as a financial analyst that has direct read-only context of the user's finances.

```
[User Chat Prompt]
        │
        ▼
[ai-advisor-service]
        │
        ├──(Feign)──► [wallet-service]     ──► Balance: ₹14,200
        └──(Feign)──► [investment-service] ──► Holdings: 10 INFY, 5 RELIANCE | P&L: +₹1,240
        │
        ▼
[Prompt Assembly Engine]
Constructs dynamic contextual prompt:
┌────────────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT:                                                         │
│ You are PayNexus AI, an intelligent FinTech portfolio copilot.         │
│ Real-Time User Context:                                                │
│ - Liquid Wallet Cash: {wallet.balance}                                 │
│ - Active Holdings: {investment.holdings_summary}                       │
│ - Net Unrealized P&L: {investment.total_pnl}                           │
│ Guidelines: Answer concisely. Suggest diversification principles.      │
│ Mandate: Append disclaimer: "Not SEBI-registered financial advice."    │
│                                                                        │
│ USER QUERY:                                                            │
│ "Should I allocate more into tech stocks or keep liquid cash?"         │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
[Spring AI ChatClient] ──(HTTP POST)──► [OpenAI GPT-4o-mini]
        │
        ▼
Streamed response returned to client via Server-Sent Events (SSE) / REST.
```

---

## 8. Data Models & Persistence Strategy

### PostgreSQL Schema Snippets

```sql
-- wallet-service: Wallets Table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) UNIQUE NOT NULL,
    available_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    reserved_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'INR',
    is_frozen BOOLEAN DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0, -- Optimistic Locking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wallet-service: Immutable Double-Entry Ledger
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    transaction_type VARCHAR(16) NOT NULL, -- CREDIT / DEBIT / HOLD / RELEASE
    amount DECIMAL(15, 2) NOT NULL,
    reference_id VARCHAR(64) NOT NULL,    -- Idempotency key
    narration TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- investment-service: Stock Holdings
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    quantity INT NOT NULL,
    avg_buy_price DECIMAL(10, 2) NOT NULL,
    total_invested DECIMAL(15, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_symbol UNIQUE (user_id, symbol)
);
```

### MongoDB Document Schema (`notification-service`)
```json
{
  "_id": "66dec98f12a3b4c5d6e7f8a9",
  "userId": "usr_998124",
  "eventType": "PRICE_ALERT_TRIGGERED",
  "title": "Price Target Hit: RELIANCE",
  "message": "Reliance Industries crossed your target price of ₹2,500.00. Current: ₹2,504.10",
  "channel": "IN_APP_AND_EMAIL",
  "read": false,
  "createdAt": "2026-09-08T14:32:00Z"
}
```

---

## 9. Enterprise Security & Resilience Architecture

* **Zero-Trust Token Propagation**: The API Gateway sanitizes input and validates Keycloak tokens. Downstream services re-verify the signature using Keycloak's public JWKS endpoint (`/protocol/openid-connect/certs`).
* **Idempotency Keys**: All financial state-changing endpoints require an `X-Idempotency-Key` header. Requests are cached in Redis for 120 seconds. Duplicate keys return cached responses, eliminating double charges.
* **Distributed Concurrency Prevention**: Redisson locks with strict lease times prevent race conditions during rapid consecutive transactions.

---

## 10. Local Development & Docker Compose Topology

Running the complete platform locally requires running the container stack below:

```yaml
version: '3.8'

services:
  # Infrastructure Core
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: paynexus
      POSTGRES_PASSWORD: secretpassword
      POSTGRES_DB: paynexus_db
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT'
      KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092'
      KAFKA_PROCESS_ROLES: 'broker,controller'
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@kafka:29093'
      KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:29092,CONTROLLER://0.0.0.0:29093,PLAINTEXT_HOST://0.0.0.0:9092'
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER'
    ports:
      - "9092:9092"

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8180:8080"

  zipkin:
    image: openzipkin/zipkin:latest
    ports:
      - "9411:9411"

  # Spring Cloud Infrastructure
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

  api-gateway:
    build: ./api-gateway
    ports:
      - "8080:8080"
    depends_on:
      - discovery-server
      - redis
```

---

## 11. 10-Week Phased Build Roadmap

```
Week 01: Infra skeleton (Eureka, Config Server, Gateway, Docker Compose, Keycloak setup)
Week 02: user-service & wallet-service (PostgreSQL, Redisson Distributed Locks, Ledger)
Week 03: payment-service (Razorpay SDK, Webhook HMAC signature verification)
Week 04: Kafka Event Bus setup + notification-service (SendGrid integration)
Week 05: market-data-service (Upstox WebSocket consumer, Redis price caching)
Week 06: investment-service (Order Saga execution, Feign clients, Resilience4j)
Week 07: ai-advisor-service (Spring AI OpenAI ChatClient, dynamic system prompt context)
Week 08: React 19 Frontend (Vite, Tailwind, TradingView Charts, STOMP WebSockets)
Week 09: System Integration (Saga rollback verification, Zipkin tracing, k6 load testing)
Week 10: Production packaging, README documentation, architectural diagrams, demo deployment
```

---

## 12. Senior Interview Talking Points & Cheat Sheet

When asked: **"What is the most technically complex engineering problem you solved in this project?"**

> *"In PayNexus, the most critical challenge was maintaining financial consistency during stock purchases across decoupled microservices without introducing distributed deadlocks.
>
> Rather than relying on rigid two-phase commit protocols that degrade throughput, I engineered an eventual-consistency **Saga pattern**. When an order is placed, `investment-service` issues a synchronous OpenFeign call to `wallet-service` to place matching funds into an Escrow/Hold state using a Redis distributed lock. 
> 
> If the downstream market execution or DB write fails, a compensating Kafka event is published that triggers `wallet-service` to automatically release the escrowed hold back to the available balance. This guarantees zero double-spend anomalies while keeping the service boundaries completely isolated."*

---

### Resume Bullet Points (Ready for your CV)
* Architected an event-driven FinTech microservices platform handling wallet transactions, live NSE stock investments, and an integrated LLM financial copilot across 7 Spring Boot services.
* Implemented a distributed **Saga Pattern** with compensating transactions between `investment-service` and `wallet-service`, preventing data inconsistency across independent PostgreSQL datastores.
* Mitigated race conditions and double-spending by engineering distributed locking via **Redisson** and idempotent API request handling.
* Integrated **Spring Cloud Gateway**, **Eureka**, and **Resilience4j** circuit breakers with Redis-backed fallback mechanisms, maintaining 99.9% uptime during downstream service degradation.
* Built real-time market data pipelines streaming live NSE prices via **Upstox WebSockets** and broadcasting events across a distributed **Apache Kafka** cluster.
* Integrated **Spring AI** and OpenAI GPT-4o to build a context-aware financial advisor that ingests live user portfolio metrics to deliver real-time personalized insights.
