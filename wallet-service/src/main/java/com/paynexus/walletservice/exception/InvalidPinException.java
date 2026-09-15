package com.paynexus.walletservice.exception;

public class InvalidPinException extends RuntimeException {
    public InvalidPinException(String message) { super(message); }
    public InvalidPinException() { super("Invalid transaction PIN"); }
}
