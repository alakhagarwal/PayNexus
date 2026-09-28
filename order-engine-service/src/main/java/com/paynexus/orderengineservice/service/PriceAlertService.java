package com.paynexus.orderengineservice.service;

import com.paynexus.orderengineservice.dto.alert.AlertResponse;
import com.paynexus.orderengineservice.dto.alert.CreateAlertRequest;
import com.paynexus.orderengineservice.entity.PriceAlert;
import com.paynexus.orderengineservice.enums.AlertDirection;
import com.paynexus.orderengineservice.exception.ResourceNotFoundException;
import com.paynexus.orderengineservice.repository.PriceAlertRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Price Alert service - handles CRUD and the scheduled threshold-check logic.
 * checkAlerts() is called by SimulatedMarketFeed after every price tick.
 */
@Service
@Slf4j
public class PriceAlertService {

    private static final List<String> SUPPORTED_SYMBOLS = List.of(
            "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO",
            "WIPRO", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY50"
    );

    @Autowired
    private PriceAlertRepository alertRepository;

    /**
     * Called by SimulatedMarketFeed after every price tick.
     * Checks all active alerts for the symbol and triggers matching ones.
     */
    @Transactional
    public void checkAlerts(String symbol, double currentPrice) {
        List<PriceAlert> activeAlerts = alertRepository.findBySymbolAndIsActiveTrue(symbol);

        for (PriceAlert alert : activeAlerts) {
            boolean triggered = switch (alert.getDirection()) {
                case ABOVE -> currentPrice >= alert.getTargetPrice().doubleValue();
                case BELOW -> currentPrice <= alert.getTargetPrice().doubleValue();
            };

            if (triggered) {
                alert.setIsActive(false);
                alert.setTriggeredAt(OffsetDateTime.now());
                alertRepository.save(alert);
                log.info("Alert TRIGGERED: alertId={} userId={} symbol={} direction={} target={} currentPrice={}",
                        alert.getId(), alert.getUserId(), symbol,
                        alert.getDirection(), alert.getTargetPrice(), currentPrice);
            }
        }
    }

    /**
     * Create a new price alert.
     * POST /api/v1/alerts
     */
    @Transactional
    public AlertResponse createAlert(CreateAlertRequest request) {
        String symbol = request.getSymbol().toUpperCase();

        if (!SUPPORTED_SYMBOLS.contains(symbol)) {
            throw new IllegalArgumentException(
                    "Symbol '" + request.getSymbol() + "' is not supported. " +
                    "Supported: " + String.join(", ", SUPPORTED_SYMBOLS));
        }

        PriceAlert alert = new PriceAlert();
        alert.setUserId(request.getUserId());
        alert.setSymbol(symbol);
        alert.setTargetPrice(request.getTargetPrice());
        alert.setDirection(AlertDirection.valueOf(request.getDirection().toUpperCase()));
        alert.setIsActive(true);

        PriceAlert saved = alertRepository.save(alert);
        log.info("Alert created: alertId={} userId={} symbol={} direction={} target={}",
                saved.getId(), saved.getUserId(), saved.getSymbol(),
                saved.getDirection(), saved.getTargetPrice());

        return toResponse(saved);
    }

    /**
     * Get all active alerts for a user.
     * GET /api/v1/alerts/{userId}
     */
    @Transactional(readOnly = true)
    public List<AlertResponse> getActiveAlerts(UUID userId) {
        return alertRepository.findByUserIdAndIsActiveTrue(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Soft-cancel an alert.
     * DELETE /api/v1/alerts/{alertId}
     */
    @Transactional
    public void cancelAlert(UUID alertId) {
        PriceAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResourceNotFoundException("Alert not found: " + alertId));

        if (!alert.getIsActive()) {
            throw new IllegalArgumentException("Alert " + alertId + " is already inactive.");
        }

        alert.setIsActive(false);
        alertRepository.save(alert);
        log.info("Alert cancelled: alertId={}", alertId);
    }

    private AlertResponse toResponse(PriceAlert alert) {
        AlertResponse r = new AlertResponse();
        r.setAlertId(alert.getId());
        r.setUserId(alert.getUserId());
        r.setSymbol(alert.getSymbol());
        r.setTargetPrice(alert.getTargetPrice());
        r.setDirection(alert.getDirection().name());
        r.setIsActive(alert.getIsActive());
        r.setTriggeredAt(alert.getTriggeredAt());
        r.setCreatedAt(alert.getCreatedAt());
        return r;
    }
}