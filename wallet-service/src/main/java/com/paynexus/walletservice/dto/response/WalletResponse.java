package com.paynexus.walletservice.dto.response;

import com.paynexus.walletservice.entity.Wallet;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class WalletResponse {
    private final UUID walletId;
    private final UUID userId;
    private final BigDecimal availableBalance;
    private final BigDecimal reservedBalance;
    private final String currency;
    private final boolean isFrozen;
    private final BigDecimal dailyLimit;
    private final BigDecimal dailySpent;
    private final BigDecimal remainingDailyLimit;

    public WalletResponse(Wallet wallet) {
        this.walletId = wallet.getId();
        this.userId = wallet.getUser().getId();
        this.availableBalance = wallet.getAvailableBalance();
        this.reservedBalance = wallet.getReservedBalance();
        this.currency = wallet.getCurrency();
        this.isFrozen = wallet.isFrozen();
        this.dailyLimit = wallet.getDailyLimit();
        this.dailySpent = wallet.getDailySpent();
        this.remainingDailyLimit = wallet.getDailyLimit().subtract(wallet.getDailySpent());
    }
}
