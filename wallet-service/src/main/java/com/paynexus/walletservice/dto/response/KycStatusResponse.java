package com.paynexus.walletservice.dto.response;

import com.paynexus.walletservice.entity.UserKyc;
import com.paynexus.walletservice.enums.KycStatus;
import lombok.Getter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * KycStatusResponse — Admin view of a user's KYC submission.
 * Does NOT expose the full Aadhaar (only last 4 digits).
 */
@Getter
public class KycStatusResponse {

    private final UUID userId;
    private final String userName;
    private final String userEmail;
    private final KycStatus kycStatus;
    private final String panNumber;
    private final String aadhaarLastFour;
    private final LocalDate dateOfBirth;
    private final Instant submittedAt;
    private final Instant reviewedAt;
    private final String remarks;

    public KycStatusResponse(UserKyc kyc) {
        this.userId = kyc.getUser().getId();
        this.userName = kyc.getUser().getName();
        this.userEmail = kyc.getUser().getEmail();
        this.kycStatus = kyc.getUser().getKycStatus();
        this.panNumber = kyc.getPanNumber();
        this.aadhaarLastFour = kyc.getAadhaarLastFour();
        this.dateOfBirth = kyc.getDateOfBirth();
        this.submittedAt = kyc.getSubmittedAt();
        this.reviewedAt = kyc.getReviewedAt();
        this.remarks = kyc.getRemarks();
    }
}
