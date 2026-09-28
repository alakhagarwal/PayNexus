package com.paynexus.orderengineservice.controller;

import com.paynexus.orderengineservice.dto.ApiResponse;
import com.paynexus.orderengineservice.dto.alert.AlertResponse;
import com.paynexus.orderengineservice.dto.alert.CreateAlertRequest;
import com.paynexus.orderengineservice.service.PriceAlertService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for price alert management.
 *
 * Endpoints:
 *   POST   /api/v1/alerts             — create a price alert
 *   GET    /api/v1/alerts/{userId}    — get all active alerts for a user
 *   DELETE /api/v1/alerts/{alertId}   — cancel (soft-delete) an alert
 */
@RestController
@RequestMapping("/api/v1/alerts")
@Slf4j
public class AlertController {

    @Autowired
    private PriceAlertService alertService;

    /**
     * POST /api/v1/alerts
     *
     * Create a price alert. The alert will auto-trigger when the simulated market
     * price crosses the specified threshold in the given direction.
     *
     * Request body:
     * {
     *   "userId": "uuid",
     *   "symbol": "RELIANCE",
     *   "targetPrice": 2500.00,
     *   "direction": "ABOVE"   // or "BELOW"
     * }
     *
     * Response 201:
     * {
     *   "success": true,
     *   "message": "Price alert created successfully",
     *   "data": { alertId, userId, symbol, targetPrice, direction, isActive, createdAt }
     * }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AlertResponse>> createAlert(
            @Valid @RequestBody CreateAlertRequest request) {

        log.info("Creating alert: userId={} symbol={} direction={} target={}",
                request.getUserId(), request.getSymbol(),
                request.getDirection(), request.getTargetPrice());

        AlertResponse response = alertService.createAlert(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Price alert created successfully", response));
    }

    /**
     * GET /api/v1/alerts/{userId}
     *
     * Returns all ACTIVE (not yet triggered, not cancelled) alerts for the given user.
     * Triggered alerts are excluded — they have isActive=false.
     *
     * Response 200:
     * {
     *   "success": true,
     *   "message": "Found 2 active alert(s)",
     *   "data": [ { alertId, symbol, targetPrice, direction, isActive, createdAt }, ... ]
     * }
     */
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<List<AlertResponse>>> getAlerts(
            @PathVariable UUID userId) {

        List<AlertResponse> alerts = alertService.getActiveAlerts(userId);
        String message = "Found " + alerts.size() + " active alert(s)";
        return ResponseEntity.ok(ApiResponse.success(message, alerts));
    }

    /**
     * DELETE /api/v1/alerts/{alertId}
     *
     * Soft-cancels an active alert (sets isActive=false).
     * Returns 404 if the alert does not exist.
     * Returns 400 if the alert is already inactive.
     *
     * Response 200:
     * {
     *   "success": true,
     *   "message": "Alert cancelled successfully"
     * }
     */
    @DeleteMapping("/{alertId}")
    public ResponseEntity<ApiResponse<Void>> cancelAlert(
            @PathVariable UUID alertId) {

        log.info("Cancelling alert: alertId={}", alertId);
        alertService.cancelAlert(alertId);
        return ResponseEntity.ok(ApiResponse.success("Alert cancelled successfully", null));
    }
}