package com.paynexus.walletservice.entity;

import com.paynexus.walletservice.enums.TransactionType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * LedgerEntry — The Immutable Financial Audit Trail.
 *
 * DESIGN RULE: This entity has NO setters on financial fields.
 * Every row represents one irreversible financial event.
 * You NEVER update or delete a ledger entry — only INSERT.
 *
 * Every balance-changing operation in WalletService/P2PTransferService
 * must create a corresponding LedgerEntry so there is a complete audit trail
 * of every rupee that moved through the system.
 */
@Entity
@Table(name = "ledger_entries")
@Getter
@NoArgsConstructor
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", length = 16, nullable = false)
    private TransactionType transactionType;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /**
     * Balance in the wallet AFTER this entry was applied.
     * Allows reconstructing the exact balance at any point in time.
     */
    @Column(name = "running_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal runningBalance;

    /**
     * UNIQUE identifier linking this entry to its originating operation.
     * Examples:
     *   - P2P transfer: "transfer:idempotency-key-uuid"
     *   - P2P credit: "credit:idempotency-key-uuid"
     *   - Razorpay top-up: "razorpay:pay_AbcXyz123"
     *   - Stock hold: "hold:order-reference-id"
     *   - Stock settle: "settle:order-reference-id"
     *   - Stock release: "release:order-reference-id"
     *
     * DB-level UNIQUE constraint prevents duplicate entries (idempotency).
     */
    @Column(name = "reference_id", unique = true, nullable = false, length = 100)
    private String referenceId;

    /**
     * Human-readable description of the transaction.
     * Example: "P2P Transfer to Priya Sharma", "Wallet top-up via Razorpay"
     */
    private String narration;

    /**
     * The other party in a P2P transfer.
     * For sender's DEBIT entry: this is the receiver's userId.
     * For receiver's CREDIT entry: this is the sender's userId.
     * NULL for non-P2P entries (Razorpay top-ups, stock orders).
     */
    @Column(name = "related_user_id")
    private UUID relatedUserId;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    /**
     * The only constructor for creating a ledger entry.
     * All fields are set at creation time — immutable after that.
     */
    public LedgerEntry(Wallet wallet, TransactionType type, BigDecimal amount,
                       BigDecimal runningBalance, String referenceId,
                       String narration, UUID relatedUserId) {
        this.wallet = wallet;
        this.transactionType = type;
        this.amount = amount;
        this.runningBalance = runningBalance;
        this.referenceId = referenceId;
        this.narration = narration;
        this.relatedUserId = relatedUserId;
    }
}
