package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.request.P2PTransferRequest;
import com.paynexus.walletservice.dto.response.*;
import com.paynexus.walletservice.enums.TransactionType;
import com.paynexus.walletservice.repository.LedgerEntryRepository;
import com.paynexus.walletservice.repository.WalletRepository;
import com.paynexus.walletservice.service.P2PTransferService;
import com.paynexus.walletservice.service.WalletService;
import com.paynexus.walletservice.exception.WalletNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final P2PTransferService p2pTransferService;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final WalletRepository walletRepository;

    /**
     * GET /api/v1/wallet/{userId}
     * Returns wallet balance and status for a user.
     *
     * Response: { availableBalance, reservedBalance, currency, isFrozen, dailyLimit, remainingDailyLimit }
     */
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<WalletResponse>> getWallet(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(walletService.getWallet(userId)));
    }

    /**
     * GET /api/v1/wallet/{userId}/ledger?page=0&size=20
     * Returns paginated ledger entries for a wallet (newest first).
     *
     * Use this to build the transaction history screen in the app.
     */
    @GetMapping("/{userId}/ledger")
    public ResponseEntity<ApiResponse<Page<LedgerEntryResponse>>> getLedger(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID walletId = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("No wallet for user: " + userId))
                .getId();

        Pageable pageable = PageRequest.of(page, size);
        Page<LedgerEntryResponse> ledger = ledgerEntryRepository
                .findByWalletIdOrderByCreatedAtDesc(walletId, pageable)
                .map(LedgerEntryResponse::new);

        return ResponseEntity.ok(ApiResponse.success(ledger));
    }

    /**
     * GET /api/v1/wallet/{userId}/ledger/summary
     * Returns total credits and total debits for the wallet dashboard.
     *
     * Response: { "totalCredits": 50000.00, "totalDebits": 12000.00 }
     */
    @GetMapping("/{userId}/ledger/summary")
    public ResponseEntity<ApiResponse<Map<String, BigDecimal>>> getLedgerSummary(@PathVariable UUID userId) {
        UUID walletId = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("No wallet for user: " + userId))
                .getId();

        BigDecimal totalCredits = ledgerEntryRepository.sumAmountByWalletIdAndType(walletId, TransactionType.CREDIT);
        BigDecimal totalDebits  = ledgerEntryRepository.sumAmountByWalletIdAndType(walletId, TransactionType.DEBIT);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "totalCredits", totalCredits,
                "totalDebits", totalDebits
        )));
    }

    /**
     * POST /api/v1/wallet/transfer
     * Transfers money between two users.
     * Requires header: X-Idempotency-Key: <uuid>
     *
     * Request: { "senderId", "receiverId", "amount", "transactionPin", "idempotencyKey" }
     * Response: 200 { "success": true, "message": "Transfer successful" }
     */
    @PostMapping("/transfer")
    public ResponseEntity<ApiResponse<Void>> transfer(
            @RequestHeader("X-Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody P2PTransferRequest request) {

        request.setIdempotencyKey(idempotencyKey);
        p2pTransferService.transfer(request);
        return ResponseEntity.ok(ApiResponse.success("Transfer of ₹" + request.getAmount() + " successful", null));
    }
}
