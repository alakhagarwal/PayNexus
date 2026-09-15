package com.paynexus.walletservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

/** V1: returns userId only. V3 will return a JWT token here. */
@Getter
@AllArgsConstructor
public class LoginResponse {
    private UUID userId;
    private String email;
    private String name;
    private String message;
}
