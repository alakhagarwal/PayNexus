package com.paynexus.walletservice.enums;

public enum TransactionType {
    CREDIT,   // Money added to available_balance (top-up, P2P received, stock SELL proceeds)
    DEBIT,    // Money removed from available_balance (P2P sent, stock BUY settle)
    HOLD,     // Money moved from available_balance → reserved_balance (stock BUY order placed)
    RELEASE   // Money moved back from reserved_balance → available_balance (order failed/cancelled)
}
