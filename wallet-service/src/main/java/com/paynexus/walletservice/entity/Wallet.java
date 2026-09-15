package com.paynexus.walletservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "wallets")
@Getter
@Setter
@NoArgsConstructor
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * One-to-one relationship: every User has exactly one Wallet.
     * Created atomically at the same time as the User in UserService.register().
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true, nullable = false)
    private User user;

    /**
     * Money available for spending, transfer, or stock orders.
     * This is the balance shown to the user on their dashboard.
     */
    @Column(name = "available_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal availableBalance = BigDecimal.ZERO;

    /**
     * Money locked for pending stock orders (HOLD state).
     * Not visible to user as spendable. Moved back by RELEASE if order fails,
     * or permanently removed by DEBIT (settle) if order succeeds.
     */
    @Column(name = "reserved_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal reservedBalance = BigDecimal.ZERO;

    @Column(length = 3)
    private String currency = "INR";

    /**
     * When frozen, no debits or transfers are allowed.
     * Only an admin can freeze/unfreeze a wallet (for fraud or compliance).
     */
    @Column(name = "is_frozen")
    private boolean isFrozen = false;

    /**
     * Running total of money spent today. Reset to 0 at midnight by a @Scheduled job.
     * Used to enforce the daily_limit.
     */
    @Column(name = "daily_spent", nullable = false, precision = 15, scale = 2)
    private BigDecimal dailySpent = BigDecimal.ZERO;

    /**
     * Maximum money that can be spent (transferred out) in a single day.
     * Default: ₹50,000. Admin can raise this after KYC verification.
     */
    @Column(name = "daily_limit", nullable = false, precision = 15, scale = 2)
    private BigDecimal dailyLimit = new BigDecimal("50000.00");

    /**
     * Hibernate Optimistic Locking — secondary defense layer on top of Redisson.
     *
     * If two transactions somehow both read wallet version=5 and both try to save,
     * Hibernate will throw OptimisticLockException on the second save (only the first wins).
     * This is a "double safety net" — Redisson prevents concurrent access,
     * but @Version catches any edge case that slips through.
     */
    @Version
    private Long version;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();
}
