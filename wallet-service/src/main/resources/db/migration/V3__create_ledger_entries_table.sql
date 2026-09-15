-- V3: Create ledger_entries table
-- IMMUTABLE by design. Only INSERTs happen here — never UPDATE or DELETE.
-- Every rupee movement (credit, debit, hold, release) creates one row here.
-- reference_id is UNIQUE to enforce idempotency at the database level.
CREATE TABLE ledger_entries (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        UUID          NOT NULL REFERENCES wallets(id),
    transaction_type VARCHAR(16)   NOT NULL,
    amount           NUMERIC(15,2) NOT NULL,
    running_balance  NUMERIC(15,2) NOT NULL,                    -- snapshot of balance AFTER this entry
    reference_id     VARCHAR(100)  NOT NULL UNIQUE,             -- idempotency key (payment_id, transfer_id, etc.)
    narration        VARCHAR(255),
    related_user_id  UUID,                                      -- the other party in a P2P transfer
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ledger_type CHECK (transaction_type IN ('CREDIT','DEBIT','HOLD','RELEASE')),
    CONSTRAINT chk_ledger_amount CHECK (amount > 0)
);

CREATE INDEX idx_ledger_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_created_at ON ledger_entries(wallet_id, created_at DESC);
