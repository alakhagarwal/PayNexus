package com.paynexus.walletservice.service;

import com.paynexus.walletservice.dto.request.P2PTransferRequest;
import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.entity.Wallet;
import com.paynexus.walletservice.exception.*;
import com.paynexus.walletservice.repository.UserRepository;
import com.paynexus.walletservice.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.concurrent.TimeUnit;

/**
 * P2PTransferService — Peer-to-Peer Transfer with Distributed MultiLock.
 *
 * The MultiLock Strategy (decided in planning):
 * ─────────────────────────────────────────────
 * To transfer from Alice → Bob, we must atomically lock BOTH wallets.
 *
 * DEADLOCK SCENARIO WITHOUT MultiLock:
 *   Thread 1: Locks Alice → waiting for Bob (Bob locked by Thread 2)
 *   Thread 2: Locks Bob   → waiting for Alice (Alice locked by Thread 1)
 *   Result: Both threads freeze FOREVER.
 *
 * RedissonMultiLock SOLVES THIS by:
 *   1. Trying to acquire ALL locks atomically in one operation.
 *   2. If ANY single lock cannot be acquired within the timeout,
 *      it RELEASES all already-acquired locks and backs off.
 *   3. No partial locks = no deadlocks. Ever.
 *
 * Operation Order (inside the lock):
 *   1. Check idempotency key (prevents double-transfer on network retry)
 *   2. Verify sender's 6-digit transaction PIN (authorization)
 *   3. Check wallet guards (frozen, sufficient balance, daily limit)
 *   4. Debit sender (reduce available_balance)
 *   5. Credit receiver (increase available_balance)
 *   6. Write TWO immutable ledger entries (one DEBIT for sender, one CREDIT for receiver)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class P2PTransferService {

    private final RedissonClient redissonClient;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final LedgerService ledgerService;
    private final IdempotencyService idempotencyService;
    private final PasswordEncoder passwordEncoder;

    private static final String WALLET_LOCK_PREFIX = "lock:wallet:";

    /**
     * Executes a P2P transfer.
     *
     * @param request contains senderId, receiverId, amount, transactionPin, idempotencyKey
     */
    public void transfer(P2PTransferRequest request) {
        // ── STEP 1: Acquire distributed MultiLock on BOTH wallets ──────────────
        RLock senderLock   = redissonClient.getLock(WALLET_LOCK_PREFIX + request.getSenderId());
        RLock receiverLock = redissonClient.getLock(WALLET_LOCK_PREFIX + request.getReceiverId());

        // MultiLock: acquires BOTH or none. Watchdog is ACTIVE (no leaseTime specified).
        RLock multiLock = redissonClient.getMultiLock(senderLock, receiverLock);

        try {
            boolean acquired = multiLock.tryLock(5, TimeUnit.SECONDS);
            if (!acquired) {
                throw new IllegalStateException(
                        "One or both wallets are currently locked. Please retry in a moment.");
            }

            try {
                doTransfer(request);
            } finally {
                // RedissonMultiLock does not implement isHeldByCurrentThread() (throws UnsupportedOperationException).
                // tryLock() already verified acquisition, so unlocking directly is safe.
                multiLock.unlock();
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Transfer was interrupted. Please retry.", e);
        }
    }

    /**
     * The actual transactional transfer logic — runs INSIDE the distributed lock.
     * @Transactional ensures DB changes (sender debit + receiver credit + 2 ledger entries)
     * are all committed atomically or all rolled back.
     */
    @Transactional
    protected void doTransfer(P2PTransferRequest request) {

        // ── STEP 2: Idempotency check ────────────────────────────────────────
        // Prevents duplicate transfers if the frontend retries the same request
        idempotencyService.checkAndMark(request.getIdempotencyKey());

        // ── STEP 3: Verify Transaction PIN ───────────────────────────────────
        User sender = userRepository.findById(request.getSenderId())
                .orElseThrow(UserNotFoundException::new);

        if (sender.getTransactionPinHash() == null) {
            throw new InvalidPinException("Please set your transaction PIN before making transfers");
        }

        if (!passwordEncoder.matches(request.getTransactionPin(), sender.getTransactionPinHash())) {
            throw new InvalidPinException("Incorrect transaction PIN");
        }

        // ── STEP 4: Load both wallets ─────────────────────────────────────────
        Wallet senderWallet = walletRepository.findByUserId(request.getSenderId())
                .orElseThrow(() -> new WalletNotFoundException("Sender wallet not found"));
        Wallet receiverWallet = walletRepository.findByUserId(request.getReceiverId())
                .orElseThrow(() -> new WalletNotFoundException("Receiver wallet not found"));

        // ── STEP 5: Business rule guards ─────────────────────────────────────
        if (senderWallet.isFrozen()) throw new WalletFrozenException();

        if (senderWallet.getAvailableBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException(
                    String.format("Insufficient balance. Available: ₹%.2f, Requested: ₹%.2f",
                            senderWallet.getAvailableBalance(), request.getAmount()));
        }

        BigDecimal newDailySpent = senderWallet.getDailySpent().add(request.getAmount());
        if (newDailySpent.compareTo(senderWallet.getDailyLimit()) > 0) {
            throw new DailyLimitExceededException(
                    String.format("Daily limit exceeded. Limit: ₹%.2f, Already spent: ₹%.2f",
                            senderWallet.getDailyLimit(), senderWallet.getDailySpent()));
        }

        // ── STEP 6: Debit sender ─────────────────────────────────────────────
        senderWallet.setAvailableBalance(senderWallet.getAvailableBalance().subtract(request.getAmount()));
        senderWallet.setDailySpent(newDailySpent);
        walletRepository.save(senderWallet);

        // ── STEP 7: Credit receiver ──────────────────────────────────────────
        receiverWallet.setAvailableBalance(receiverWallet.getAvailableBalance().add(request.getAmount()));
        walletRepository.save(receiverWallet);

        // ── STEP 8: Write immutable ledger entries (TWO — one per wallet) ────
        ledgerService.recordDebit(senderWallet, request.getAmount(),
                "transfer:" + request.getIdempotencyKey(),
                "P2P Transfer to user: " + request.getReceiverId(),
                request.getReceiverId());

        ledgerService.recordCredit(receiverWallet, request.getAmount(),
                "credit:" + request.getIdempotencyKey(),
                "P2P Transfer from user: " + request.getSenderId(),
                request.getSenderId());

        log.info("P2P transfer of ₹{} from {} to {} completed (idempotencyKey: {})",
                request.getAmount(), request.getSenderId(), request.getReceiverId(),
                request.getIdempotencyKey());
    }
}
