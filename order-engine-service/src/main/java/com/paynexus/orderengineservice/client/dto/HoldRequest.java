package com.paynexus.orderengineservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Internal DTO sent to wallet-service POST /internal/wallet/hold
 * Maps to wallet-service HoldFundsRequest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HoldRequest {
    private UUID userId;
    private BigDecimal amount;
    private String referenceId;  // the orderId used as holdRef
    private String narration;
}
