package com.paynexus.orderengineservice.service;

import com.paynexus.orderengineservice.dto.market.FeedStatusResponse;
import com.paynexus.orderengineservice.dto.market.MarketPricesResponse;
import com.paynexus.orderengineservice.dto.market.StockPriceResponse;
import com.paynexus.orderengineservice.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MarketService — reads live price data from Redis (written by SimulatedMarketFeed).
 *
 * Redis key contract:
 *   price:{SYMBOL}            → latest price as a formatted double string (e.g. "2451.23")
 *   price_history:{SYMBOL}    → Redis List, up to 20 entries, most recent at index 0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketService {

    private final StringRedisTemplate redisTemplate;
    private final SimulatedMarketFeed simulatedMarketFeed;

    private static final String PRICE_KEY_PREFIX = "price:";
    private static final String HISTORY_KEY_PREFIX = "price_history:";

    /**
     * GET /api/v1/market/prices
     * Returns all tracked symbols with their latest prices from Redis.
     */
    public MarketPricesResponse getAllPrices() {
        // Read in-memory prices from SimulatedMarketFeed (most up-to-date)
        Map<String, Double> prices = simulatedMarketFeed.getCurrentPrices();
        return MarketPricesResponse.builder()
                .prices(prices)
                .totalSymbols(prices.size())
                .build();
    }

    /**
     * GET /api/v1/market/prices/{symbol}
     * Returns current price + last 20 ticks for one symbol.
     * Throws ResourceNotFoundException if symbol is not tracked.
     */
    public StockPriceResponse getPriceBySymbol(String symbol) {
        String upperSymbol = symbol.toUpperCase();

        String rawPrice = redisTemplate.opsForValue().get(PRICE_KEY_PREFIX + upperSymbol);
        if (rawPrice == null) {
            throw new ResourceNotFoundException(
                "Symbol '" + upperSymbol + "' is not tracked. Supported symbols: " +
                String.join(", ", simulatedMarketFeed.getCurrentPrices().keySet())
            );
        }

        double currentPrice = Double.parseDouble(rawPrice);

        List<String> history = redisTemplate.opsForList()
                .range(HISTORY_KEY_PREFIX + upperSymbol, 0, 19);

        return StockPriceResponse.builder()
                .symbol(upperSymbol)
                .currentPrice(currentPrice)
                .priceHistory(history != null ? history : List.of())
                .build();
    }

    /**
     * GET /api/v1/market/feed-status
     * Returns the current feed mode (SIMULATION vs LIVE) and metadata.
     */
    public FeedStatusResponse getFeedStatus() {
        return FeedStatusResponse.builder()
                .mode("SIMULATION")
                .lastUpdated(simulatedMarketFeed.getLastUpdated())
                .trackedSymbols(simulatedMarketFeed.getCurrentPrices().size())
                .description("Market data is being simulated with ±0.2% Gaussian fluctuation every 2 seconds. " +
                             "Connect Upstox to switch to LIVE mode.")
                .build();
    }
}
