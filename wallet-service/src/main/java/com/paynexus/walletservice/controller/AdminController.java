package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.response.ApiResponse;
import com.paynexus.walletservice.entity.KycDocument;
import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.enums.KycStatus;
import com.paynexus.walletservice.exception.UserNotFoundException;
import com.paynexus.walletservice.repository.KycDocumentRepository;
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
 * In V1: All admin endpoints are open (no auth) — add BasicAuth/API key in V2.
 * In V3: Protected by Keycloak with ROLE_ADMIN.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final WalletService walletService;
    private final UserRepository userRepository;
    private final KycDocumentRepository kycDocumentRepository;

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

    /**
     * GET /admin/kyc/pending
     * Lists all users with KYC status = SUBMITTED (pending admin review).
     */
    @GetMapping("/kyc/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<KycDocument>>> getPendingKyc() {
        // Get all users with SUBMITTED status and their documents
        List<KycDocument> pending = kycDocumentRepository.findAll().stream()
                .filter(doc -> doc.getUser().getKycStatus() == KycStatus.SUBMITTED)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(pending));
    }

    /**
     * PUT /admin/kyc/{userId}/approve
     * Approves KYC for a user. Sets their status to VERIFIED.
     */
    @PutMapping("/kyc/{userId}/approve")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> approveKyc(@PathVariable UUID userId,
                                                         @RequestParam(required = false) String remarks) {
        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        user.setKycStatus(KycStatus.VERIFIED);
        userRepository.save(user);

        // Update document review metadata
        kycDocumentRepository.findByUserId(userId).forEach(doc -> {
            doc.setReviewedAt(Instant.now());
            doc.setRemarks(remarks != null ? remarks : "Approved");
            kycDocumentRepository.save(doc);
        });

        return ResponseEntity.ok(ApiResponse.success("KYC approved for user " + userId, null));
    }

    /**
     * PUT /admin/kyc/{userId}/reject
     * Rejects KYC. User must re-submit with correct documents.
     */
    @PutMapping("/kyc/{userId}/reject")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> rejectKyc(@PathVariable UUID userId,
                                                        @RequestParam String remarks) {
        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        user.setKycStatus(KycStatus.REJECTED);
        userRepository.save(user);

        kycDocumentRepository.findByUserId(userId).forEach(doc -> {
            doc.setReviewedAt(Instant.now());
            doc.setRemarks(remarks);
            kycDocumentRepository.save(doc);
        });

        return ResponseEntity.ok(ApiResponse.success("KYC rejected for user " + userId, null));
    }
}
