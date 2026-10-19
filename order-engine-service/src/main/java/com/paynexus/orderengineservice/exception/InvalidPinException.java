package com.paynexus.orderengineservice.exception;

/**
 * Thrown when a user submits an invalid transaction PIN during order placement.
 */
public class InvalidPinException extends RuntimeException {

    public InvalidPinException(String message) {
        super(message);
    }
}
