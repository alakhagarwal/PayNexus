package com.paynexus.walletservice.exception;

public class InsufficientBalanceException extends RuntimeException {
    public InsufficientBalanceException(String message) { super(message); }
    public InsufficientBalanceException() { super("Insufficient wallet balance for this transaction"); }
}
