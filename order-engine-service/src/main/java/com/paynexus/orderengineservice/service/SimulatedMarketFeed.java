package com.paynexus.orderengineservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SimulatedMarketFeed — fires every 2 seconds, applies ±0.2% Gaussian fluctuation
 * to 10 hardcoded NSE symbols, and writes results into Redis.
 *
 * Redis key contract (same keys that UpstoxLiveMarketFeed will write to in Phase 5):
 *   price:{SYMBOL}            → current price (formatted to 2 decimal places)
 *   price_history:{SYMBOL}    → Redis List, capped at 20 entries, most-recent at head
 */
@Service
@Slf4j
public class SimulatedMarketFeed {

    private static final List<String> SYMBOLS = List.of(
            "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO",
            "WIPRO", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY50"
    );

    // In-memory price map — source of truth for getAllPrices()
    private final Map<String, Double> prices = new ConcurrentHashMap<>(Map.of(
            "RELIANCE", 2450.0, "TCS", 3800.0, "INFY", 1620.0,
            "HDFCBANK", 1710.0, "ZOMATO", 221.0, "WIPRO", 465.0,
            "ICICIBANK", 1230.0, "SBIN", 810.0, "TATAMOTORS", 940.0,
            "NIFTY50", 24800.0
    ));

    // Tracks when the last tick was emitted — exposed to MarketService for feed-status
    private volatile LocalDateTime lastUpdated = LocalDateTime.now();

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private PriceAlertService alertService;

    /**
     * Fires every 2 seconds. Updates in-memory map AND writes to Redis.
     * Also triggers price alert threshold checks after each tick.
     */
    @Scheduled(fixedDelay = 2000)
    public void emitTicks() {
        Random rand = new Random();
        for (String symbol : SYMBOLS) {
            double current = prices.get(symbol);
            double change = current * (rand.nextGaussian() * 0.002);
            double newPrice = Math.max(current + change, 1.0);
            prices.put(symbol, newPrice);

            String formatted = String.format("%.2f", newPrice);

            // Write current price
            redisTemplate.opsForValue().set("price:" + symbol, formatted);

            // Maintain last 20 ticks in a Redis List (most recent at index 0)
            redisTemplate.opsForList().leftPush("price_history:" + symbol, formatted);
            redisTemplate.opsForList().trim("price_history:" + symbol, 0, 19);

            // Check price alerts
            alertService.checkAlerts(symbol, newPrice);
        }
        lastUpdated = LocalDateTime.now();
    }

    /**
     * Returns a read-only view of the current in-memory price map.
     * Used by MarketService to serve GET /market/prices without a Redis round-trip.
     */
    public Map<String, Double> getCurrentPrices() {
        return Collections.unmodifiableMap(prices);
    }

    /**
     * Returns the timestamp of the last emitTicks() execution.
     * Used by MarketService for GET /market/feed-status.
     */
    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }
}
