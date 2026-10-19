package com.paynexus.orderengineservice.dto.order;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Request body for POST /api/v1/orders/buy
 * The X-Idempotency-Key header is read separately in the controller.
 */
@Data
public class BuyOrderRequest {

    @NotNull(message = "userId is required")
    private UUID userId;

    @NotBlank(message = "symbol is required")
    private String symbol;

    @NotNull(message = "quantity is required")
    @Min(value = 1, message = "quantity must be at least 1")
    private Integer quantity;

    @NotBlank(message = "transactionPin is required")
    private String transactionPin;
}
