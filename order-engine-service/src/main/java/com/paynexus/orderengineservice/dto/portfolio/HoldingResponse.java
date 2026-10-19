package com.paynexus.orderengineservice.dto.portfolio;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response DTO for a single stock holding, enriched with live price data.
 * Returned by both GET /api/v1/portfolio/{userId}/holdings and the full portfolio endpoint.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HoldingResponse {

    private UUID holdingId;
    private String symbol;
    private Integer quantity;

    /** Weighted average price paid per share. */
    private BigDecimal avgBuyPrice;

    /** Total capital invested = avgBuyPrice × quantity. */
    private BigDecimal totalInvested;

    /** Current live price of this symbol (from Redis). */
    private BigDecimal currentPrice;

    /** Current market value = quantity × currentPrice. */
    private BigDecimal currentValue;

    /** Unrealized P&L = currentValue - totalInvested. */
    private BigDecimal unrealizedPnl;

    /** P&L as percentage of invested capital. */
    private BigDecimal pnlPercent;

    /** "PROFIT" | "LOSS" | "NEUTRAL" */
    private String pnlDirection;

    private OffsetDateTime updatedAt;
}
