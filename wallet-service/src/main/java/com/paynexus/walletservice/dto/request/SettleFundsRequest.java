package com.paynexus.walletservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/** Internal DTO: called by order-engine to permanently debit after stock order succeeds */
@Getter @Setter @NoArgsConstructor
public class SettleFundsRequest {

    @NotNull
    private UUID userId;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    /** The holdRef must match the original HoldFundsRequest.referenceId */
    @NotBlank
    private String holdRef;
}
