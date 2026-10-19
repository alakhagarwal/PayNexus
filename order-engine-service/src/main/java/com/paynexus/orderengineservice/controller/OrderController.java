package com.paynexus.orderengineservice.controller;

import com.paynexus.orderengineservice.dto.ApiResponse;
import com.paynexus.orderengineservice.dto.order.BuyOrderRequest;
import com.paynexus.orderengineservice.dto.order.OrderResponse;
import com.paynexus.orderengineservice.dto.order.SellOrderRequest;
import com.paynexus.orderengineservice.enums.OrderStatus;
import com.paynexus.orderengineservice.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * OrderController — exposes the Stock Order Saga endpoints.
 *
 * POST /api/v1/orders/buy   — BUY order saga (HOLD → EXECUTE → SETTLE)
 * POST /api/v1/orders/sell  — SELL order saga (CREDIT → UPDATE-HOLDINGS)
 * GET  /api/v1/orders/{userId}/history — paginated order history with optional ?status= filter
 *
 * The X-Idempotency-Key header is REQUIRED for POST endpoints.
 * Sending the same key twice returns the same cached response without double-processing.
 */
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService orderService;

    /**
     * POST /api/v1/orders/buy
     *
     * Places a BUY stock order. Funds are held, order is executed at current price,
     * and funds are permanently settled from the wallet.
     *
     * Header: X-Idempotency-Key: {uuid}   (required)
     * Body:   { "userId": UUID, "symbol": "RELIANCE", "quantity": 5, "transactionPin": "123456" }
     *
     * 201 — Order EXECUTED
     * 422 — Insufficient balance / invalid PIN / order saga failed
     * 503 — Wallet service unavailable
     */
    @PostMapping("/buy")
    public ResponseEntity<ApiResponse<OrderResponse>> buyOrder(
            @Valid @RequestBody BuyOrderRequest request,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey) {

        // Generate idempotency key if not provided
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            idempotencyKey = UUID.randomUUID().toString();
            log.info("No X-Idempotency-Key header provided — generated: {}", idempotencyKey);
        }

        log.info("BUY order request: userId={} symbol={} qty={} idempotencyKey={}",
                request.getUserId(), request.getSymbol(), request.getQuantity(), idempotencyKey);

        OrderResponse response = orderService.buyOrder(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("BUY order processed", response));
    }

    /**
     * POST /api/v1/orders/sell
     *
     * Places a SELL stock order. Holdings are verified, proceeds are credited to wallet,
     * and holdings are reduced or removed.
     *
     * Header: X-Idempotency-Key: {uuid}   (required)
     * Body:   { "userId": UUID, "symbol": "RELIANCE", "quantity": 5, "transactionPin": "123456" }
     *
     * 201 — Order EXECUTED
     * 422 — Insufficient holdings / order saga failed
     * 503 — Wallet service unavailable
     */
    @PostMapping("/sell")
    public ResponseEntity<ApiResponse<OrderResponse>> sellOrder(
            @Valid @RequestBody SellOrderRequest request,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            idempotencyKey = UUID.randomUUID().toString();
            log.info("No X-Idempotency-Key header provided — generated: {}", idempotencyKey);
        }

        log.info("SELL order request: userId={} symbol={} qty={} idempotencyKey={}",
                request.getUserId(), request.getSymbol(), request.getQuantity(), idempotencyKey);

        OrderResponse response = orderService.sellOrder(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("SELL order processed", response));
    }

    /**
     * GET /api/v1/orders/{userId}/history
     *
     * Returns all orders for a user, sorted by createdAt descending.
     * Optionally filter by status: ?status=EXECUTED | PENDING | FAILED | COMPENSATED
     *
     * 200 — List<OrderResponse>
     * 400 — Invalid status value
     */
    @GetMapping("/{userId}/history")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getOrderHistory(
            @PathVariable UUID userId,
            @RequestParam(required = false) String status) {

        Optional<OrderStatus> statusFilter = Optional.empty();
        if (status != null && !status.isBlank()) {
            try {
                statusFilter = Optional.of(OrderStatus.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid status value: '" + status +
                        "'. Allowed: PENDING, FUNDS_RESERVED, EXECUTED, FAILED, COMPENSATED");
            }
        }

        List<OrderResponse> orders = orderService.getOrderHistory(userId, statusFilter);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }
}
