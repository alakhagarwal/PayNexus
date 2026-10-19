# 🏦 Order Engine Service

> **Port**: `8083` | **Spring Boot**: `3.3.4` | **Spring Cloud**: `2023.0.3`  
> **Databases**: PostgreSQL + Redis  
> **Status**: Phase 1 ✅ (Market Feed) | Phase 2 ✅ (Price Alerts Engine) | Phase 3 ✅ (Stock Order Saga) | Phase 4 ✅ (Portfolio & Live P&L)


---

## Table of Contents

1. [Architecture](#architecture)
2. [Phase Status](#phase-status)
3. [Running the Service](#running-the-service)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Request & Response Formats](#request--response-formats)
6. [Stock Order Distributed Saga (Phase 3)](#stock-order-distributed-saga-phase-3)
7. [Portfolio & Live Unrealized P&L (Phase 4)](#portfolio--live-unrealized-pl-phase-4)
8. [API Gateway Routing](#api-gateway-routing)
9. [Error Handling](#error-handling)
10. [Redis Key Contract](#redis-key-contract)
11. [Database Schema](#database-schema)
12. [Postman Collection & Automated Testing](#postman-collection--automated-testing)
13. [Key Design Decisions](#key-design-decisions)

---

## Architecture

```
order-engine-service (8083)
│
├── MarketController          GET /api/v1/market/**
│   ├── getAllPrices()         → reads SimulatedMarketFeed in-memory map
│   ├── getPriceBySymbol()    → reads Redis price: + price_history: keys
│   └── getFeedStatus()       → reads SimulatedMarketFeed metadata
│
├── AlertController           POST|GET|DELETE /api/v1/alerts/**  ✅ Phase 2
│   ├── createAlert()         → validates, saves PriceAlert entity
│   ├── getActiveAlerts()     → findByUserIdAndIsActiveTrue()
│   └── cancelAlert()         → soft-delete (isActive=false)
│
├── SimulatedMarketFeed       @Scheduled every 2 seconds
│   ├── Applies ±0.2% Gaussian fluctuation to 10 NSE symbols
│   ├── Writes price:{SYMBOL} to Redis
│   ├── Maintains price_history:{SYMBOL} list (last 20 ticks, cap at index 19)
│   └── Calls PriceAlertService.checkAlerts() after each tick ← wired to DB
│
├── PriceAlertService         Full implementation ✅ Phase 2
│   ├── checkAlerts()         → ABOVE/BELOW threshold check, sets triggeredAt
│   ├── createAlert()         → symbol validation + persist
│   ├── getActiveAlerts()     → read-only query
│   └── cancelAlert()         → soft delete with 400 guard (already inactive)
│
├── OrderController             POST /api/v1/orders/buy|sell  ✅ Phase 3
│   ├── buyOrder()              → BUY saga: HOLD → EXECUTE → SETTLE (or COMPENSATE)
│   ├── sellOrder()             → SELL saga: CREDIT → UPDATE-HOLDINGS (or COMPENSATE)
│   └── getOrderHistory()       → paginated with optional ?status= filter
│
├── OrderService                Full BUY + SELL saga implementation ✅ Phase 3
│   ├── buyOrder()              → idempotency check → hold → settle → update holdings
│   ├── sellOrder()             → idempotency check → verify holdings → credit → update holdings
│   ├── getOrderHistory()       → read-only repository query
│   ├── updateHoldingsAfterBuy() → weighted average price upsert
│   └── compensateBuy()         → release held funds on saga failure
│
├── PortfolioController         GET /api/v1/portfolio/**  ✅ Phase 4
│   ├── getPortfolio()          → GET /api/v1/portfolio/{userId} (holdings + aggregate live P&L)
│   └── getHoldings()           → GET /api/v1/portfolio/{userId}/holdings (per-stock enriched list)
│
├── PortfolioService            Full P&L enrichment engine ✅ Phase 4
│   ├── getPortfolio()          → reads DB holdings, queries Redis prices, computes rollup metrics
│   ├── getHoldings()           → enriches individual holdings with live currentPrice & P&L
│   └── enrich()                → computes currentValue, unrealizedPnl, pnlPercent, pnlDirection
│
├── WalletServiceClient         Feign client for inter-service calls ✅ Phase 3
│   ├── holdFunds()             → POST /internal/wallet/hold
│   ├── settleFunds()           → POST /internal/wallet/settle
│   ├── releaseFunds()          → POST /internal/wallet/release
│   └── creditWallet()          → POST /internal/wallet/credit
│
├── WalletServiceFallbackFactory  Resilience4j fallback ✅ Phase 3
│   └── All methods throw ServiceUnavailableException → saga triggers compensation
│
├── MarketService             Business logic layer
│
└── GlobalExceptionHandler    Uniform JSON error responses
```

### Inter-Service Communication

```
order-engine-service (8083)
    │
    ├── Eureka Discovery Server (8761) — registered as ORDER-ENGINE-SERVICE
    │
    └── Feign → wallet-service (8082) internal endpoints  ✅ Phase 3
        POST /internal/wallet/hold    — Step 1 of BUY saga (reserve funds)
        POST /internal/wallet/settle  — Step 3 of BUY saga (permanent debit)
        POST /internal/wallet/release — BUY saga compensation (release held funds)
        POST /internal/wallet/credit  — Step 1 of SELL saga (credit proceeds)
```

---

## Phase Status

| Phase | Feature | Status |
|---|---|---|
| **Phase 1** | Project setup, Flyway migrations, Simulated Market Feed | ✅ Complete |
| **Phase 2** | Price Alerts engine (CRUD + auto-trigger) | ✅ Complete |
| **Phase 3** | Stock Order Saga (BUY/SELL + Resilience4j + Idempotency + Holdings) | ✅ Complete |
| **Phase 4** | Portfolio & Live P&L (DB Holdings + Live Redis Enrichment + Unrealized P&L) | ✅ Complete |
| **Phase 5** | Upstox OAuth + Live Market Feed | ⏳ Deferred (Simulation Active) |

---

## Running the Service

**Prerequisites**: PostgreSQL, Redis, and Eureka (discovery-server) must be running.

```bash
# From project root
./mvnw spring-boot:run -pl order-engine-service

# Or with custom DB credentials
DB_HOST=localhost DB_PORT=5432 DB_NAME=paynexus_order_engine \
DB_USER=postgres DB_PASS=yourpassword \
./mvnw spring-boot:run -pl order-engine-service
```

**Environment Variables** (with defaults):

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `paynexus_order_engine` | Database name |
| `DB_USER` | `postgres` | DB username |
| `DB_PASS` | `Alakh@2004` | DB password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `EUREKA_HOST` | `localhost` | Eureka server host |

---

## REST API Endpoints

### Phase 1 — Market Data Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/market/prices` | All 10 tracked stock prices | None |
| `GET` | `/api/v1/market/prices/{symbol}` | Single stock price + 20-tick history | None |
| `GET` | `/api/v1/market/feed-status` | Feed mode (SIMULATION/LIVE) + metadata | None |

### Phase 2 — Price Alert Endpoints ✅

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/alerts` | Create a price alert | None |
| `GET` | `/api/v1/alerts/{userId}` | Get all active alerts for a user | None |
| `DELETE` | `/api/v1/alerts/{alertId}` | Soft-cancel an alert | None |

### Phase 3 — Stock Order Saga Endpoints ✅

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/orders/buy` | Place BUY order (Distributed Saga: HOLD → EXECUTE → SETTLE / COMPENSATE) | None |
| `POST` | `/api/v1/orders/sell` | Place SELL order (Distributed Saga: Verify Holdings → CREDIT → Update Holdings) | None |
| `GET` | `/api/v1/orders/{userId}/history` | Paginated order history with optional `?status=` and `?orderType=` filter | None |

### Phase 4 — Portfolio & Live P&L Endpoints ✅

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/portfolio/{userId}` | Full portfolio with live Redis price enrichment + aggregate unrealized P&L | None |
| `GET` | `/api/v1/portfolio/{userId}/holdings` | Per-stock holdings with current prices, market value, and position P&L | None |

---

## Request & Response Formats

### Uniform Response Wrapper

All endpoints return the following envelope:

```json
// Success
{
  "success": true,
  "message": "Optional message string",
  "data": { ... }
}

// Error
{
  "success": false,
  "message": "Human-readable error description"
}
```

> **Note**: `message` and `data` are omitted from the JSON when `null` (using `@JsonInclude(NON_NULL)`).

---

### `GET /api/v1/market/prices`

Returns latest prices for all 10 tracked NSE symbols.

**Request**: No body, no headers required.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Market prices fetched successfully",
  "data": {
    "prices": {
      "RELIANCE": 2451.23,
      "TCS": 3802.11,
      "INFY": 1621.50,
      "HDFCBANK": 1712.30,
      "ZOMATO": 221.45,
      "WIPRO": 465.80,
      "ICICIBANK": 1231.90,
      "SBIN": 811.20,
      "TATAMOTORS": 941.00,
      "NIFTY50": 24803.55
    },
    "totalSymbols": 10
  }
}
```

---

### `GET /api/v1/market/prices/{symbol}`

Returns current price + last 20 price ticks for a single symbol.  
Symbol matching is **case-insensitive** (`tcs` → `TCS`).

**Path Parameter**:
| Param | Type | Description |
|---|---|---|
| `symbol` | `String` | Stock symbol. Supported: `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`, `ZOMATO`, `WIPRO`, `ICICIBANK`, `SBIN`, `TATAMOTORS`, `NIFTY50` |

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "symbol": "RELIANCE",
    "currentPrice": 2451.23,
    "priceHistory": [
      "2451.23",
      "2448.90",
      "2453.01",
      "2450.55",
      "2447.88"
    ]
  }
}
```

> `priceHistory` is a list of up to 20 string-formatted prices, **most recent at index 0**.

**Response `404 Not Found`** (unknown symbol):
```json
{
  "success": false,
  "message": "Symbol 'XYZ' is not tracked. Supported symbols: RELIANCE, TCS, INFY, HDFCBANK, ZOMATO, WIPRO, ICICIBANK, SBIN, TATAMOTORS, NIFTY50"
}
```

---

### `GET /api/v1/market/feed-status`

Returns metadata about the active market feed. Used by the Admin Panel.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "mode": "SIMULATION",
    "lastUpdated": "2026-09-28T19:05:32",
    "trackedSymbols": 10,
    "description": "Market data is being simulated with ±0.2% Gaussian fluctuation every 2 seconds. Connect Upstox to switch to LIVE mode."
  }
}
```

| Field | Type | Values |
|---|---|---|
| `mode` | `String` | `SIMULATION` (Phase 1) or `LIVE` (Phase 5, after Upstox OAuth) |
| `lastUpdated` | `LocalDateTime` | ISO-8601 timestamp of last `@Scheduled` tick |
| `trackedSymbols` | `int` | Always `10` in Phase 1 |
| `description` | `String` | Human-readable explanation of current mode |

---

## Error Handling

Handled by `GlobalExceptionHandler` (`@RestControllerAdvice`):

| Exception | HTTP Status | When Thrown |
|---|---|---|
| `ResourceNotFoundException` | `404 Not Found` | Unknown symbol / alert ID not found |
| `IllegalArgumentException` | `400 Bad Request` | Unsupported symbol, already-inactive cancel |
| `MethodArgumentNotValidException` | `400 Bad Request` | `@Valid` field failures (missing fields, blank strings) |
| `HttpMessageNotReadableException` | `400 Bad Request` | Missing request body or malformed JSON |
| `MethodArgumentTypeMismatchException` | `400 Bad Request` | Invalid path variable / query param format (e.g. invalid UUID) |
| `HttpRequestMethodNotSupportedException` | `405 Method Not Allowed` | Calling endpoint with unsupported HTTP verb |
| `Exception` (catch-all) | `500 Internal Server Error` | Unexpected failures |

**All errors use the same uniform JSON format:**
```json
{
  "success": false,
  "message": "Descriptive error message here"
}
```

---

## Redis Key Contract

> **Critical**: `SimulatedMarketFeed` and `UpstoxLiveMarketFeed` (Phase 5) write to the **exact same Redis keys**. The rest of the system is feed-agnostic.

| Key Pattern | Type | Content | Example |
|---|---|---|---|
| `price:{SYMBOL}` | String | Current price, 2 decimal places | `price:RELIANCE` → `"2451.23"` |
| `price_history:{SYMBOL}` | List | Last 20 ticks, most recent at head | `price_history:TCS` → `["3802.11", "3800.55", ...]` |

---

## Database Schema

Flyway migrations in `src/main/resources/db/migration/`:

### `V1__create_stock_orders_table.sql`
```sql
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
    -- Status flow: PENDING → FUNDS_RESERVED → EXECUTED → FAILED → COMPENSATED
    wallet_hold_ref VARCHAR(100),
    failure_reason  TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `V2__create_holdings_table.sql`
```sql
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
```

### `V3__create_price_alerts_table.sql`
```sql
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

---

## Postman Collection & Testing

### Collections in PayNexus Workspace

Workspace ID: `0fc284b6-fcca-4a8c-8456-ff21631d0f7b` (**PayNexus**)

1. **`PayNexus - Order Engine Phase 2 (Price Alerts)`** (UID: `50886880-ef3ce7c5-8c17-4efd-987f-7261d4d54e76`)  
   Dedicated Phase 2 test suite containing 12 requests with 37 assertions testing alert creation, active alert query, automatic threshold triggering, soft-deletion, and validation boundaries.

2. **`PayNexus - Order Engine Phase 3 (Stock Orders Saga)`** (UID: `50886880-e6f4fa96-c3c7-43aa-aa96-1c7b09fb759b`)  
   Dedicated Phase 3 test suite containing 9 requests with 39 assertions testing BUY saga execution, Redis idempotency caching, paginated order history with status filter, SELL saga execution, insufficient holdings 422 error, missing field validation, and unsupported symbol validation.

3. **`PayNexus - Order Engine Service`** (UID: `50886880-16f81ca6-8521-4bab-88e2-7450382428ec`)  
   Full Order Engine collection containing both Market Data (Phase 1) and Price Alerts Engine (Phase 2).

**Key collection variables:**  
- `orderEngineUrl` / `base_url` / `baseUrl`: `http://localhost:8083`  
- `test_user_id`: `a0141d67-c2fb-446b-92f6-3d751461e25a`  
- `aaravId`: `b595ea4c-4baa-48a0-84ec-b4dfc272c47c`  
- `priyaId`: `672cc9ab-3c63-4c28-935e-271b58899a1c`  
- `alertId`, `cancelId`, `triggerAlertId`: dynamic runtime variables set by test scripts  
- `buy_idempotency_key`, `sell_idempotency_key`, `last_order_id`: dynamic runtime variables set by Phase 3 scripts  

---

### Newman Results — Phase 1 (Market Data)

```
PayNexus - Order Engine Service
  Market Data
    1. Get All Market Prices                   [200 OK] ✅ 7 assertions
    2. Get Single Stock Price - RELIANCE       [200 OK] ✅ 6 assertions
    3. Get Single Stock Price - TCS (lowercase)[200 OK] ✅ 3 assertions
    4. Get Single Stock Price - NIFTY50        [200 OK] ✅ 3 assertions
    5. Get Unknown Symbol - 404                [404   ] ✅ 4 assertions
    6. Get Market Feed Status                  [200 OK] ✅ 7 assertions
    7. Verify Prices Change Over Time          [200 OK] ✅ 3 assertions

┌─────────────────────────┬──────────┬────────┐
│                         │ executed │ failed │
├─────────────────────────┼──────────┼────────┤
│ iterations              │        1 │      0 │
│ requests                │        7 │      0 │
│ assertions              │       33 │      0 │
└─────────────────────────┴──────────┴────────┘
Total run duration: 809ms | Avg response time: 36ms
```

### Newman Results — Phase 2 (Price Alerts)

```
PayNexus - Order Engine Phase 2 (Price Alerts)

  1. Create Alert (ABOVE - persists)                  [201 Created ]  ✅ 5 assertions
  2. Create Alert (BELOW - auto-triggers)             [201 Created ]  ✅ 4 assertions
  3. Create Alert (Validation: invalid direction)     [400 Bad Req ]  ✅ 3 assertions
  4. Create Alert (Validation: unsupported symbol)    [400 Bad Req ]  ✅ 3 assertions
  5. Get Active Alerts (Aarav)                        [200 OK      ]  ✅ 5 assertions
  6. Get Active Alerts (empty user)                   [200 OK      ]  ✅ 2 assertions
  7. Feed Status (wait 4s for auto-trigger)           [200 OK      ]  ✅ 2 assertions
  8. Verify auto-triggered alert gone (Priya)         [200 OK      ]  ✅ 2 assertions
  9. Cancel Alert (soft delete)                       [200 OK      ]  ✅ 3 assertions
  10. Cancel Already Inactive Alert                   [400 Bad Req ]  ✅ 3 assertions
  11. Cancel Non-existent Alert                       [404 Not Found]  ✅ 3 assertions
  12. Verify Aarav alerts empty after cancel          [200 OK      ]  ✅ 2 assertions

┌─────────────────────────┬──────────┬────────┐
│                         │ executed │ failed │
├─────────────────────────┼──────────┼────────┤
│ iterations              │        1 │      0 │
│ requests                │       12 │      0 │
│ test-scripts            │       12 │      0 │
│ assertions              │       37 │      0 │
└─────────────────────────┴──────────┴────────┘
Total run duration: 5.1s | Avg response time: 15ms | Failed: 0
```

### Newman Results — Phase 3 (Stock Orders Saga)

```
PayNexus - Order Engine Phase 3 (Stock Orders Saga)

  1. BUY Stock Order (RELIANCE x3)                    [201 Created ]  ✅ 9 assertions
  2. BUY Idempotency (Same Key Returns Cached Result) [201 Created ]  ✅ 3 assertions
  3. Order History (All Orders for User)              [200 OK      ]  ✅ 5 assertions
  4. Order History Filtered by Status=EXECUTED        [200 OK      ]  ✅ 3 assertions
  5. SELL Stock Order (RELIANCE x1)                   [201 Created ]  ✅ 7 assertions
  6. SELL Error: Insufficient Holdings (422)          [422 Unproc  ]  ✅ 3 assertions
  7. BUY Validation Error: Missing userId (400)       [400 Bad Req ]  ✅ 3 assertions
  8. BUY Unsupported Symbol (400)                     [400 Bad Req ]  ✅ 3 assertions
  9. Order History: Invalid Status Filter (400)       [400 Bad Req ]  ✅ 3 assertions

┌─────────────────────────┬──────────┬────────┐
│                         │ executed │ failed │
├─────────────────────────┼──────────┼────────┤
│ iterations              │        1 │      0 │
│ requests                │        9 │      0 │
│ test-scripts            │        9 │      0 │
│ prerequest-scripts      │        2 │      0 │
│ assertions              │       39 │      0 │
└─────────────────────────┴──────────┴────────┘
Total run duration: 859ms | Avg response time: 16ms | Failed: 0
```

### Newman Results — Full Combined Suite (Phase 1 + Phase 2)

```
PayNexus - Order Engine Service (Full Suite)

┌─────────────────────────┬──────────┬────────┐
│                         │ executed │ failed │
├─────────────────────────┼──────────┼────────┤
│ iterations              │        1 │      0 │
│ requests                │       19 │      0 │
│ test-scripts            │       19 │      0 │
│ assertions              │       70 │      0 │
└─────────────────────────┴──────────┴────────┘
Total run duration: 5.9s | Avg response time: 17ms | Failed: 0
```

### Running Tests Locally

```bash
# Phase 1 - Market Data (7 requests, 33 assertions)
npx newman run order-engine-service/postman/PayNexus_OrderEngine_MarketData.postman_collection.json --reporters cli

# Phase 2 - Price Alerts (12 requests, 37 assertions)
npx newman run order-engine-service/postman/PayNexus_Alerts_Phase2.postman_collection.json --reporters cli

# Phase 3 - Stock Orders Saga (9 requests, 39 assertions)
npx newman run order-engine-service/postman/PayNexus_OrderEngine_Phase3_StockOrders.postman_collection.json --reporters cli

# Full Suite - Market Data + Price Alerts (19 requests, 70 assertions)
npx newman run order-engine-service/postman/PayNexus_OrderEngine_Full.postman_collection.json --reporters cli
```

---

## Key Design Decisions

### 1. In-Memory Map + Redis (Dual Write)
`SimulatedMarketFeed` maintains an in-memory `ConcurrentHashMap` for near-zero-latency reads on `getAllPrices()`, while also writing to Redis for persistence and history. This prevents Redis round-trips on the hot path.

### 2. Same Redis Keys as Live Feed
`SimulatedMarketFeed` and `UpstoxLiveMarketFeed` (Phase 5) write to identical Redis keys (`price:{SYMBOL}`, `price_history:{SYMBOL}`). The rest of the system is completely feed-agnostic — switching to Upstox requires only starting the WebSocket client.

### 3. Uniform ApiResponse Wrapper
All endpoints wrap responses in `ApiResponse<T> { success, message, data }` — same pattern as `wallet-service`. `null` fields are excluded from JSON (`@JsonInclude(NON_NULL)`).

### 4. Case-Insensitive Symbol Lookup
`getPriceBySymbol()` calls `symbol.toUpperCase()` before Redis lookup, so `reliance`, `RELIANCE`, and `Reliance` all work correctly.

### 5. Flyway — Never Modify Existing Scripts
Schema changes always get a **new** `V{N}__description.sql` file. Existing migrations are immutable. (`ddl-auto: validate` ensures Hibernate never touches the schema.)

### 6. `@EnableScheduling` on Main Class
The `@Scheduled(fixedDelay = 2000)` in `SimulatedMarketFeed` requires `@EnableScheduling` on `OrderEngineServiceApplication`. This is already in place.

---

---

## Phase 2 — Price Alerts — Full Request/Response Reference

### `POST /api/v1/alerts`

Create a price alert. Auto-triggers when `SimulatedMarketFeed` crosses the threshold.

**Request Body** (`Content-Type: application/json`):
```json
{
  "userId": "b595ea4c-4baa-48a0-84ec-b4dfc272c47c",
  "symbol": "RELIANCE",
  "targetPrice": 2500.00,
  "direction": "ABOVE"
}
```

| Field | Type | Validation | Notes |
|---|---|---|---|
| `userId` | `UUID` | `@NotNull` | Must be a valid UUID |
| `symbol` | `String` | `@NotBlank` | One of 10 supported NSE symbols (case-insensitive) |
| `targetPrice` | `BigDecimal` | `@NotNull`, `@DecimalMin("0.01")` | Must be positive |
| `direction` | `String` | `@Pattern(ABOVE\|BELOW)` | Exactly `ABOVE` or `BELOW` |

**Response `201 Created`**:
```json
{
  "success": true,
  "message": "Price alert created successfully",
  "data": {
    "alertId": "4b1c486d-1a4a-44fe-bc52-654dde5a72ec",
    "userId": "b595ea4c-4baa-48a0-84ec-b4dfc272c47c",
    "symbol": "RELIANCE",
    "targetPrice": 2500.00,
    "direction": "ABOVE",
    "isActive": true,
    "triggeredAt": null,
    "createdAt": "2026-09-29T00:10:00Z"
  }
}
```

**Response `400 Bad Request`** (validation failure):
```json
{ "success": false, "message": "direction: must match \"ABOVE|BELOW\"" }
```

**Response `400 Bad Request`** (unsupported symbol):
```json
{ "success": false, "message": "Symbol 'DOGECOIN' is not supported. Supported: RELIANCE, TCS, ..." }
```

---

### `GET /api/v1/alerts/{userId}`

Returns **only active** (`isActive=true`) alerts for a user. Triggered/cancelled alerts are excluded.

**Path Parameter**: `userId` — UUID of the user.

**Response `200 OK`** (with alerts):
```json
{
  "success": true,
  "message": "Found 2 active alert(s)",
  "data": [
    {
      "alertId": "4b1c486d-...",
      "userId": "b595ea4c-...",
      "symbol": "RELIANCE",
      "targetPrice": 2500.00,
      "direction": "ABOVE",
      "isActive": true,
      "triggeredAt": null,
      "createdAt": "2026-09-29T00:10:00Z"
    }
  ]
}
```

**Response `200 OK`** (no alerts / unknown user):
```json
{ "success": true, "message": "Found 0 active alert(s)", "data": [] }
```
> Unknown `userId` returns an empty list — **not** a 404.

---

### `DELETE /api/v1/alerts/{alertId}`

Soft-cancels an alert — sets `isActive=false`. Never hard-deletes (keeps audit history).

**Path Parameter**: `alertId` — UUID of the alert to cancel.

**Response `200 OK`**:
```json
{ "success": true, "message": "Alert cancelled successfully" }
```

**Response `400 Bad Request`** (already inactive):
```json
{ "success": false, "message": "Alert <uuid> is already inactive." }
```

**Response `404 Not Found`** (doesn't exist):
```json
{ "success": false, "message": "Alert not found: <uuid>" }
```

---

### Auto-Trigger Behaviour

After every `SimulatedMarketFeed` tick (every ~2s), `PriceAlertService.checkAlerts(symbol, price)` is called:

```
ABOVE alert: triggers when currentPrice >= targetPrice
BELOW alert: triggers when currentPrice <= targetPrice
```

On trigger:
- `isActive` → `false`
- `triggeredAt` → `OffsetDateTime.now()`
- Persisted via `alertRepository.save(alert)`
- Logged: `Alert TRIGGERED: alertId=... userId=... symbol=... direction=... target=... currentPrice=...`

---

## Phase 3 — Stock Order Saga — Architecture & Full Reference

Phase 3 implements distributed paper trading stock execution using the **Saga Pattern** across `order-engine-service` and `wallet-service`, guaranteed by **Resilience4j Circuit Breaker**, **Redis distributed idempotency**, and **atomic double-entry accounting**.

---

### Saga State Machine

```
       [ Client Request ]
               │
               ▼
       [ STEP 0: Pre-checks ] ──(Duplicate key hit)──► Return Cached OrderResponse
               │
               │ (Valid, new request)
               ▼
       [ INSERT StockOrder (PENDING) ]
               │
               ▼
    [ STEP 1: Reserve Funds ]
       POST /internal/wallet/hold
               │
       ┌───────┴───────┐
    SUCCESS         FAILURE (Insufficient funds / Circuit Breaker)
       │               │
       ▼               ▼
[ Status: FUNDS_RESERVED ]   [ Status: FAILED ] ──► Return 422 Unprocessable Entity
       │
       ▼
 [ STEP 2: Execute Order ]
    executedPrice = currentPrice from Redis
    totalValue = executedPrice × quantity
       │
       ▼
 [ STEP 3: Settle Funds ]
    POST /internal/wallet/settle
       │
       ┌───────┴───────┐
    SUCCESS         FAILURE
       │               │
       ▼               ▼
[ Update Holdings (WAP) ]    [ COMPENSATION: Release Funds ]
[ Status: EXECUTED      ]       POST /internal/wallet/release
[ Cache in Redis (120s) ]    [ Status: COMPENSATED ]
       │                       │
       ▼                       ▼
Return 201 Created           Return 422 / 500
```

---

### SELL Saga Flow

```
       [ Client Request ]
               │
               ▼
       [ STEP 0: Pre-checks ]
        1. Redis Idempotency check
        2. Holdings verification: user must own >= requested quantity
           (If holdings < requested qty → Throw InsufficientHoldingsException → 422)
               │
               ▼
       [ INSERT StockOrder (PENDING) ]
               │
               ▼
       [ STEP 1: Credit Proceeds ]
        POST /internal/wallet/credit (proceeds = quantity × currentPrice)
               │
       ┌───────┴───────┐
    SUCCESS         FAILURE
       │               │
       ▼               ▼
[ STEP 2: Update Holdings ]   [ Status: FAILED ] ──► Return 422
  Reduce quantity or DELETE
  holding row if newQty == 0
[ Status: EXECUTED ]
[ Cache in Redis (120s) ]
       │
       ▼
Return 201 Created
```

---

### Holdings Weighted Average Price Calculation

When buying stocks, existing holdings are updated with a revised weighted average buy price:

$$\text{newQuantity} = \text{oldQuantity} + \text{boughtQuantity}$$

$$\text{newAvgBuyPrice} = \frac{\text{totalInvested} + (\text{executedPrice} \times \text{boughtQuantity})}{\text{newQuantity}}$$

$$\text{newTotalInvested} = \text{newAvgBuyPrice} \times \text{newQuantity}$$

If the user does not yet own shares of the stock, a new `Holding` record is inserted with `quantity`, `avgBuyPrice = executedPrice`, and `totalInvested = executedPrice × quantity`.

---

### Resilience4j Circuit Breaker & Feign Client

Configured in `application.yaml` for inter-service communication with `WALLET-SERVICE`:

```yaml
feign:
  circuitbreaker:
    enabled: true

resilience4j:
  circuitbreaker:
    instances:
      walletService:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 5s
        permittedNumberOfCallsInHalfOpenState: 3
        registerHealthIndicator: true
  retry:
    instances:
      walletService:
        maxAttempts: 2
        waitDuration: 500ms
```

**`WalletServiceFallbackFactory`** catches timeouts, connection errors, and downstream 5xx errors:
- If `holdFunds` fails: Throws `ServiceUnavailableException` → order is saved as `FAILED` (no funds deducted).
- If `settleFunds` fails: Throws `ServiceUnavailableException` → triggers saga compensation (`releaseFunds`) and saves order as `COMPENSATED`.
- If `creditWallet` fails: Throws `ServiceUnavailableException` → preserves user holdings and marks order as `FAILED`.

---

### Idempotency via Redis

- Header: `X-Idempotency-Key: <UUID>` (auto-generated if not supplied by client).
- Key Format: `order:idem:{idempotencyKey}` with TTL `120 seconds`.
- Behavior: If an identical key is received within 120 seconds, the cached `OrderResponse` is returned instantly without executing trades or touching wallet balances.

---

### Phase 3 REST API Reference

#### 1. `POST /api/v1/orders/buy`

Places a BUY order for a supported NSE stock.

**Headers**:
- `Content-Type: application/json`
- `X-Idempotency-Key`: *(Optional)* UUID string. Recommended to prevent double purchases.

**Request Body**:
```json
{
  "userId": "a0141d67-c2fb-446b-92f6-3d751461e25a",
  "symbol": "RELIANCE",
  "quantity": 3,
  "transactionPin": "123456"
}
```

| Field | Type | Validation | Description |
|---|---|---|---|
| `userId` | `UUID` | `@NotNull` | User's wallet UUID |
| `symbol` | `String` | `@NotBlank` | Supported NSE symbol (case-insensitive) |
| `quantity` | `Integer` | `@NotNull`, `@Min(1)` | Number of shares to buy |
| `transactionPin` | `String` | `@NotBlank`, `@Pattern(^[0-9]{4,6}$)` | 4-6 digit wallet transaction PIN |

**Response `201 Created`**:
```json
{
  "success": true,
  "message": "BUY order processed",
  "data": {
    "orderId": "9ffcf9ea-ae21-4fb0-91ac-0bcf85a2b0a3",
    "status": "EXECUTED",
    "orderType": "BUY",
    "symbol": "RELIANCE",
    "quantity": 3,
    "executedPrice": 2451.23,
    "totalValue": 7353.69,
    "createdAt": "2026-09-29T14:22:38Z"
  }
}
```

**Response `400 Bad Request`** (Validation failure):
```json
{
  "success": false,
  "message": "userId: must not be null"
}
```

**Response `400 Bad Request`** (Unsupported symbol):
```json
{
  "success": false,
  "message": "Symbol 'DOGECOIN' is not supported. Supported: RELIANCE, TCS, INFY, HDFCBANK, ZOMATO, WIPRO, ICICIBANK, SBIN, TATAMOTORS, NIFTY50"
}
```

**Response `422 Unprocessable Entity`** (Insufficient balance or invalid PIN):
```json
{
  "success": false,
  "message": "Order failed: Insufficient wallet balance to reserve funds."
}
```

**Response `503 Service Unavailable`** (Downstream wallet circuit breaker open):
```json
{
  "success": false,
  "message": "Wallet service is currently unavailable. No funds were held. Please try again later."
}
```

---

#### 2. `POST /api/v1/orders/sell`

Places a SELL order for a supported NSE stock.

**Headers**:
- `Content-Type: application/json`
- `X-Idempotency-Key`: *(Optional)* UUID string.

**Request Body**:
```json
{
  "userId": "a0141d67-c2fb-446b-92f6-3d751461e25a",
  "symbol": "RELIANCE",
  "quantity": 1,
  "transactionPin": "123456"
}
```

**Response `201 Created`**:
```json
{
  "success": true,
  "message": "SELL order processed",
  "data": {
    "orderId": "e4922119-913a-4ef8-879e-4dfaa220d912",
    "status": "EXECUTED",
    "orderType": "SELL",
    "symbol": "RELIANCE",
    "quantity": 1,
    "executedPrice": 2451.23,
    "totalValue": 2451.23,
    "createdAt": "2026-09-29T14:22:43Z"
  }
}
```

**Response `422 Unprocessable Entity`** (Insufficient holdings):
```json
{
  "success": false,
  "message": "Insufficient holdings for symbol RELIANCE. You currently own 0 shares, requested to sell 5."
}
```

---

#### 3. `GET /api/v1/orders/{userId}/history`

Retrieves paginated order history for a user with optional status and order type filters.

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `userId` | `UUID` | User's UUID |

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | `int` | `0` | Page index (0-based) |
| `size` | `int` | `20` | Page size (max 100) |
| `status` | `String` | *(optional)* | Filter by status: `PENDING`, `FUNDS_RESERVED`, `EXECUTED`, `FAILED`, `COMPENSATED` |
| `orderType` | `String` | *(optional)* | Filter by type: `BUY`, `SELL` |

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Order history retrieved",
  "data": [
    {
      "orderId": "9ffcf9ea-ae21-4fb0-91ac-0bcf85a2b0a3",
      "status": "EXECUTED",
      "orderType": "BUY",
      "symbol": "RELIANCE",
      "quantity": 3,
      "executedPrice": 2451.23,
      "totalValue": 7353.69,
      "createdAt": "2026-09-29T14:22:38Z"
    },
    {
      "orderId": "e4922119-913a-4ef8-879e-4dfaa220d912",
      "status": "EXECUTED",
      "orderType": "SELL",
      "symbol": "RELIANCE",
      "quantity": 1,
      "executedPrice": 2451.23,
      "totalValue": 2451.23,
      "createdAt": "2026-09-29T14:22:43Z"
    }
  ]
}
```

**Response `400 Bad Request`** (Invalid status filter):
```json
{
  "success": false,
  "message": "Invalid status filter: BADSTATUS. Allowed: PENDING, FUNDS_RESERVED, EXECUTED, FAILED, COMPENSATED"
}
```

---

## Portfolio & Live Unrealized P&L (Phase 4)

Phase 4 enriches user stock holdings stored in PostgreSQL with real-time market prices from Redis (`price:{SYMBOL}`) to calculate real-time market valuations and unrealized profits & losses (P&L).

```
                      ┌─────────────────────────────────┐
                      │    PostgreSQL (holdings table)  │
                      │  - quantity                     │
                      │  - avg_buy_price                │
                      │  - total_invested               │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
 ┌───────────────┐          ┌──────────────────────┐
 │ User Request  │ ───────► │   PortfolioService   │
 └───────────────┘          └──────────┬───────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │       Redis (price:{SYMBOL})    │
                      │  - Real-time currentPrice (O(1))│
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                       Enriched Holding & Portfolio Math:
        currentValue    = quantity × currentPrice
        unrealizedPnl   = currentValue - totalInvested
        pnlPercent      = (unrealizedPnl / totalInvested) × 100
        pnlDirection    = "PROFIT" | "LOSS" | "NEUTRAL"
```

### Phase 4 REST API Reference

#### 1. `GET /api/v1/portfolio/{userId}`

Retrieves the user's complete portfolio, including individual holdings enriched with live prices, plus aggregated portfolio metrics (total invested, total current value, overall unrealized P&L, and portfolio P&L percentage).

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `userId` | `UUID` | User's unique identifier |

**Response `200 OK` (User with Active Holdings)**:
```json
{
  "success": true,
  "message": "Portfolio retrieved with 2 stock(s)",
  "data": {
    "userId": "a0141d67-c2fb-446b-92f6-3d751461e25a",
    "holdings": [
      {
        "holdingId": "fa56ad17-6f41-458a-9a51-5ce022b4f0b1",
        "symbol": "TCS",
        "quantity": 1,
        "avgBuyPrice": 3793.65,
        "totalInvested": 7587.30,
        "currentPrice": 3770.20,
        "currentValue": 3770.20,
        "unrealizedPnl": -3817.10,
        "pnlPercent": -50.31,
        "pnlDirection": "LOSS",
        "updatedAt": "2026-09-29T14:22:43.294866Z"
      },
      {
        "holdingId": "781eb43e-cad0-4e16-a1f9-464bd0d85bfc",
        "symbol": "RELIANCE",
        "quantity": 9,
        "avgBuyPrice": 3853.44,
        "totalInvested": 38534.40,
        "currentPrice": 2420.19,
        "currentValue": 21781.71,
        "unrealizedPnl": -16752.69,
        "pnlPercent": -43.47,
        "pnlDirection": "LOSS",
        "updatedAt": "2026-09-29T16:21:31.08842Z"
      }
    ],
    "totalStocks": 2,
    "totalInvested": 46121.70,
    "totalCurrentValue": 25551.91,
    "totalUnrealizedPnl": -20569.79,
    "totalPnlPercent": -44.60,
    "overallPnlDirection": "LOSS"
  }
}
```

**Response `200 OK` (User with No Holdings)**:
```json
{
  "success": true,
  "message": "No holdings found for this user",
  "data": {
    "userId": "00000000-0000-0000-0000-000000000001",
    "holdings": [],
    "totalStocks": 0,
    "totalInvested": 0.00,
    "totalCurrentValue": 0.00,
    "totalUnrealizedPnl": 0.00,
    "overallPnlDirection": "NEUTRAL"
  }
}
```

---

#### 2. `GET /api/v1/portfolio/{userId}/holdings`

Retrieves a simplified array of enriched holdings for a user without portfolio-level aggregation. Designed for tabular UI widgets and stock list views.

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `userId` | `UUID` | User's unique identifier |

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Found 2 holding(s)",
  "data": [
    {
      "holdingId": "fa56ad17-6f41-458a-9a51-5ce022b4f0b1",
      "symbol": "TCS",
      "quantity": 1,
      "avgBuyPrice": 3793.65,
      "totalInvested": 7587.30,
      "currentPrice": 3748.31,
      "currentValue": 3748.31,
      "unrealizedPnl": -3838.99,
      "pnlPercent": -50.60,
      "pnlDirection": "LOSS",
      "updatedAt": "2026-09-29T14:22:43.294866Z"
    },
    {
      "holdingId": "781eb43e-cad0-4e16-a1f9-464bd0d85bfc",
      "symbol": "RELIANCE",
      "quantity": 9,
      "avgBuyPrice": 3853.44,
      "totalInvested": 38534.40,
      "currentPrice": 2416.03,
      "currentValue": 21744.27,
      "unrealizedPnl": -16790.13,
      "pnlPercent": -43.57,
      "pnlDirection": "LOSS",
      "updatedAt": "2026-09-29T16:21:31.08842Z"
    }
  ]
}
```

---

## API Gateway Routing

The API Gateway (`api-gateway` on port `8080`) provides reverse proxy routing and load balancing to `order-engine-service` via Spring Cloud Gateway and Netflix Eureka service discovery (`lb://order-engine-service`).

Configured in `api-gateway/src/main/resources/application.yaml`:

```yaml
spring:
  cloud:
    gateway:
      routes:
        # Market Data: Real-time simulated price feeds & feed status
        - id: order-engine-market
          uri: lb://order-engine-service
          predicates:
            - Path=/api/v1/market/**

        # Price Alerts: Alert CRUD operations
        - id: order-engine-alerts
          uri: lb://order-engine-service
          predicates:
            - Path=/api/v1/alerts/**

        # Stock Orders: BUY / SELL distributed saga & history
        - id: order-engine-orders
          uri: lb://order-engine-service
          predicates:
            - Path=/api/v1/orders/**

        # Portfolio & Live P&L: Valuation & holdings
        - id: order-engine-portfolio
          uri: lb://order-engine-service
          predicates:
            - Path=/api/v1/portfolio/**
```

All endpoints are reachable via the Gateway URL `http://localhost:8080/api/v1/...` with unified CORS handling for web and mobile frontends.

---

## Postman Collection & Automated Testing

### Collections in PayNexus Postman Workspace

The Postman collections for `order-engine-service` are published and synchronized in the **PayNexus** team workspace (Workspace ID: `0fc284b6-fcca-4a8c-8456-ff21631d0f7b`):

| Phase | Collection Name | Collection ID | Scope |
|---|---|---|---|
| **Phase 1** | `PayNexus - Order Engine Service` | `16f81ca6-8521-4bab-88e2-7450382428ec` | Market Feed & Price history |
| **Phase 2** | `PayNexus - Order Engine Phase 2 (Price Alerts)` | `ef3ce7c5-8c17-4efd-987f-7261d4d54e76` | Price Alert CRUD & trigger checks |
| **Phase 3** | `PayNexus - Order Engine Phase 3 (Stock Orders Saga)` | `e6f4fa96-c3c7-43aa-aa96-1c7b09fb759b` | BUY/SELL saga, idempotency, order history |
| **Phase 4** | `PayNexus - Order Engine Phase 4 (Portfolio & P&L)` | `1993dc13-c245-4058-ab8e-f8e2fcd091f4` | Full portfolio, live P&L, holdings, gateway routing |

### Automated Newman Test Execution (Phase 4)

The Phase 4 test suite executes automated assertions across both direct microservice ports (`:8083`) and API Gateway reverse proxy routing (`:8080`):

```bash
npx --yes newman run "order-engine-service/postman/PayNexus_OrderEngine_Phase4_Portfolio.postman_collection.json" --reporters cli --reporter-cli-no-banner
```

**Test Execution Results**:
```
PayNexus - Order Engine Phase 4 (Portfolio & P&L)

□ 4.1 — Empty User Portfolio & Holdings
└ GET Portfolio for Empty User
  GET http://localhost:8083/api/v1/portfolio/00000000-0000-0000-0000-000000000001 [200 OK, 415B, 27ms]
  √  Status is 200 OK
  √  Response indicates success
  √  Message indicates no holdings found
  √  Holdings array is empty
  √  Total stocks is 0
  √  Total invested is 0.00

└ GET Holdings for Empty User
  GET http://localhost:8083/api/v1/portfolio/00000000-0000-0000-0000-000000000001/holdings [200 OK, 220B, 9ms]
  √  Status is 200 OK
  √  Response indicates success
  √  Data is an empty array

□ 4.2 — User Portfolio with Live P&L Enrichment
└ GET Full Portfolio with Aggregated P&L
  GET http://localhost:8083/api/v1/portfolio/a0141d67-c2fb-446b-92f6-3d751461e25a [200 OK, 1.02kB, 189ms]
  √  Status is 200 OK
  √  Response indicates success
  √  User ID matches request
  √  User has at least 1 stock holding
  √  Total invested is a positive number
  √  Total current value is computed
  √  Total unrealized P&L is calculated
  √  Total P&L percent is calculated
  √  Overall P&L direction is valid
  √  Holdings array contains enriched stock items

□ 4.3 — User Holdings List (Per-Stock Position)
└ GET Enriched Holdings List
  GET http://localhost:8083/api/v1/portfolio/a0141d67-c2fb-446b-92f6-3d751461e25a/holdings [200 OK, 791B, 26ms]
  √  Status is 200 OK
  √  Response indicates success
  √  Data is an array of holdings
  √  Holding items contain live pricing and P&L metrics

□ 4.4 — API Gateway Reverse Proxy Routing (:8080)
└ GET Portfolio via Gateway
  GET http://localhost:8080/api/v1/portfolio/a0141d67-c2fb-446b-92f6-3d751461e25a [200 OK, 1.07kB, 42ms]
  √  Gateway forwards request with 200 OK
  √  Gateway response contains portfolio data

└ GET Holdings via Gateway
  GET http://localhost:8080/api/v1/portfolio/a0141d67-c2fb-446b-92f6-3d751461e25a/holdings [200 OK, 832B, 23ms]
  √  Gateway forwards request with 200 OK
  √  Gateway response contains holdings array

┌─────────────────────────┬───────────────────┬──────────────────┐
│                         │          executed │           failed │
├─────────────────────────┼───────────────────┼──────────────────┤
│              iterations │                 1 │                0 │
├─────────────────────────┼───────────────────┼──────────────────┤
│                requests │                 6 │                0 │
├─────────────────────────┼───────────────────┼──────────────────┤
│            test-scripts │                 6 │                0 │
├─────────────────────────┼───────────────────┼──────────────────┤
│      prerequest-scripts │                 0 │                0 │
├─────────────────────────┼───────────────────┼──────────────────┤
│              assertions │                27 │                0 │
├─────────────────────────┴───────────────────┴──────────────────┤
│ total run duration: 785ms                                      │
├────────────────────────────────────────────────────────────────┤
│ total data received: 3.28kB (approx)                           │
├────────────────────────────────────────────────────────────────┤
│ average response time: 52ms [min: 9ms, max: 189ms, s.d.: 61ms] │
└────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: 2026-10-19 | PayNexus — Alakh Agarwal | LNMIIT Jaipur*

