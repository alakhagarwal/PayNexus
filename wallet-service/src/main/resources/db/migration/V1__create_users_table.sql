-- V1: Create users table
-- Stores registered users. Password and PIN are BCrypt-hashed, never plain text.
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(100)  NOT NULL,
    email                VARCHAR(150)  NOT NULL UNIQUE,
    password_hash        VARCHAR(255)  NOT NULL,
    transaction_pin_hash VARCHAR(255),                          -- NULL until user sets a PIN
    kyc_status           VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_kyc_status CHECK (kyc_status IN ('PENDING','SUBMITTED','VERIFIED','REJECTED'))
);

CREATE INDEX idx_users_email ON users(email);
