package com.paynexus.walletservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * UserKyc — Stores a user's identity verification details.
 *
 * V1 Strategy: Text-based ID submission (no file uploads or S3).
 * The user submits their PAN, last 4 digits of Aadhaar, and Date of Birth.
 * An admin reviews this via /admin/kyc/** and approves or rejects.
 */
@Entity
@Table(name = "user_kyc")
@Getter
@Setter
@NoArgsConstructor
public class UserKyc {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** One-to-one: each user has at most one KYC record. */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /**
     * PAN Card number — format: 5 uppercase letters, 4 digits, 1 uppercase letter.
     * Example: ABCDE1234F. 4th char must be 'P' for individuals.
     */
    @Column(name = "pan_number", nullable = false, length = 10)
    private String panNumber;

    /**
     * Last 4 digits of Aadhaar card (for privacy; we do not store the full 12-digit number).
     * Example: "1234"
     */
    @Column(name = "aadhaar_last_four", nullable = false, length = 4)
    private String aadhaarLastFour;

    /** User's date of birth — used to verify age ≥ 18. */
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    /** Timestamp of when the user submitted their KYC details. */
    @Column(name = "submitted_at", updatable = false)
    private Instant submittedAt = Instant.now();

    /** Timestamp of when the admin reviewed this KYC submission. */
    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Admin's remarks when approving or rejecting. */
    @Column(name = "remarks", length = 500)
    private String remarks;
}
