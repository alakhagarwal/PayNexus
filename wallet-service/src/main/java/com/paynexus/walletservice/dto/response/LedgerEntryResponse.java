package com.paynexus.walletservice.dto.response;

import com.paynexus.walletservice.entity.LedgerEntry;
import com.paynexus.walletservice.enums.TransactionType;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
public class LedgerEntryResponse {
    private final UUID id;
    private final TransactionType transactionType;
    private final BigDecimal amount;
    private final BigDecimal runningBalance;
    private final String narration;
    private final String referenceId;
    private final UUID relatedUserId;
    private final Instant createdAt;

    public LedgerEntryResponse(LedgerEntry entry) {
        this.id = entry.getId();
        this.transactionType = entry.getTransactionType();
        this.amount = entry.getAmount();
        this.runningBalance = entry.getRunningBalance();
        this.narration = entry.getNarration();
        this.referenceId = entry.getReferenceId();
        this.relatedUserId = entry.getRelatedUserId();
        this.createdAt = entry.getCreatedAt();
    }
}
