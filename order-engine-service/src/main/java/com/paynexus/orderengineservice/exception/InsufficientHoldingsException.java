package com.paynexus.orderengineservice.exception;

/**
 * Thrown when a user tries to SELL more shares than they hold.
 */
public class InsufficientHoldingsException extends RuntimeException {

    public InsufficientHoldingsException(String message) {
        super(message);
    }
}
