package com.paynexus.walletservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

/** Returned after POST /api/v1/payments/initiate */
@Getter
@AllArgsConstructor
public class InitiatePaymentResponse {
    private String razorpayOrderId;    // "order_AbcXyz" — sent to frontend to open Razorpay checkout
    private BigDecimal amount;         // amount in INR
    private String currency;           // "INR"
    private String razorpayKeyId;      // public key for frontend
}
