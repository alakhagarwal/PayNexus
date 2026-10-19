package com.paynexus.orderengineservice.service;

import com.paynexus.orderengineservice.dto.portfolio.HoldingResponse;
import com.paynexus.orderengineservice.dto.portfolio.PortfolioResponse;
import com.paynexus.orderengineservice.entity.Holding;
import com.paynexus.orderengineservice.repository.HoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * PortfolioService — Phase 4.
 *
 * Reads user holdings from PostgreSQL, enriches each one with the live
 * price from Redis (key: price:{SYMBOL}), and computes unrealized P&L.
 *
 * If a symbol's price is missing from Redis (race condition on startup),
 * the holding is still returned but P&L fields are null.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {

    private final HoldingRepository holdingRepository;
    private final StringRedisTemplate redisTemplate;

    private static final String PRICE_KEY_PREFIX = "price:";

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * GET /api/v1/portfolio/{userId}
     * Returns all holdings enriched with live prices + aggregate P&L.
     */
    public PortfolioResponse getPortfolio(UUID userId) {
        List<Holding> holdings = holdingRepository.findByUserId(userId);

        List<HoldingResponse> enriched = holdings.stream()
                .map(this::enrich)
                .toList();

        return buildSummary(userId, enriched);
    }

    /**
     * GET /api/v1/portfolio/{userId}/holdings
     * Returns raw holdings enriched with live prices (no aggregate summary).
     */
    public List<HoldingResponse> getHoldings(UUID userId) {
        return holdingRepository.findByUserId(userId).stream()
                .map(this::enrich)
                .toList();
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /**
     * Enriches one holding with the current Redis price and computes P&L.
     * If Redis doesn't have the price yet, currentPrice / P&L fields are null.
     */
    private HoldingResponse enrich(Holding h) {
        String raw = redisTemplate.opsForValue().get(PRICE_KEY_PREFIX + h.getSymbol());

        BigDecimal currentPrice = null;
        BigDecimal currentValue = null;
        BigDecimal unrealizedPnl = null;
        BigDecimal pnlPercent = null;
        String pnlDirection = null;

        if (raw != null) {
            currentPrice  = new BigDecimal(raw).setScale(2, RoundingMode.HALF_UP);
            currentValue  = currentPrice.multiply(BigDecimal.valueOf(h.getQuantity()))
                                        .setScale(2, RoundingMode.HALF_UP);
            unrealizedPnl = currentValue.subtract(h.getTotalInvested())
                                        .setScale(2, RoundingMode.HALF_UP);

            if (h.getTotalInvested().compareTo(BigDecimal.ZERO) != 0) {
                pnlPercent = unrealizedPnl
                        .divide(h.getTotalInvested(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            int cmp = unrealizedPnl.compareTo(BigDecimal.ZERO);
            pnlDirection = cmp > 0 ? "PROFIT" : cmp < 0 ? "LOSS" : "NEUTRAL";
        } else {
            log.warn("Redis price missing for symbol {} — P&L will be null", h.getSymbol());
        }

        return HoldingResponse.builder()
                .holdingId(h.getId())
                .symbol(h.getSymbol())
                .quantity(h.getQuantity())
                .avgBuyPrice(h.getAvgBuyPrice())
                .totalInvested(h.getTotalInvested())
                .currentPrice(currentPrice)
                .currentValue(currentValue)
                .unrealizedPnl(unrealizedPnl)
                .pnlPercent(pnlPercent)
                .pnlDirection(pnlDirection)
                .updatedAt(h.getUpdatedAt())
                .build();
    }

    /**
     * Aggregates all enriched holdings into a portfolio summary.
     */
    private PortfolioResponse buildSummary(UUID userId, List<HoldingResponse> enriched) {
        BigDecimal totalInvested    = BigDecimal.ZERO;
        BigDecimal totalCurrentValue = BigDecimal.ZERO;
        boolean allPricesAvailable   = true;

        for (HoldingResponse h : enriched) {
            totalInvested = totalInvested.add(h.getTotalInvested());
            if (h.getCurrentValue() != null) {
                totalCurrentValue = totalCurrentValue.add(h.getCurrentValue());
            } else {
                allPricesAvailable = false;
            }
        }

        BigDecimal totalPnl     = null;
        BigDecimal totalPnlPct  = null;
        String     pnlDirection = null;

        if (allPricesAvailable) {
            totalPnl = totalCurrentValue.subtract(totalInvested).setScale(2, RoundingMode.HALF_UP);
            if (totalInvested.compareTo(BigDecimal.ZERO) != 0) {
                totalPnlPct = totalPnl
                        .divide(totalInvested, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);
            }
            int cmp = totalPnl.compareTo(BigDecimal.ZERO);
            pnlDirection = cmp > 0 ? "PROFIT" : cmp < 0 ? "LOSS" : "NEUTRAL";
        }

        return PortfolioResponse.builder()
                .userId(userId)
                .holdings(enriched)
                .totalStocks(enriched.size())
                .totalInvested(totalInvested.setScale(2, RoundingMode.HALF_UP))
                .totalCurrentValue(allPricesAvailable
                        ? totalCurrentValue.setScale(2, RoundingMode.HALF_UP) : null)
                .totalUnrealizedPnl(totalPnl)
                .totalPnlPercent(totalPnlPct)
                .overallPnlDirection(pnlDirection)
                .build();
    }
}
