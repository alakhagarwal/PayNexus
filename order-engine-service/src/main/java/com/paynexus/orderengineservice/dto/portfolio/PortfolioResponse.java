package com.paynexus.orderengineservice.dto.portfolio;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Full portfolio response — holdings enriched with live prices + aggregate P&L summary.
 * Returned by GET /api/v1/portfolio/{userId}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PortfolioResponse {

    private UUID userId;

    /** All holdings with live price enrichment. */
    private List<HoldingResponse> holdings;

    /** Total number of distinct stocks held. */
    private Integer totalStocks;

    /** Sum of (avgBuyPrice × quantity) across all holdings. */
    private BigDecimal totalInvested;

    /** Sum of (currentPrice × quantity) across all holdings. */
    private BigDecimal totalCurrentValue;

    /** totalCurrentValue - totalInvested (can be negative). */
    private BigDecimal totalUnrealizedPnl;

    /** Overall P&L as a percentage of total invested. */
    private BigDecimal totalPnlPercent;

    /** "PROFIT" | "LOSS" | "NEUTRAL" */
    private String overallPnlDirection;
}
