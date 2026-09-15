package com.paynexus.walletservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/** Internal DTO: called by order-engine to hold funds for a stock BUY order */
@Getter @Setter @NoArgsConstructor
public class HoldFundsRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01")
    private BigDecimal amount;

    @NotBlank(message = "Reference ID is required")
    private String referenceId;  // orderId from order-engine

    private String narration;
}
