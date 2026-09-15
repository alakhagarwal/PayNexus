package com.paynexus.walletservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * KycSubmitRequest — Text-based identity verification (no file uploads).
 *
 * The user provides their PAN number, the last 4 digits of their Aadhaar card,
 * and their date of birth. An admin then reviews and approves or rejects.
 */
@Getter
@Setter
@NoArgsConstructor
public class KycSubmitRequest {

    /**
     * PAN Card number. Must be 10 chars: 5 letters, 4 digits, 1 letter.
     * 4th character must be 'P' for individual holders.
     * Example: ABCDE1234F
     */
    @NotBlank(message = "PAN number is required")
    @Pattern(
        regexp = "[A-Z]{5}[0-9]{4}[A-Z]{1}",
        message = "Invalid PAN format. Expected format: ABCDE1234F"
    )
    private String panNumber;

    /**
     * Last 4 digits of Aadhaar card.
     * We do NOT store the full Aadhaar number for privacy reasons.
     * Example: "1234"
     */
    @NotBlank(message = "Aadhaar last 4 digits are required")
    @Pattern(
        regexp = "\\d{4}",
        message = "Aadhaar last 4 digits must be exactly 4 numeric digits"
    )
    private String aadhaarLastFour;

    /**
     * Date of birth for age verification. User must be at least 18 years old.
     * Format: YYYY-MM-DD
     */
    @NotNull(message = "Date of birth is required")
    @Past(message = "Date of birth must be in the past")
    private LocalDate dateOfBirth;
}
