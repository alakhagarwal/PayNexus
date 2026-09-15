package com.paynexus.walletservice.service;

import com.paynexus.walletservice.dto.request.HoldFundsRequest;
import com.paynexus.walletservice.dto.request.ReleaseFundsRequest;
import com.paynexus.walletservice.dto.request.SettleFundsRequest;
import com.paynexus.walletservice.dto.response.BalanceResponse;
import com.paynexus.walletservice.dto.response.HoldFundsResponse;
import com.paynexus.walletservice.dto.response.WalletResponse;
import com.paynexus.walletservice.entity.Wallet;
import com.paynexus.walletservice.exception.InsufficientBalanceException;
import com.paynexus.walletservice.exception.WalletFrozenException;
import com.paynexus.walletservice.exception.WalletNotFoundException;
import com.paynexus.walletservice.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * WalletService — Core Balance Management.
 *
 * All methods that modify balance use a Redisson RLock.
 * LOCK IS ACQUIRED OUTSIDE @Transactional:
 *   - If we lock inside @Transactional, the lock releases before DB commits, creating a gap.
 *   - Correct pattern: Lock → call @Transactional method → Unlock.
 *
 * Watchdog is ACTIVE because we call lock.tryLock(waitTime, unit) WITHOUT a leaseTime.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;
    private final LedgerService ledgerService;
    private final RedissonClient redissonClient;

    private static final String WALLET_LOCK_PREFIX = "lock:wallet:";

    // ─── READ OPERATIONS (no locking needed) ─────────────────────────────────

    @Transactional(readOnly = true)
    public WalletResponse getWallet(UUID userId) {
        Wallet wallet = findByUserId(userId);
        return new WalletResponse(wallet);
    }

    @Transactional(readOnly = true)
    public BalanceResponse getBalance(UUID userId) {
        Wallet wallet = findByUserId(userId);
        return new BalanceResponse(wallet.getId(), wallet.getAvailableBalance(),
                wallet.getReservedBalance(), wallet.getCurrency());
    }

    // ─── CREDIT (Top-up from Razorpay) ───────────────────────────────────────

    /**
     * Credits a wallet. Called by RazorpayService after webhook verification.
     * Uses RLock to prevent concurrent credits to the same wallet.
     */
    public void creditWallet(UUID userId, BigDecimal amount, String referenceId, String narration) {
        RLock lock = redissonClient.getLock(WALLET_LOCK_PREFIX + userId);
        try {
            boolean acquired = lock.tryLock(5, TimeUnit.SECONDS);
            if (!acquired) {
                throw new IllegalStateException("Wallet is locked by another operation. Please retry.");
            }
            try {
                doCreditWallet(userId, amount, referenceId, narration);
            } finally {
                if (lock.isHeldByCurrentThread()) lock.unlock();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Credit operation interrupted", e);
        }
    }

    @Transactional
    protected void doCreditWallet(UUID userId, BigDecimal amount, String referenceId, String narration) {
        Wallet wallet = findByUserId(userId);
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(amount));
        walletRepository.save(wallet);
        ledgerService.recordCredit(wallet, amount, referenceId, narration, null);
        log.info("Credited ₹{} to wallet of user {} (ref: {})", amount, userId, referenceId);
    }

    // ─── HOLD (Stock BUY order placed — Saga Step 1) ─────────────────────────

    /**
     * Moves funds from available_balance → reserved_balance.
     * Called by InternalWalletController when Order Engine places a stock BUY order.
     */
    public HoldFundsResponse holdFunds(HoldFundsRequest request) {
        RLock lock = redissonClient.getLock(WALLET_LOCK_PREFIX + request.getUserId());
        try {
            boolean acquired = lock.tryLock(5, TimeUnit.SECONDS);
            if (!acquired) {
                throw new IllegalStateException("Wallet busy. Cannot hold funds right now.");
            }
            try {
                return doHoldFunds(request);
            } finally {
                if (lock.isHeldByCurrentThread()) lock.unlock();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Hold operation interrupted", e);
        }
    }

    @Transactional
    protected HoldFundsResponse doHoldFunds(HoldFundsRequest request) {
        Wallet wallet = findByUserId(request.getUserId());

        if (wallet.isFrozen()) throw new WalletFrozenException();
        if (wallet.getAvailableBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException("Insufficient funds for stock order");
        }

        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(request.getAmount()));
        wallet.setReservedBalance(wallet.getReservedBalance().add(request.getAmount()));
        walletRepository.save(wallet);

        String narration = request.getNarration() != null ? request.getNarration() : "Stock order hold";
        ledgerService.recordHold(wallet, request.getAmount(), request.getReferenceId(), narration);

        return new HoldFundsResponse(true, request.getReferenceId());
    }

    // ─── SETTLE (Stock BUY executed successfully — Saga Step 3) ──────────────

    /**
     * Confirms the hold as a permanent debit. reserved_balance decreases.
     * No lock needed — reserved funds are already "set aside" and cannot be double-spent.
     */
    @Transactional
    public void settleFunds(SettleFundsRequest request) {
        Wallet wallet = findByUserId(request.getUserId());
        wallet.setReservedBalance(wallet.getReservedBalance().subtract(request.getAmount()));
        walletRepository.save(wallet);

        ledgerService.recordDebit(wallet, request.getAmount(),
                "settle:" + request.getHoldRef(),
                "Stock order settled: " + request.getHoldRef(), null);
    }

    // ─── RELEASE (Stock BUY failed — Saga Compensation) ──────────────────────

    /**
     * Releases reserved funds back to available. Saga compensation step.
     * No lock needed — same reasoning as settleFunds above.
     */
    @Transactional
    public void releaseFunds(ReleaseFundsRequest request) {
        Wallet wallet = findByUserId(request.getUserId());
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(request.getAmount()));
        wallet.setReservedBalance(wallet.getReservedBalance().subtract(request.getAmount()));
        walletRepository.save(wallet);

        ledgerService.recordRelease(wallet, request.getAmount(),
                "release:" + request.getHoldRef(),
                "Hold released: order failed", null);
    }

    // ─── CREDIT FOR STOCK SELL (Internal) ────────────────────────────────────

    /** Called by order-engine when a stock SELL order completes */
    public void creditFromStockSell(UUID userId, BigDecimal amount, String referenceId) {
        creditWallet(userId, amount, "stocksell:" + referenceId,
                "Stock SELL proceeds credited");
    }

    // ─── ADMIN OPERATIONS ────────────────────────────────────────────────────

    @Transactional
    public void freezeWallet(UUID userId) {
        Wallet wallet = findByUserId(userId);
        wallet.setFrozen(true);
        walletRepository.save(wallet);
        log.warn("Wallet frozen for user {}", userId);
    }

    @Transactional
    public void unfreezeWallet(UUID userId) {
        Wallet wallet = findByUserId(userId);
        wallet.setFrozen(false);
        walletRepository.save(wallet);
        log.info("Wallet unfrozen for user {}", userId);
    }

    // ─── SCHEDULED DAILY RESET ───────────────────────────────────────────────

    /**
     * Resets daily_spent to 0 for ALL wallets at midnight every day.
     * This is what makes the "daily_limit" effective — it resets each night.
     */
    @Scheduled(cron = "0 0 0 * * *")  // Every day at 00:00:00
    @Transactional
    public void resetDailySpentLimits() {
        walletRepository.resetAllDailySpent();
        log.info("Daily spend limits reset for all wallets");
    }

    // ─── HELPER ──────────────────────────────────────────────────────────────

    private Wallet findByUserId(UUID userId) {
        return walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("No wallet found for user: " + userId));
    }
}
