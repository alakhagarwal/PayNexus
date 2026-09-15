package com.paynexus.walletservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.UUID;

/** Internal response: returned to AI advisor / order-engine for balance checks */
@Getter
@AllArgsConstructor
public class BalanceResponse {
    private UUID walletId;
    private BigDecimal availableBalance;
    private BigDecimal reservedBalance;
    private String currency;
}
