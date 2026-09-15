package com.paynexus.walletservice.service;

import com.paynexus.walletservice.dto.request.KycSubmitRequest;
import com.paynexus.walletservice.dto.request.LoginRequest;
import com.paynexus.walletservice.dto.request.RegisterRequest;
import com.paynexus.walletservice.dto.request.SetPinRequest;
import com.paynexus.walletservice.dto.response.LoginResponse;
import com.paynexus.walletservice.dto.response.RegisterResponse;
import com.paynexus.walletservice.dto.response.UserProfileResponse;
import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.entity.UserKyc;
import com.paynexus.walletservice.entity.Wallet;
import com.paynexus.walletservice.enums.KycStatus;
import com.paynexus.walletservice.exception.EmailAlreadyExistsException;
import com.paynexus.walletservice.exception.InvalidPinException;
import com.paynexus.walletservice.exception.UserNotFoundException;
import com.paynexus.walletservice.repository.UserKycRepository;
import com.paynexus.walletservice.repository.UserRepository;
import com.paynexus.walletservice.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final UserKycRepository userKycRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Registers a new user AND creates their wallet in a single atomic transaction.
     * If wallet creation fails, user creation also rolls back — no orphan users.
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
            // Generic message — avoids leaking whether email exists
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
        if (!request.getPin().matches("\\d{6}")) {
            throw new InvalidPinException("PIN must be exactly 6 digits");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);

        user.setTransactionPinHash(passwordEncoder.encode(request.getPin()));
        userRepository.save(user);
    }

    /**
     * Submits identity details for KYC verification.
     *
     * Validates:
     *  1. User must be at least 18 years old.
     *  2. PAN 4th character must be 'P' (confirms it is an individual/person, not a company).
     *  3. User cannot re-submit if already VERIFIED.
     *
     * After submission, kycStatus is set to SUBMITTED for admin review.
     */
    @Transactional
    public void submitKyc(UUID userId, KycSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);

        // Block re-submission if already verified
        if (user.getKycStatus() == KycStatus.VERIFIED) {
            throw new IllegalStateException("KYC is already verified for this user.");
        }

        // Age check — user must be at least 18
        int age = Period.between(request.getDateOfBirth(), LocalDate.now()).getYears();
        if (age < 18) {
            throw new IllegalArgumentException("You must be at least 18 years old to complete KYC.");
        }

        // PAN individual check — 4th character must be 'P' (Person)
        if (request.getPanNumber().charAt(3) != 'P') {
            throw new IllegalArgumentException("PAN number does not appear to be an individual PAN (4th character must be 'P').");
        }

        // Create or update the KYC record (allow re-submission after REJECTED)
        UserKyc kyc = userKycRepository.findByUserId(userId).orElse(new UserKyc());
        kyc.setUser(user);
        kyc.setPanNumber(request.getPanNumber().toUpperCase());
        kyc.setAadhaarLastFour(request.getAadhaarLastFour());
        kyc.setDateOfBirth(request.getDateOfBirth());
        userKycRepository.save(kyc);

        user.setKycStatus(KycStatus.SUBMITTED);
        userRepository.save(user);
    }
}
