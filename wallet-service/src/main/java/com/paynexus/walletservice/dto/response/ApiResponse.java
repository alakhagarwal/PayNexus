package com.paynexus.walletservice.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

/**
 * Generic API response wrapper used by every endpoint in the wallet-service.
 * Ensures a consistent JSON structure regardless of the operation.
 *
 * Success example:
 * { "success": true, "message": "Registration successful", "data": { "userId": "..." } }
 *
 * Error example:
 * { "success": false, "message": "Insufficient balance", "data": null }
 *
 * Validation error example:
 * { "success": false, "message": "Validation failed", "data": { "amount": "must be positive" } }
 */
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final String message;
    private final T data;

    private ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "Success", data);
    }

    public static ApiResponse<Void> error(String message) {
        return new ApiResponse<>(false, message, null);
    }

    public static <T> ApiResponse<T> validationError(T errors) {
        return new ApiResponse<>(false, "Validation failed", errors);
    }
}
