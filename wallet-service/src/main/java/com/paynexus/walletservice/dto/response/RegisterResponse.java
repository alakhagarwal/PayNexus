package com.paynexus.walletservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

@Getter
@AllArgsConstructor
public class RegisterResponse {
    private UUID userId;
    private UUID walletId;
    private String email;
    private String message;
}
