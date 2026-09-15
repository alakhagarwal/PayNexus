package com.paynexus.walletservice.repository;

import com.paynexus.walletservice.entity.LedgerEntry;
import com.paynexus.walletservice.enums.TransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

    /** Paginated ledger for a wallet — newest first */
    Page<LedgerEntry> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    boolean existsByReferenceId(String referenceId);

    /** Total credits (CREDITs only) for a wallet — used in dashboard summary */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e WHERE e.wallet.id = :walletId AND e.transactionType = :type")
    BigDecimal sumAmountByWalletIdAndType(@Param("walletId") UUID walletId, @Param("type") TransactionType type);
}
