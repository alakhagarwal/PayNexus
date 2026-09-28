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
                              idempotency_key VARCHAR(100) UNIQUE,
                              created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                              updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
