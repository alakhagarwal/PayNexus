-- V4: Create kyc_documents table
-- Stores KYC document metadata (actual files stored in object storage like S3).
CREATE TABLE kyc_documents (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,                         -- e.g., AADHAAR, PAN, PASSPORT
    document_url  VARCHAR(500) NOT NULL,                        -- S3/Cloud URL to the document
    submitted_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at   TIMESTAMP,
    remarks       VARCHAR(500)
);

CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);
