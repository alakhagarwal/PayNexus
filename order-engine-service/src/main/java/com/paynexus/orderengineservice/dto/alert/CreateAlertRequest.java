package com.paynexus.orderengineservice.dto.alert;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Request body for POST /api/v1/alerts
 */
public class CreateAlertRequest {

    @NotNull(message = "userId is required")
    private UUID userId;

    @NotBlank(message = "symbol is required")
    private String symbol;

    @NotNull(message = "targetPrice is required")
    @DecimalMin(value = "0.01", message = "targetPrice must be greater than 0")
    private BigDecimal targetPrice;

    @NotBlank(message = "direction is required")
    @Pattern(regexp = "ABOVE|BELOW", message = "direction must be ABOVE or BELOW")
    private String direction;

    public CreateAlertRequest() {}

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
    public BigDecimal getTargetPrice() { return targetPrice; }
    public void setTargetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
}