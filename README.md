# ⚡ PayNexus — High-Throughput FinTech Super-App & Algorithmic Exchange Engine

> An enterprise-grade, distributed microservices FinTech ecosystem featuring **Double-Entry Bookkeeping**, **Redisson Distributed Locks**, **Distributed Saga Orchestration**, **Real-Time NSE Market Simulation**, and **SEBI/RBI-Compliant KYC Verification** with **Role-Based Access Control (RBAC)**.

---

## 🌟 Executive Summary

**PayNexus** is an event-driven financial super-app inspired by institutional trading desks and modern neo-banks (Zerodha, Revolut, Stripe). Built with **Java 21**, **Spring Boot 3.3**, **Spring Cloud**, **PostgreSQL 16**, **Redis 7**, and a custom **React 18 Stoxy-themed terminal**, PayNexus solves critical distributed systems challenges:

1. **Zero Financial Drift**: Strict immutable double-entry ledger ensuring credits and debits always reconcile with mathematically zero floating-point discrepancies.
2. **Deadlock-Free P2P Concurrency**: Redisson atomic `MultiLock` and Lua scripting preventing race conditions and deadlocks during simultaneous multi-party transfers.
3. **Fault-Tolerant Distributed Sagas**: Dual-phase order execution (`HOLD` $\to$ `EXECUTE` $\to$ `SETTLE`) with automated compensating transactions to release held liquidity on downstream failure.
4. **Sub-Second Market Simulation**: Algorithmic price engine generating continuous Gaussian ticks across 10 NSE blue-chip equities and 5 major indices with real-time Mark-to-Market (MTM) P&L updates.
5. **Regulator-Ready RBAC & KYC**: Strict separation of duties between **Customer Portals** (trading, transfers, KYC submission) and **Compliance Officer Consoles** (KYC review queue, wallet freeze risk engine).

---

## 🏗️ System Architecture

```
                                  ┌─────────────────────────────────────────────────────────────────┐
                                  │                  PAYNEXUS DISTRIBUTED ECOSYSTEM                 │
                                  │                                                                 │
      Client Terminals            │  ┌──────────────────────────────────────────────────────────┐  │
    ┌──────────────────┐          │  │               Spring Cloud API Gateway (:8080)            │  │
    │  Stoxy Frontend  ├──────────┼─►│  • Netty Reactive Non-Blocking    • Global CORS Filters  │  │
    │  (React 18 Vite) │          │  │  • Rate Limiting & Proxy Routing  • Resilience4j Guards  │  │
    └──────────────────┘          │  └─────────────┬──────────────────────────────┬─────────────┘  │
                                  │                │                              │                │
                                  │                ▼                              ▼                │
                                  │  ┌───────────────────────────┐  ┌───────────────────────────┐  │
                                  │  │   wallet-service (:8082)  │  │ order-engine-service(:8083│  │
                                  │  │  • Double-Entry Ledger    │  │  • Distributed Saga Engine│  │
                                  │  │  • Redisson MultiLock     │  │  • Real-Time NSE Sim Feed │  │
                                  │  │  • P2P Transfers & Auth   │  │  • Mark-to-Market P&L     │  │
                                  │  │  • KYC Pipeline & Admin   │  │  • Precision Price Alerts │  │
                                  │  └─────────────┬─────────────┘  └─────────────┬─────────────┘  │
                                  │                │                              │                │
                                  │                ▼                              ▼                │
                                  │  ┌───────────────────────────┐  ┌───────────────────────────┐  │
                                  │  │ PostgreSQL: paynexus_wallet│ │PostgreSQL:paynexus_order_en│  │
                                  │  └───────────────────────────┘  └───────────────────────────┘  │
                                  │                │                              │                │
                                  │                └──────────────┬───────────────┘                │
                                  │                               ▼                                │
                                  │  ┌──────────────────────────────────────────────────────────┐  │
                                  │  │             Redis 7 Cluster (Port :6379)                 │  │
                                  │  │  • Distributed Locks (Redisson)  • 120s Idempotency Cache │  │
                                  │  │  • Live Sub-Second Price Feeds   • Sparkline Tick History│  │
                                  │  └──────────────────────────────────────────────────────────┘  │
                                  │                                                                 │
                                  │  ┌──────────────────────────────────────────────────────────┐  │
                                  │  │             Eureka Service Discovery (:8761)              │  │
                                  │  └──────────────────────────────────────────────────────────┘  │
                                  └─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Core** | Java 21, Spring Boot 3.3.4, Spring Cloud 2023.0.3, Spring Data JPA, Hibernate 6 |
| **Networking & Routing** | Spring Cloud Gateway (Netty Reactive), Netflix Eureka Service Discovery, OpenFeign |
| **Databases & Persistence** | PostgreSQL 16 (Isolated multi-database schema), Flyway Database Migrations |
| **Caching & Concurrency** | Redis 7 Alpine, Redisson 3.35.0 (Distributed MultiLock, Lua Scripts, TTLs) |
| **Frontend Terminal** | React 18, Vite 5, Stoxy Espresso Theme (`#0f0e0d`), Lucide Icons, Canvas Sparklines |
| **Quality & Resilience** | Resilience4j Circuit Breakers, BCrypt 12-round hashing, Newman, Jest / Node Test Runner |
| **DevOps & Containers** | Docker, Docker Compose, Multi-stage builds, PowerShell automated launcher |

