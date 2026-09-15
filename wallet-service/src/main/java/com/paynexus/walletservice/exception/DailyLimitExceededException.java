package com.paynexus.walletservice.exception;

public class DailyLimitExceededException extends RuntimeException {
    public DailyLimitExceededException() { super("Daily transaction limit exceeded. Limit resets at midnight."); }
    public DailyLimitExceededException(String message) { super(message); }
}
