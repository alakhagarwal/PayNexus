package com.paynexus.walletservice.exception;

/**
 * Thrown when an idempotency key was already used within the TTL window (120 seconds).
 * This prevents accidental double-submissions (e.g., user double-clicking the transfer button).
 */
public class DuplicateIdempotencyKeyException extends RuntimeException {
    public DuplicateIdempotencyKeyException(String message) { super(message); }
}
