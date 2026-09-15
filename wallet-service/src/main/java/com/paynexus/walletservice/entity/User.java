package com.paynexus.walletservice.entity;

import com.paynexus.walletservice.enums.KycStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(unique = true, nullable = false, length = 150)
    private String email;

    /**
     * BCrypt hash of the user's login password.
     * NEVER store or log the raw password — only the hash is persisted.
     */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /**
     * BCrypt hash of the 6-digit transaction PIN.
     * NULL until the user explicitly sets it via PUT /api/v1/users/{userId}/pin.
     * Required before any P2P transfer can be authorized.
     */
    @Column(name = "transaction_pin_hash")
    private String transactionPinHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status", length = 20)
    private KycStatus kycStatus = KycStatus.PENDING;

    @Column(name = "is_active")
    private boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    /**
     * Automatically updates updatedAt before every JPA UPDATE operation.
     */
    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
