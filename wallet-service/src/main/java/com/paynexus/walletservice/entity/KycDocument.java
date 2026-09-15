package com.paynexus.walletservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "kyc_documents")
@Getter
@Setter
@NoArgsConstructor
public class KycDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Type of identity document: e.g., "AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE"
     */
    @Column(name = "document_type", nullable = false, length = 50)
    private String documentType;

    /**
     * URL to the document in cloud storage (S3/GCS).
     * In V1 this can be a placeholder — actual upload handled separately.
     */
    @Column(name = "document_url", nullable = false, length = 500)
    private String documentUrl;

    @Column(name = "submitted_at", updatable = false)
    private Instant submittedAt = Instant.now();

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Admin's remarks when approving or rejecting */
    @Column(length = 500)
    private String remarks;
}
