package com.paynexus.walletservice.dto.response;

import com.paynexus.walletservice.entity.User;
import com.paynexus.walletservice.enums.KycStatus;
import lombok.Getter;

import java.util.UUID;

@Getter
public class UserProfileResponse {
    private final UUID userId;
    private final String name;
    private final String email;
    private final KycStatus kycStatus;
    private final boolean hasPinSet;
    private final boolean isActive;

    public UserProfileResponse(User user) {
        this.userId = user.getId();
        this.name = user.getName();
        this.email = user.getEmail();
        this.kycStatus = user.getKycStatus();
        this.hasPinSet = user.getTransactionPinHash() != null;
        this.isActive = user.isActive();
    }
}
