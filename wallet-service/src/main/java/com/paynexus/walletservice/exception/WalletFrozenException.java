package com.paynexus.walletservice.exception;

public class WalletFrozenException extends RuntimeException {
    public WalletFrozenException() { super("Wallet is frozen. Please contact support."); }
}
