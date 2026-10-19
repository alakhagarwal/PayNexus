package com.paynexus.orderengineservice.dto.order;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response DTO returned after BUY or SELL order execution.
 * totalValue is populated for BUY; proceeds is populated for SELL.
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderResponse {

    private UUID orderId;
    private String status;          // EXECUTED | COMPENSATED | FAILED
    private String orderType;       // BUY | SELL
    private String symbol;
    private Integer quantity;

    /** BUY: amount debited from wallet */
    private BigDecimal totalValue;

    /** SELL: amount credited to wallet */
    private BigDecimal proceeds;

    private BigDecimal requestedPrice;
    private BigDecimal executedPrice;

    private String message;
    private OffsetDateTime createdAt;
}
