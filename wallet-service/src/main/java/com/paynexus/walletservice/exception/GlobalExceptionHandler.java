package com.paynexus.walletservice.exception;

import com.paynexus.walletservice.dto.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Global exception handler — intercepts all thrown exceptions and converts them
 * to consistent ApiResponse JSON bodies with appropriate HTTP status codes.
 *
 * HTTP Status codes used:
 *  400 Bad Request       — Validation failures (invalid input)
 *  401 Unauthorized      — Wrong password
 *  403 Forbidden         — Wallet frozen
 *  404 Not Found         — User/wallet not found
 *  409 Conflict          — Duplicate idempotency key
 *  422 Unprocessable     — Business logic failure (insufficient balance, daily limit)
 *  400 Bad Request       — Invalid PIN format
 *  500 Internal Error    — Unexpected errors
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(InsufficientBalanceException.class)
    public ResponseEntity<ApiResponse<Void>> handleInsufficientBalance(InsufficientBalanceException e) {
        return ResponseEntity.status(422).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(WalletFrozenException.class)
    public ResponseEntity<ApiResponse<Void>> handleFrozen(WalletFrozenException e) {
        return ResponseEntity.status(403).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(DailyLimitExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleDailyLimit(DailyLimitExceededException e) {
        return ResponseEntity.status(422).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(DuplicateIdempotencyKeyException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateIdempotencyKeyException e) {
        return ResponseEntity.status(409).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler({UserNotFoundException.class, WalletNotFoundException.class})
    public ResponseEntity<ApiResponse<Void>> handleNotFound(RuntimeException e) {
        return ResponseEntity.status(404).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler({InvalidPinException.class})
    public ResponseEntity<ApiResponse<Void>> handleInvalidPin(InvalidPinException e) {
        return ResponseEntity.status(401).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ApiResponse<Void>> handleEmailExists(EmailAlreadyExistsException e) {
        return ResponseEntity.status(409).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(WebhookVerificationException.class)
    public ResponseEntity<ApiResponse<Void>> handleWebhook(WebhookVerificationException e) {
        log.warn("Webhook verification failed: {}", e.getMessage());
        return ResponseEntity.status(400).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(PaymentInitiationException.class)
    public ResponseEntity<ApiResponse<Void>> handlePayment(PaymentInitiationException e) {
        log.error("Razorpay error", e);
        return ResponseEntity.status(502).body(ApiResponse.error("Payment gateway error. Please try again."));
    }

    /**
     * Handles @Valid failures — returns field-level error messages.
     * Example: { "success": false, "message": "Validation failed", "data": { "amount": "must be positive" } }
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(fe -> errors.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.badRequest().body(ApiResponse.validationError(errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleAll(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.internalServerError().body(ApiResponse.error("Internal server error"));
    }
}
