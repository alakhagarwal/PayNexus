package com.paynexus.orderengineservice.controller;

import com.paynexus.orderengineservice.dto.ApiResponse;
import com.paynexus.orderengineservice.dto.portfolio.HoldingResponse;
import com.paynexus.orderengineservice.dto.portfolio.PortfolioResponse;
import com.paynexus.orderengineservice.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * PortfolioController — Phase 4.
 *
 * GET /api/v1/portfolio/{userId}           — Full portfolio with live P&L
 * GET /api/v1/portfolio/{userId}/holdings  — Raw holdings list (no P&L rollup)
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
@Slf4j
public class PortfolioController {

    private final PortfolioService portfolioService;

    /**
     * GET /api/v1/portfolio/{userId}
     *
     * Returns all stock holdings for the user with:
     *   - Live current price (from Redis)
     *   - Current market value
     *   - Unrealized P&L per stock and in aggregate
     *   - P&L percentage and direction (PROFIT / LOSS / NEUTRAL)
     *
     * 200 — PortfolioResponse (may have null P&L fields if Redis is warming up)
     */
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<PortfolioResponse>> getPortfolio(
            @PathVariable UUID userId) {

        log.info("Portfolio request for userId={}", userId);
        PortfolioResponse portfolio = portfolioService.getPortfolio(userId);

        String message = portfolio.getTotalStocks() == 0
                ? "No holdings found for this user"
                : "Portfolio retrieved with " + portfolio.getTotalStocks() + " stock(s)";

        return ResponseEntity.ok(ApiResponse.success(message, portfolio));
    }

    /**
     * GET /api/v1/portfolio/{userId}/holdings
     *
     * Returns individual holdings enriched with live prices and per-stock P&L.
     * Useful for listing stocks in a dashboard table without needing the full rollup.
     *
     * 200 — List<HoldingResponse>
     */
    @GetMapping("/{userId}/holdings")
    public ResponseEntity<ApiResponse<List<HoldingResponse>>> getHoldings(
            @PathVariable UUID userId) {

        log.info("Holdings request for userId={}", userId);
        List<HoldingResponse> holdings = portfolioService.getHoldings(userId);

        String message = holdings.isEmpty()
                ? "No holdings found"
                : "Found " + holdings.size() + " holding(s)";

        return ResponseEntity.ok(ApiResponse.success(message, holdings));
    }
}
