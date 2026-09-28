package com.paynexus.orderengineservice.repository;

import com.paynexus.orderengineservice.entity.PriceAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Repository for price alert CRUD and scheduled-check queries. */
@Repository
public interface PriceAlertRepository extends JpaRepository<PriceAlert, UUID> {

    /**
     * Fetch all active alerts for a symbol.
     * Called by PriceAlertService.checkAlerts() every scheduler tick.
     */
    List<PriceAlert> findBySymbolAndIsActiveTrue(String symbol);

    /**
     * Active alerts for a specific user.
     * Used by GET /api/v1/alerts/{userId} endpoint.
     */
    List<PriceAlert> findByUserIdAndIsActiveTrue(UUID userId);

    /** All alerts (active + fired) for a user - full history view. */
    List<PriceAlert> findByUserId(UUID userId);
}