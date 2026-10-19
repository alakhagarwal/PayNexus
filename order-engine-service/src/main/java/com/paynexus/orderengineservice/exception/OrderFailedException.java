package com.paynexus.orderengineservice.exception;

/**
 * Thrown when a stock order fails at any saga step (hold, settle, etc.)
 * and the saga must compensate (release funds).
 */
public class OrderFailedException extends RuntimeException {

    public OrderFailedException(String message) {
        super(message);
    }

    public OrderFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
