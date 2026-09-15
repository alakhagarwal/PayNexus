package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.response.ApiResponse;
import com.paynexus.walletservice.dto.response.KycStatusResponse;
import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.entity.UserKyc;
import com.paynexus.walletservice.enums.KycStatus;
import com.paynexus.walletservice.exception.UserNotFoundException;
import com.paynexus.walletservice.repository.UserKycRepository;
import com.paynexus.walletservice.repository.UserRepository;
import com.paynexus.walletservice.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * AdminController — Operations requiring admin privileges.
 *
 * V1: All admin endpoints are open (no auth) — add API key or BasicAuth in V2.
 * V3: Protected by Keycloak with ROLE_ADMIN.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final WalletService walletService;
    private final UserRepository userRepository;
    private final UserKycRepository userKycRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // Wallet Freeze / Unfreeze
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PUT /admin/users/{userId}/freeze
     * Freezes a user's wallet — prevents all outgoing transactions.
     * Used for fraud prevention and compliance holds.
     */
    @PutMapping("/users/{userId}/freeze")
    public ResponseEntity<ApiResponse<Void>> freeze(@PathVariable UUID userId) {
        walletService.freezeWallet(userId);
        return ResponseEntity.ok(ApiResponse.success("Wallet frozen", null));
    }

    /**
     * PUT /admin/users/{userId}/unfreeze
     * Restores a frozen wallet to normal operation.
     */
    @PutMapping("/users/{userId}/unfreeze")
    public ResponseEntity<ApiResponse<Void>> unfreeze(@PathVariable UUID userId) {
        walletService.unfreezeWallet(userId);
        return ResponseEntity.ok(ApiResponse.success("Wallet unfrozen", null));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KYC Review Queue
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /admin/kyc/pending
     * Lists all users with KYC status = SUBMITTED (pending admin review).
     * Returns identity details (PAN, Aadhaar last 4, DOB) for each user.
     */
    @GetMapping("/kyc/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<KycStatusResponse>>> getPendingKyc() {
        List<KycStatusResponse> pending = userKycRepository
                .findByUser_KycStatus(KycStatus.SUBMITTED)
                .stream()
                .map(KycStatusResponse::new)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(pending));
    }

    /**
     * GET /admin/kyc/{userId}
     * Returns KYC submission details for a specific user.
     */
    @GetMapping("/kyc/{userId}")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<KycStatusResponse>> getKycForUser(@PathVariable UUID userId) {
        UserKyc kyc = userKycRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("No KYC submission found for this user"));
        return ResponseEntity.ok(ApiResponse.success(new KycStatusResponse(kyc)));
    }

    /**
     * PUT /admin/kyc/{userId}/approve
     * Approves KYC for a user — sets their status to VERIFIED.
     *
     * Query param: remarks (optional, e.g. "Verified manually")
     */
    @PutMapping("/kyc/{userId}/approve")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> approveKyc(
            @PathVariable UUID userId,
            @RequestParam(required = false) String remarks) {

        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        user.setKycStatus(KycStatus.VERIFIED);
        userRepository.save(user);

        userKycRepository.findByUserId(userId).ifPresent(kyc -> {
            kyc.setReviewedAt(Instant.now());
            kyc.setRemarks(remarks != null ? remarks : "Approved");
            userKycRepository.save(kyc);
        });

        return ResponseEntity.ok(ApiResponse.success("KYC approved for user " + userId, null));
    }

    /**
     * PUT /admin/kyc/{userId}/reject
     * Rejects KYC — user must re-submit with corrected details.
     *
     * Query param: remarks (required, e.g. "PAN and name do not match")
     */
    @PutMapping("/kyc/{userId}/reject")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> rejectKyc(
            @PathVariable UUID userId,
            @RequestParam String remarks) {

        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        user.setKycStatus(KycStatus.REJECTED);
        userRepository.save(user);

        userKycRepository.findByUserId(userId).ifPresent(kyc -> {
            kyc.setReviewedAt(Instant.now());
            kyc.setRemarks(remarks);
            userKycRepository.save(kyc);
        });

        return ResponseEntity.ok(ApiResponse.success("KYC rejected for user " + userId, null));
    }
}
