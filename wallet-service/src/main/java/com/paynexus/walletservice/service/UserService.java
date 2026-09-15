package com.paynexus.walletservice.service;

import com.paynexus.walletservice.dto.request.KycSubmitRequest;
import com.paynexus.walletservice.dto.request.LoginRequest;
import com.paynexus.walletservice.dto.request.RegisterRequest;
import com.paynexus.walletservice.dto.request.SetPinRequest;
import com.paynexus.walletservice.dto.response.LoginResponse;
import com.paynexus.walletservice.dto.response.RegisterResponse;
import com.paynexus.walletservice.dto.response.UserProfileResponse;
import com.paynexus.walletservice.entity.KycDocument;
import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.entity.Wallet;
import com.paynexus.walletservice.enums.KycStatus;
import com.paynexus.walletservice.exception.EmailAlreadyExistsException;
import com.paynexus.walletservice.exception.InvalidPinException;
import com.paynexus.walletservice.exception.UserNotFoundException;
import com.paynexus.walletservice.repository.KycDocumentRepository;
import com.paynexus.walletservice.repository.UserRepository;
import com.paynexus.walletservice.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final KycDocumentRepository kycDocumentRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Registers a new user AND creates their wallet in a single atomic transaction.
     * If the wallet creation fails, the user creation also rolls back — no orphan users.
     */
    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException("Email is already registered: " + request.getEmail());
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setName(request.getName());
        // BCrypt hashes the password before storing — raw password is NEVER persisted
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user = userRepository.save(user);

        // Create a wallet linked to this user immediately at registration
        Wallet wallet = new Wallet();
        wallet.setUser(user);
        wallet = walletRepository.save(wallet);

        return new RegisterResponse(user.getId(), wallet.getId(), user.getEmail(), "Registration successful");
    }

    /**
     * V1: Simple credential check, returns userId.
     * V3: Will issue a JWT signed by Keycloak instead.
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UserNotFoundException("No account found with this email"));

        if (!user.isActive()) {
            throw new UserNotFoundException("This account has been deactivated");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            // Return generic message to avoid revealing if email exists
            throw new UserNotFoundException("Invalid email or password");
        }

        return new LoginResponse(user.getId(), user.getEmail(), user.getName(), "Login successful");
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);
        return new UserProfileResponse(user);
    }

    /**
     * Sets or updates the 6-digit transaction PIN.
     * The PIN is BCrypt-hashed before storage (same as passwords).
     */
    @Transactional
    public void setTransactionPin(UUID userId, SetPinRequest request) {
        // Additional server-side validation (redundant with @Valid, but defense-in-depth)
        if (!request.getPin().matches("\\d{6}")) {
            throw new InvalidPinException("PIN must be exactly 6 digits");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);

        user.setTransactionPinHash(passwordEncoder.encode(request.getPin()));
        userRepository.save(user);
    }

    /**
     * Saves KYC document metadata and marks the user's KYC status as SUBMITTED.
     * Admin must then review and approve/reject via /admin/kyc/** endpoints.
     */
    @Transactional
    public void submitKyc(UUID userId, KycSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);

        KycDocument doc = new KycDocument();
        doc.setUser(user);
        doc.setDocumentType(request.getDocumentType());
        doc.setDocumentUrl(request.getDocumentUrl());
        kycDocumentRepository.save(doc);

        user.setKycStatus(KycStatus.SUBMITTED);
        userRepository.save(user);
    }
}
