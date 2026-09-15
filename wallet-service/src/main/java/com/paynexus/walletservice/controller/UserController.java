package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.request.*;
import com.paynexus.walletservice.dto.response.*;
import com.paynexus.walletservice.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * POST /api/v1/users/register
     * Creates a new user and their wallet atomically.
     *
     * Request:  { "name": "Rahul Sharma", "email": "rahul@email.com", "password": "SecurePass123" }
     * Response: 201 { "success": true, "data": { "userId": "...", "walletId": "...", "email": "..." } }
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registration successful", response));
    }

    /**
     * POST /api/v1/users/login
     * Validates credentials. V1: returns userId. V3: will return JWT.
     *
     * Request:  { "email": "rahul@email.com", "password": "SecurePass123" }
     * Response: 200 { "success": true, "data": { "userId": "...", "email": "...", "name": "..." } }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    /**
     * GET /api/v1/users/{userId}/profile
     * Returns user profile without sensitive fields (no password hash, no PIN hash).
     */
    @GetMapping("/{userId}/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getProfile(userId)));
    }

    /**
     * PUT /api/v1/users/{userId}/pin
     * Sets or updates the 6-digit transaction PIN.
     * PIN is required to authorize P2P transfers.
     *
     * Request: { "pin": "123456" }
     */
    @PutMapping("/{userId}/pin")
    public ResponseEntity<ApiResponse<Void>> setPin(@PathVariable UUID userId,
                                                     @Valid @RequestBody SetPinRequest request) {
        userService.setTransactionPin(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Transaction PIN set successfully", null));
    }

    /**
     * POST /api/v1/users/{userId}/kyc
     * Submits identity details for admin review (no file uploads needed).
     *
     * Validates: PAN format, Aadhaar last 4 digits, and age ≥ 18.
     * After submission, kycStatus becomes SUBMITTED until admin approves or rejects.
     *
     * Request: { "panNumber": "ABCDE1234F", "aadhaarLastFour": "1234", "dateOfBirth": "1998-05-20" }
     */
    @PostMapping("/{userId}/kyc")
    public ResponseEntity<ApiResponse<Void>> submitKyc(@PathVariable UUID userId,
                                                        @Valid @RequestBody KycSubmitRequest request) {
        userService.submitKyc(userId, request);
        return ResponseEntity.ok(ApiResponse.success("KYC details submitted successfully. Awaiting admin review.", null));
    }
}
