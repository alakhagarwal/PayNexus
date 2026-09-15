package com.paynexus.walletservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class KycSubmitRequest {

    @NotBlank(message = "Document type is required")
    private String documentType;  // e.g., AADHAAR, PAN

    @NotBlank(message = "Document URL is required")
    private String documentUrl;
}
