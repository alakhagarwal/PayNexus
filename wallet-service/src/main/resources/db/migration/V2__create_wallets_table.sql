-- V2: Create wallets table
-- One wallet per user (enforced by UNIQUE constraint on user_id).
-- available_balance = money user can spend
-- reserved_balance  = money held for pending stock orders (not spendable)
-- @Version column maps to Hibernate's optimistic locking — prevents lost updates.
CREATE TABLE wallets (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reserved_balance  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency          VARCHAR(3)   NOT NULL DEFAULT 'INR',
    is_frozen         BOOLEAN      NOT NULL DEFAULT FALSE,
    daily_spent       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    daily_limit       NUMERIC(15,2) NOT NULL DEFAULT 50000.00,
    version           BIGINT       NOT NULL DEFAULT 0,         -- Hibernate optimistic lock counter
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_available_balance CHECK (available_balance >= 0),
    CONSTRAINT chk_reserved_balance  CHECK (reserved_balance  >= 0),
    CONSTRAINT chk_daily_spent       CHECK (daily_spent       >= 0)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
