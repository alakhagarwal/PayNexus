package com.paynexus.walletservice.service;

import com.paynexus.walletservice.entity.LedgerEntry;
import com.paynexus.walletservice.entity.Wallet;
import com.paynexus.walletservice.enums.TransactionType;
import com.paynexus.walletservice.repository.LedgerEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * LedgerService — Writes Immutable Financial Records.
 *
 * Every time money moves (in any direction), this service is called to create
 * a LedgerEntry row. These rows are NEVER updated or deleted.
 *
 * The referenceId uniqueness is enforced both at the DB level (UNIQUE constraint)
 * and by the idempotency check before the service is called.
 */
@Service
@RequiredArgsConstructor
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;

    /** Records money added to available_balance (top-up, P2P received) */
    public LedgerEntry recordCredit(Wallet wallet, BigDecimal amount,
                                    String referenceId, String narration, UUID relatedUserId) {
        return save(wallet, TransactionType.CREDIT, amount, wallet.getAvailableBalance(), referenceId, narration, relatedUserId);
    }

    /** Records money removed from available_balance (P2P sent) */
    public LedgerEntry recordDebit(Wallet wallet, BigDecimal amount,
                                   String referenceId, String narration, UUID relatedUserId) {
        return save(wallet, TransactionType.DEBIT, amount, wallet.getAvailableBalance(), referenceId, narration, relatedUserId);
    }

    /** Records money moved from available_balance → reserved_balance (stock BUY hold) */
    public LedgerEntry recordHold(Wallet wallet, BigDecimal amount,
                                  String referenceId, String narration) {
        return save(wallet, TransactionType.HOLD, amount, wallet.getAvailableBalance(), referenceId, narration, null);
    }

    /** Records money moved from reserved_balance → available_balance (order failed/cancelled) */
    public LedgerEntry recordRelease(Wallet wallet, BigDecimal amount,
                                     String referenceId, String narration, UUID relatedUserId) {
        return save(wallet, TransactionType.RELEASE, amount, wallet.getAvailableBalance(), referenceId, narration, relatedUserId);
    }

    private LedgerEntry save(Wallet wallet, TransactionType type, BigDecimal amount,
                             BigDecimal runningBalance, String referenceId,
                             String narration, UUID relatedUserId) {
        LedgerEntry entry = new LedgerEntry(wallet, type, amount, runningBalance, referenceId, narration, relatedUserId);
        return ledgerEntryRepository.save(entry);
    }
}
