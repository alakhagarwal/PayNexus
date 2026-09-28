package com.paynexus.orderengineservice.controller;

import com.paynexus.orderengineservice.dto.ApiResponse;
import com.paynexus.orderengineservice.dto.market.FeedStatusResponse;
import com.paynexus.orderengineservice.dto.market.MarketPricesResponse;
import com.paynexus.orderengineservice.dto.market.StockPriceResponse;
import com.paynexus.orderengineservice.service.MarketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * MarketController — exposes 3 read-only market data endpoints.
 *
 * All endpoints are GET (no side effects, no idempotency key required).
 * Data is sourced from Redis (written by SimulatedMarketFeed every 2 seconds).
 *
 * Endpoints:
 *   GET /api/v1/market/prices              → all 10 tracked symbols with latest price
 *   GET /api/v1/market/prices/{symbol}     → single symbol price + last 20 ticks
 *   GET /api/v1/market/feed-status         → feed mode (SIMULATION|LIVE) + metadata
 */
@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
public class MarketController {

    private final MarketService marketService;

    /**
     * GET /api/v1/market/prices
     *
     * Returns the latest price for all 10 tracked stock symbols.
     * Prices are updated every ~2 seconds by SimulatedMarketFeed.
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "prices": {
     *       "RELIANCE": 2451.23,
     *       "TCS": 3802.11,
     *       ...
     *     },
     *     "totalSymbols": 10
     *   }
     * }
     */
    @GetMapping("/prices")
    public ResponseEntity<ApiResponse<MarketPricesResponse>> getAllPrices() {
        MarketPricesResponse response = marketService.getAllPrices();
        return ResponseEntity.ok(ApiResponse.success("Market prices fetched successfully", response));
    }

    /**
     * GET /api/v1/market/prices/{symbol}
     *
     * Returns the current price and last 20 price ticks for a single symbol.
     * Symbol matching is case-insensitive (e.g. "reliance" and "RELIANCE" both work).
     *
     * Path param:
     *   symbol — Stock symbol (e.g. RELIANCE, TCS, NIFTY50)
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "symbol": "RELIANCE",
     *     "currentPrice": 2451.23,
     *     "priceHistory": ["2451.23", "2448.90", "2453.01", ...]   // most recent first, up to 20
     *   }
     * }
     *
     * Response 404 (unknown symbol):
     * {
     *   "success": false,
     *   "message": "Symbol 'XYZ' is not tracked. Supported symbols: RELIANCE, TCS, ..."
     * }
     */
    @GetMapping("/prices/{symbol}")
    public ResponseEntity<ApiResponse<StockPriceResponse>> getPriceBySymbol(
            @PathVariable String symbol) {
        StockPriceResponse response = marketService.getPriceBySymbol(symbol);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/v1/market/feed-status
     *
     * Returns metadata about the current market data feed.
     * Useful for the Admin Panel to show connection mode.
     *
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "mode": "SIMULATION",
     *     "lastUpdated": "2026-09-28T19:05:32",
     *     "trackedSymbols": 10,
     *     "description": "Market data is being simulated with ±0.2% Gaussian fluctuation every 2 seconds. ..."
     *   }
     * }
     */
    @GetMapping("/feed-status")
    public ResponseEntity<ApiResponse<FeedStatusResponse>> getFeedStatus() {
        FeedStatusResponse response = marketService.getFeedStatus();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