---

## 🧩 Microservices Directory

| Service | Port | Primary Responsibilities | Persistence |
| :--- | :---: | :--- | :--- |
| **`discovery-server`** | `8761` | Dynamic service registration, health heartbeats, and client-side load balancing. | In-Memory (Netflix Eureka) |
| **`api-gateway`** | `8080` | Unified edge routing, CORS normalization, security validation, and downstream proxying. | Spring Cloud Gateway (Netty) |
| **`wallet-service`** | `8082` | Double-entry accounting, P2P atomic transfers, KYC lifecycle, and admin risk controls. | PostgreSQL (`paynexus_wallet`) + Redis |
| **`order-engine-service`** | `8083` | Distributed BUY/SELL Sagas, real-time market simulator, MTM portfolio P&L, price alerts. | PostgreSQL (`paynexus_order_engine`) + Redis |
| **`frontend`** | `5173` | High-frequency trading terminal, real-time depth, bipolar breadth, and compliance console. | Vite Dev Server / Static SPA |

---

## 💡 Core Engineering Highlights

### 1. Distributed Sagas with Automated Compensating Transactions
Stock market orders require atomic coordination across isolated microservices (`order-engine-service` and `wallet-service`). Instead of blocking, fragile two-phase commit (2PC) protocols, PayNexus implements an **Orchestrated Saga Pattern**:

```
[BUY ORDER INITIATED]
   │
   ├─► Step 1: Wallet HOLD (Reserve funds in wallet-service)
   │     ├─ Success: Funds placed in reservedBalance
   │     └─ Failure: Reject order immediately (HTTP 422 - Insufficient Balance)
   │
   ├─► Step 2: Order Execution (Record filled trade in order-engine-service)
   │     ├─ Success: Order marked EXECUTED
   │     └─ Failure: Trigger Compensation ──► [Release reserved balance in wallet-service]
   │
   ├─► Step 3: Wallet SETTLE (Debit held funds & record double-entry ledger entry)
   │     └─ Success: Ledger updated; running balance synchronized
   │
   └─► Step 4: Portfolio Upsert (Weighted average buy-price update in order-engine-service)
         └─ Order lifecycle completed atomically.
```

### 2. Double-Entry Bookkeeping & Audit Integrity
All monetary balance updates adhere to GAAP / IFRS double-entry standards:
- **No Direct Column Overwrite**: Balances are calculated through audited ledger entries (`CREDIT`, `DEBIT`, `HOLD`).
- **Precision Money Math**: Uses `BigDecimal` with 4-decimal precision internally and 2-decimal presentation rounding, eliminating floating-point rounding bugs (`0.1 + 0.2 != 0.3`).
- **Running Balance Tracking**: Every transaction captures the account's running balance at that millisecond, enabling instant audit verification.

### 3. Redisson Distributed MultiLocks & Idempotency
- **Atomic MultiLocks**: Transfers lock `min(senderId, receiverId)` and `max(senderId, receiverId)` in consistent deterministic order via Redisson Lua scripts, eliminating deadlocks during concurrent cyclic transfers ($A \to B$ and $B \to A$).
- **Idempotency Engine**: `X-Idempotency-Key` headers are verified using Redis `SETNX` with a 120-second TTL. Network retries return identical cached transaction receipts without double-charging accounts.

