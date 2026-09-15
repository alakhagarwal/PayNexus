package com.paynexus.walletservice.exception;

public class WalletNotFoundException extends RuntimeException {
    public WalletNotFoundException() { super("Wallet not found"); }
    public WalletNotFoundException(String message) { super(message); }
}
