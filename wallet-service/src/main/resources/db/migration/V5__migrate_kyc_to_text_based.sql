-- V5: Migrate KYC from file-based (kyc_documents) to text-based (user_kyc)
--
-- REASON: Removing S3/file upload dependency. Users now submit their
-- PAN number, last 4 digits of Aadhaar, and date of birth for admin review.
-- This keeps the system simpler and removes external storage coupling.

-- Step 1: Drop the old file-based kyc_documents table
DROP TABLE IF EXISTS kyc_documents;

-- Step 2: Create the new text-based user_kyc table
-- One-to-one with users (UNIQUE on user_id).
CREATE TABLE user_kyc (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    pan_number          VARCHAR(10)  NOT NULL,          -- Format: ABCDE1234F (individual PAN)
    aadhaar_last_four   VARCHAR(4)   NOT NULL,          -- Last 4 digits only (full Aadhaar never stored)
    date_of_birth       DATE         NOT NULL,          -- Must be >= 18 years before submission
    submitted_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at         TIMESTAMP,
    remarks             VARCHAR(500)
);

CREATE INDEX idx_user_kyc_user_id ON user_kyc(user_id);