### 4. Real-Time Market Tick Simulator & Dynamic Breadth
- Background scheduled worker produces Gaussian-random price ticks ($\pm 0.2\%$) every 2 seconds for 10 premier NSE equities (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, WIPRO, TATAMOTORS, ZOMATO, etc.).
- Maintains a 20-tick sliding window in Redis lists for live SVG sparklines.
- Powers a **center-zero bipolar sector breadth bar** (Banking, Auto, IT, FMCG, Finance) reflecting market momentum.

### 5. Role-Based Access Control (RBAC) & Regulatory KYC
- **Customer Terminal (`ROLE_USER`)**: Trade equities, execute P2P transfers, review personal portfolio, and submit paperless PAN & Aadhaar details.
- **Compliance Console (`ROLE_ADMIN`)**: Review incoming KYC applications, inspect document numbers, execute 1-Click Approve / Reject with remarks, and freeze compromised wallets.
- **Security & Separation of Duties**: Customers are strictly barred from approving their own KYC or accessing administrative endpoints.

---

## 🚀 Quickstart Guide (1-Click Launch)

### Prerequisites
- **Java 21** installed and configured (`java -version`)
- **Node.js 18+** (`node -v`)
- **Docker Desktop** running (for PostgreSQL & Redis)

### Step 1: Clone & Launch Infrastructure
Run the PowerShell 1-click startup script from the project root:

```powershell
# Starts Docker (Postgres + Redis), Eureka, Gateway, Wallet, Order Engine & Frontend
.\start-all.ps1
```

Once initialized:
- 💻 **Trading Terminal & Portal**: [http://localhost:5173](http://localhost:5173)
- 🌐 **API Gateway**: [http://localhost:8080](http://localhost:8080)
- 🔍 **Eureka Service Registry**: [http://localhost:8761](http://localhost:8761)
- 📊 **Redis Insight GUI**: [http://localhost:5540](http://localhost:5540)

---

## 📡 REST API Reference Summary

All requests route through the **API Gateway** on port `8080`:

### Market & Orders (`order-engine-service`)
```http
GET    /api/v1/market/prices             # Live prices for all 10 NSE equities
GET    /api/v1/market/prices/{symbol}     # Stock detail with 20-tick sparkline history
POST   /api/v1/orders/buy                # Execute BUY Saga (Headers: X-Idempotency-Key)
POST   /api/v1/orders/sell               # Execute SELL Saga (Headers: X-Idempotency-Key)
GET    /api/v1/orders/{userId}/history   # Paginated order history (?status=EXECUTED)
GET    /api/v1/portfolio/{userId}        # Portfolio holdings & aggregate unrealized P&L
POST   /api/v1/alerts                    # Register price threshold alert
```

### Digital Wallet & Identity (`wallet-service`)
```http
POST   /api/v1/users/login               # User authentication
POST   /api/v1/users/register            # Atomically provision user & digital wallet
GET    /api/v1/users/{userId}/profile    # Profile & KYC compliance status
POST   /api/v1/users/{userId}/kyc        # Submit paperless PAN, Aadhaar & DOB
GET    /api/v1/wallet/{userId}           # Real-time available, reserved, and daily limits
POST   /api/v1/wallet/transfer           # Atomic P2P transfer with Redisson MultiLock
GET    /api/v1/wallet/{userId}/ledger    # Immutable double-entry transaction ledger
```

### Administrative & Compliance (`ROLE_ADMIN`)
```http
GET    /admin/kyc/pending                # Retrieve pending regulatory KYC applications
PUT    /admin/kyc/{userId}/approve       # 1-Click approval transitioning status to VERIFIED
PUT    /admin/kyc/{userId}/reject        # Reject application with compliance remarks
PUT    /admin/users/{userId}/freeze      # Freeze user wallet for fraud hold
PUT    /admin/users/{userId}/unfreeze    # Restore wallet to active state
```

---

## 📄 License
This project is licensed under the MIT License — created for high-performance software engineering portfolio demonstrations.
