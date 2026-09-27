package com.paynexus.orderengineservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class SimulatedMarketFeed {

    private static final List<String> SYMBOLS = List.of(
            "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO",
            "WIPRO", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY50"
    );

    private final Map<String, Double> prices = new ConcurrentHashMap<>(Map.of(
            "RELIANCE", 2450.0, "TCS", 3800.0, "INFY", 1620.0,
            "HDFCBANK", 1710.0, "ZOMATO", 221.0, "WIPRO", 465.0,
            "ICICIBANK", 1230.0, "SBIN", 810.0, "TATAMOTORS", 940.0,
            "NIFTY50", 24800.0
    ));

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private PriceAlertService alertService;

    @Scheduled(fixedDelay = 2000)
    public void emitTicks() {
        Random rand = new Random();
        for (String symbol : SYMBOLS) {
            double current = prices.get(symbol);
            double change = current * (rand.nextGaussian() * 0.002);
            double newPrice = Math.max(current + change, 1.0);
            prices.put(symbol, newPrice);

            // Write current price
            redisTemplate.opsForValue().set("price:" + symbol,
                    String.format("%.2f", newPrice));

            // Maintain last 20 ticks in a Redis list
            redisTemplate.opsForList().leftPush("price_history:" + symbol,
                    String.format("%.2f", newPrice));
            redisTemplate.opsForList().trim("price_history:" + symbol, 0, 19);

            // Check price alerts
            alertService.checkAlerts(symbol, newPrice);
        }
    }

    public Map<String, Double> getCurrentPrices() {
        return Collections.unmodifiableMap(prices);
    }
}

