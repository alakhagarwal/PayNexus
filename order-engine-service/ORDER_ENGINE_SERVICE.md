# 🏦 Order Engine Service

> **Port**: `8083` | **Spring Boot**: `3.3.4` | **Spring Cloud**: `2023.0.3`  
> **Databases**: PostgreSQL + Redis  
> **Status**: Phase 1 ✅ (Market Feed) | Phase 2 ✅ (Price Alerts Engine)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Phase Status](#phase-status)
3. [Running the Service](#running-the-service)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Request & Response Formats](#request--response-formats)
6. [Error Handling](#error-handling)
7. [Redis Key Contract](#redis-key-contract)
8. [Database Schema](#database-schema)
9. [Postman Collection & Testing](#postman-collection--testing)
10. [Key Design Decisions](#key-design-decisions)

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
    └── [Phase 3] Feign → wallet-service (8082) internal endpoints
        POST /internal/wallet/hold
        POST /internal/wallet/settle
        POST /internal/wallet/release
        POST /internal/wallet/credit
        POST /internal/wallet/verify-pin
```

---

## Phase Status

| Phase | Feature | Status |
|---|---|---|
| **Phase 1** | Project setup, Flyway migrations, Simulated Market Feed | ✅ Complete |
| **Phase 2** | Price Alerts engine (CRUD + auto-trigger) | ✅ Complete |
| **Phase 3** | Stock Order Saga (BUY/SELL) | ⏳ Pending |
| **Phase 4** | Portfolio & P&L | ⏳ Pending |
| **Phase 5** | Upstox OAuth + Live Market Feed | ⏳ Pending |

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

### Phase 3 — Order Endpoints (Planned)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/orders/buy` | Place BUY order (triggers Saga) |
| `POST` | `/api/v1/orders/sell` | Place SELL order (triggers Saga) |
| `GET` | `/api/v1/orders/{userId}/history` | Paginated order history |

### Phase 4 — Portfolio Endpoints (Planned)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/portfolio/{userId}` | Full portfolio with live P&L |
| `GET` | `/api/v1/portfolio/{userId}/holdings` | Raw holdings list |

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
| `MethodArgumentNotValidException` | `400 Bad Request` | `@Valid` failures (missing fields, bad direction) |
| `Exception` (catch-all) | `500 Internal Server Error` | Unexpected failures |

**All errors use the same format:**
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

### Collection in PayNexus Workspace

**Collection**: `PayNexus - Order Engine Service` (ID: `16f81ca6-8521-4bab-88e2-7450382428ec`)  
**Environment**: `PayNexus - Local Dev` — select before running  
**Key env variables**: `orderEngineUrl = http://localhost:8083`, `aaravId`, `priyaId`

Folders inside the collection:
- `Market Data` — Phase 1 (7 requests)
- `Price Alerts (Phase 2)` — Phase 2 (12 requests)

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
Total run duration: 5.1s | Avg response time: 11ms
```

### Running Tests Locally

```bash
# Phase 1 - Market Data
npx newman run order-engine-service/postman/PayNexus_OrderEngine_MarketData.postman_collection.json --reporters cli

# Phase 2 - Price Alerts
npx newman run order-engine-service/postman/PayNexus_Alerts_Phase2.postman_collection.json --reporters cli
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

*Last Updated: 2026-09-29 | PayNexus — Alakh Agarwal | LNMIIT Jaipur*
