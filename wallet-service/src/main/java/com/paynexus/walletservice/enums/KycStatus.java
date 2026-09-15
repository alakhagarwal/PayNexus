package com.paynexus.walletservice.enums;

public enum KycStatus {
    PENDING,    // Default — user registered but has not submitted KYC documents
    SUBMITTED,  // User uploaded documents; awaiting admin review
    VERIFIED,   // Admin approved — user gets higher transaction limits
    REJECTED    // Admin rejected — user must re-submit
}
