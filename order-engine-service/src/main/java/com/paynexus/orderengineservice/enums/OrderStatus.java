package com.paynexus.orderengineservice.enums;

/**
 * Possible lifecycle states of a StockOrder.
 * Flow: PENDING -> FUNDS_RESERVED -> EXECUTED
 *                               -> FAILED -> COMPENSATED
 */
public enum OrderStatus {
    PENDING,
    FUNDS_RESERVED,
    EXECUTED,
    FAILED,
    COMPENSATED
}