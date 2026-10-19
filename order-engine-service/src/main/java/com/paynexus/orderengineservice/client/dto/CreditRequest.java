package com.paynexus.orderengineservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Internal DTO sent to wallet-service POST /internal/wallet/credit
 * Maps to wallet-service CreditWalletRequest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreditRequest {
    private UUID userId;
    private BigDecimal amount;
    private String referenceId;   // creditRef (UUID as string)
    private String narration;     // e.g. "Stock sale: RELIANCE"
}
