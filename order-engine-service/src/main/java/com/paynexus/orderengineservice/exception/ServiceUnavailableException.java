package com.paynexus.orderengineservice.exception;

/**
 * Thrown by WalletServiceFallbackFactory when wallet-service is unreachable
 * or the circuit breaker is OPEN. The OrderService saga catches this and
 * triggers a compensation transaction.
 */
public class ServiceUnavailableException extends RuntimeException {

    public ServiceUnavailableException(String message) {
        super(message);
    }

    public ServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
