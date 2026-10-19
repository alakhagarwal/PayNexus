package com.paynexus.orderengineservice.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Generic wallet-service response wrapper.
 * Mirrors wallet-service ApiResponse shape: { "success": boolean, "message": string, "data": T }
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WalletApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
}
