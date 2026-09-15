package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.request.CreditWalletRequest;
import com.paynexus.walletservice.dto.request.HoldFundsRequest;
import com.paynexus.walletservice.dto.request.ReleaseFundsRequest;
import com.paynexus.walletservice.dto.request.SettleFundsRequest;
import com.paynexus.walletservice.dto.response.ApiResponse;
import com.paynexus.walletservice.dto.response.BalanceResponse;
import com.paynexus.walletservice.dto.response.HoldFundsResponse;
import com.paynexus.walletservice.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * InternalWalletController — Endpoints consumed only by other microservices.
 *
 * These endpoints are NOT registered in the API Gateway route table.
 * They are called directly via Feign (using Eureka service discovery) by:
 *  - order-engine (for stock BUY/SELL Saga)
 *  - ai-advisor (for balance check before recommendations)
 *
 * In V2/V3, add internal service authentication (e.g., shared secret header or mTLS).
 */
@RestController
@RequestMapping("/internal/wallet")
@RequiredArgsConstructor
public class InternalWalletController {

    private final WalletService walletService;

    /**
     * POST /internal/wallet/hold
     * Stock BUY Saga - Step 1: Reserve funds for a pending stock order.
     * Moves amount from available_balance → reserved_balance.
     */
    @PostMapping("/hold")
    public ResponseEntity<ApiResponse<HoldFundsResponse>> holdFunds(@Valid @RequestBody HoldFundsRequest request) {
        HoldFundsResponse response = walletService.holdFunds(request);
        return ResponseEntity.ok(ApiResponse.success("Funds held successfully", response));
    }

    /**
     * POST /internal/wallet/settle
     * Stock BUY Saga - Step 3 (success): Confirm hold as permanent debit.
     * Decreases reserved_balance (money leaves the system permanently).
     */
    @PostMapping("/settle")
    public ResponseEntity<ApiResponse<Void>> settleFunds(@Valid @RequestBody SettleFundsRequest request) {
        walletService.settleFunds(request);
        return ResponseEntity.ok(ApiResponse.success("Funds settled", null));
    }

    /**
     * POST /internal/wallet/release
     * Stock BUY Saga - Compensation: Return reserved funds to available balance.
     * Called when a stock order fails, is rejected, or is cancelled.
     */
    @PostMapping("/release")
    public ResponseEntity<ApiResponse<Void>> releaseFunds(@Valid @RequestBody ReleaseFundsRequest request) {
        walletService.releaseFunds(request);
        return ResponseEntity.ok(ApiResponse.success("Funds released", null));
    }

    /**
     * POST /internal/wallet/credit
     * Credits wallet after a stock SELL order completes successfully.
     */
    @PostMapping("/credit")
    public ResponseEntity<ApiResponse<Void>> creditWallet(@Valid @RequestBody CreditWalletRequest request) {
        walletService.creditWallet(request.getUserId(), request.getAmount(),
                request.getReferenceId(), request.getNarration() != null ? request.getNarration() : "Internal credit");
        return ResponseEntity.ok(ApiResponse.success("Wallet credited", null));
    }

    /**
     * GET /internal/wallet/{userId}/balance
     * Used by AI advisor and order-engine to check available balance before operations.
     */
    @GetMapping("/{userId}/balance")
    public ResponseEntity<ApiResponse<BalanceResponse>> getBalance(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(walletService.getBalance(userId)));
    }
}
