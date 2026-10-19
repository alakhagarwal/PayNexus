package com.paynexus.orderengineservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Internal DTO received from wallet-service POST /internal/wallet/hold
 * Maps to wallet-service HoldFundsResponse.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HoldResponse {
    private boolean success;
    private String holdReference;   // echoes back the referenceId (orderId)
    private String message;
}
