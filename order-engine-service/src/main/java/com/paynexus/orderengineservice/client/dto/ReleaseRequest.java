package com.paynexus.orderengineservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Internal DTO sent to wallet-service POST /internal/wallet/release
 * Maps to wallet-service ReleaseFundsRequest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseRequest {
    private UUID userId;
    private BigDecimal amount;
    private String holdRef;   // must match the original holdRef
}
