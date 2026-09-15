package com.paynexus.walletservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Internal response: returned to order-engine after successfully holding funds */
@Getter
@AllArgsConstructor
public class HoldFundsResponse {
    private boolean success;
    private String holdReference;   // matches the referenceId from HoldFundsRequest
    private String message;

    public HoldFundsResponse(boolean success, String holdReference) {
        this.success = success;
        this.holdReference = holdReference;
        this.message = success ? "Funds held successfully" : "Failed to hold funds";
    }
}
