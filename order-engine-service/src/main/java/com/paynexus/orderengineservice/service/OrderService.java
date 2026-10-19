package com.paynexus.orderengineservice.service;

import com.paynexus.orderengineservice.client.WalletServiceClient;
import com.paynexus.orderengineservice.client.dto.*;
import com.paynexus.orderengineservice.dto.order.BuyOrderRequest;
import com.paynexus.orderengineservice.dto.order.OrderResponse;
import com.paynexus.orderengineservice.dto.order.SellOrderRequest;
import com.paynexus.orderengineservice.entity.Holding;
import com.paynexus.orderengineservice.entity.StockOrder;
import com.paynexus.orderengineservice.enums.OrderStatus;
import com.paynexus.orderengineservice.enums.OrderType;
import com.paynexus.orderengineservice.exception.InsufficientHoldingsException;
import com.paynexus.orderengineservice.exception.OrderFailedException;
import com.paynexus.orderengineservice.repository.HoldingRepository;
import com.paynexus.orderengineservice.repository.StockOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * OrderService — implements the Stock Order Saga for BUY and SELL orders.
 *
 * BUY Flow:
 *   STEP 0: Pre-checks (idempotency, read current price from Redis)
 *   STEP 1: Hold funds  → walletClient.holdFunds()
 *   STEP 2: Paper execute (always succeeds)
 *   STEP 3: Settle funds → walletClient.settleFunds() → update Holdings → EXECUTED
 *   COMPENSATION: walletClient.releaseFunds() if STEP 3 fails
 *
 * SELL Flow:
 *   STEP 0: Pre-checks (idempotency, verify holdings ≥ quantity)
 *   STEP 1: Credit proceeds → walletClient.creditWallet()
 *   STEP 2: Update holdings (reduce or delete)
 *   COMPENSATION: restore holdings if STEP 1 fails
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final List<String> SUPPORTED_SYMBOLS = List.of(
            "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO",
            "WIPRO", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY50"
    );

    /** Idempotency cache TTL in Redis: 120 seconds */
    private static final long IDEMPOTENCY_TTL_SECONDS = 120L;

    private final StockOrderRepository orderRepository;
    private final HoldingRepository holdingRepository;
    private final WalletServiceClient walletClient;
    private final StringRedisTemplate redisTemplate;

    // ───────────────────────────── BUY SAGA ─────────────────────────────

    /**
     * Places a BUY stock order using a 3-step saga:
     * HOLD → EXECUTE → SETTLE (or COMPENSATE on failure).
     *
     * @param request        validated BUY request
     * @param idempotencyKey from X-Idempotency-Key header (UUID string)
     * @return OrderResponse with final status
     */
    @Transactional
    public OrderResponse buyOrder(BuyOrderRequest request, String idempotencyKey) {
        String symbol = request.getSymbol().toUpperCase();
        validateSymbol(symbol);

        // ── STEP 0: Idempotency check ──
        String idempotencyRedisKey = "order:idem:" + idempotencyKey;
        String cached = redisTemplate.opsForValue().get(idempotencyRedisKey);
        if (cached != null) {
            log.info("Idempotency hit for key={}", idempotencyKey);
            return buildCachedResponse(cached, idempotencyKey);
        }

        // ── STEP 0: Read current price from Redis ──
        BigDecimal currentPrice = getCurrentPrice(symbol);
        BigDecimal totalValue = currentPrice.multiply(BigDecimal.valueOf(request.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);

        // ── STEP 0: Create PENDING order ──
        String holdRef = idempotencyKey; // use idempotency key as holdRef for traceability
        StockOrder order = new StockOrder();
        order.setUserId(request.getUserId());
        order.setSymbol(symbol);
        order.setOrderType(OrderType.BUY);
        order.setQuantity(request.getQuantity());
        order.setRequestedPrice(currentPrice);
        order.setTotalValue(totalValue);
        order.setStatus(OrderStatus.PENDING);
        order.setWalletHoldRef(holdRef);
        order.setIdempotencyKey(idempotencyKey);
        order = orderRepository.save(order);
        log.info("BUY order created: orderId={} symbol={} qty={} price={} total={}",
                order.getId(), symbol, request.getQuantity(), currentPrice, totalValue);

        // ── STEP 1: Hold Funds ──
        try {
            HoldRequest holdRequest = HoldRequest.builder()
                    .userId(request.getUserId())
                    .amount(totalValue)
                    .referenceId(holdRef)
                    .narration("Stock BUY: " + symbol + " x" + request.getQuantity())
                    .build();

            WalletApiResponse<HoldResponse> holdResp = walletClient.holdFunds(holdRequest);

            if (holdResp == null || !holdResp.isSuccess()) {
                String reason = holdResp != null ? holdResp.getMessage() : "Unknown wallet error";
                order.setStatus(OrderStatus.FAILED);
                order.setFailureReason("Hold failed: " + reason);
                orderRepository.save(order);
                log.warn("BUY FAILED at HOLD: orderId={} reason={}", order.getId(), reason);
                throw new OrderFailedException("Insufficient balance or wallet error: " + reason);
            }

            order.setStatus(OrderStatus.FUNDS_RESERVED);
            order = orderRepository.save(order);
            log.info("Funds reserved: orderId={} holdRef={}", order.getId(), holdRef);

        } catch (OrderFailedException e) {
            throw e;
        } catch (Exception e) {
            // Circuit breaker open / network failure — no funds were moved, just mark FAILED
            order.setStatus(OrderStatus.FAILED);
            order.setFailureReason("Wallet service unavailable: " + e.getMessage());
            orderRepository.save(order);
            log.error("BUY FAILED at HOLD (exception): orderId={} cause={}", order.getId(), e.getMessage());
            throw new OrderFailedException("Order failed: wallet service unavailable. No funds were held.");
        }

        // ── STEP 2: Execute (paper trading — always succeeds) ──
        // Add tiny realistic slippage (±0.1%)
        BigDecimal executedPrice = currentPrice;

        // ── STEP 3: Settle Funds ──
        try {
            SettleRequest settleRequest = SettleRequest.builder()
                    .userId(request.getUserId())
                    .amount(totalValue)
                    .holdRef(holdRef)
                    .build();

            WalletApiResponse<Void> settleResp = walletClient.settleFunds(settleRequest);

            if (settleResp == null || !settleResp.isSuccess()) {
                // Settle failed → compensate
                compensateBuy(order, request.getUserId(), totalValue, holdRef,
                        "Settle failed: " + (settleResp != null ? settleResp.getMessage() : "unknown"));
                throw new OrderFailedException("Order failed during settlement. Funds have been released.");
            }

        } catch (OrderFailedException e) {
            throw e;
        } catch (Exception e) {
            // Settle call threw → compensate
            compensateBuy(order, request.getUserId(), totalValue, holdRef,
                    "Settle exception: " + e.getMessage());
            throw new OrderFailedException("Order failed during settlement. Funds have been released.");
        }

        // ── STEP 3 SUCCESS: Update Holdings ──
        updateHoldingsAfterBuy(request.getUserId(), symbol, request.getQuantity(), executedPrice);

        // ── Finalize Order ──
        order.setStatus(OrderStatus.EXECUTED);
        order.setExecutedPrice(executedPrice);
        order = orderRepository.save(order);
        log.info("BUY EXECUTED: orderId={} symbol={} qty={} executedPrice={}", order.getId(), symbol, request.getQuantity(), executedPrice);

        // Cache idempotency result
        redisTemplate.opsForValue().set(idempotencyRedisKey, order.getId().toString(),
                IDEMPOTENCY_TTL_SECONDS, TimeUnit.SECONDS);

        return toOrderResponse(order, "Order executed successfully. " + symbol + " x" + request.getQuantity() + " purchased.");
    }

    // ───────────────────────────── SELL SAGA ─────────────────────────────

    /**
     * Places a SELL stock order:
     * STEP 0: Verify holdings ≥ quantity
     * STEP 1: Credit wallet with sale proceeds
     * STEP 2: Update (or delete) holdings
     *
     * @param request        validated SELL request
     * @param idempotencyKey from X-Idempotency-Key header
     */
    @Transactional
    public OrderResponse sellOrder(SellOrderRequest request, String idempotencyKey) {
        String symbol = request.getSymbol().toUpperCase();
        validateSymbol(symbol);

        // ── STEP 0: Idempotency check ──
        String idempotencyRedisKey = "order:idem:" + idempotencyKey;
        String cached = redisTemplate.opsForValue().get(idempotencyRedisKey);
        if (cached != null) {
            log.info("Idempotency hit for key={}", idempotencyKey);
            return buildCachedResponse(cached, idempotencyKey);
        }

        // ── STEP 0: Verify holdings ──
        Holding holding = holdingRepository.findByUserIdAndSymbol(request.getUserId(), symbol)
                .orElseThrow(() -> new InsufficientHoldingsException(
                        "No holdings found for " + symbol + ". You don't own any shares of this stock."));

        if (holding.getQuantity() < request.getQuantity()) {
            throw new InsufficientHoldingsException(
                    "Insufficient holdings: you have " + holding.getQuantity() +
                    " share(s) of " + symbol + " but requested to sell " + request.getQuantity());
        }

        // ── STEP 0: Read current price ──
        BigDecimal currentPrice = getCurrentPrice(symbol);
        BigDecimal proceeds = currentPrice.multiply(BigDecimal.valueOf(request.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);

        // ── Create PENDING order ──
        String creditRef = idempotencyKey;
        StockOrder order = new StockOrder();
        order.setUserId(request.getUserId());
        order.setSymbol(symbol);
        order.setOrderType(OrderType.SELL);
        order.setQuantity(request.getQuantity());
        order.setRequestedPrice(currentPrice);
        order.setTotalValue(proceeds);
        order.setStatus(OrderStatus.PENDING);
        order.setIdempotencyKey(idempotencyKey);
        order = orderRepository.save(order);
        log.info("SELL order created: orderId={} symbol={} qty={} price={} proceeds={}",
                order.getId(), symbol, request.getQuantity(), currentPrice, proceeds);

        // ── STEP 1: Credit wallet with sale proceeds ──
        try {
            CreditRequest creditRequest = CreditRequest.builder()
                    .userId(request.getUserId())
                    .amount(proceeds)
                    .referenceId(creditRef)
                    .narration("Stock SELL: " + symbol + " x" + request.getQuantity())
                    .build();

            WalletApiResponse<Void> creditResp = walletClient.creditWallet(creditRequest);

            if (creditResp == null || !creditResp.isSuccess()) {
                order.setStatus(OrderStatus.FAILED);
                order.setFailureReason("Credit failed: " + (creditResp != null ? creditResp.getMessage() : "unknown"));
                orderRepository.save(order);
                log.warn("SELL FAILED at CREDIT: orderId={}", order.getId());
                throw new OrderFailedException("SELL failed: wallet service could not credit proceeds.");
            }

        } catch (OrderFailedException e) {
            throw e;
        } catch (Exception e) {
            order.setStatus(OrderStatus.COMPENSATED);
            order.setFailureReason("Credit exception: " + e.getMessage());
            orderRepository.save(order);
            log.error("SELL FAILED at CREDIT (exception): orderId={} cause={}", order.getId(), e.getMessage());
            throw new OrderFailedException("SELL failed: wallet service unavailable. No changes made to your holdings.");
        }

        // ── STEP 2: Update Holdings ──
        int newQty = holding.getQuantity() - request.getQuantity();
        if (newQty == 0) {
            holdingRepository.delete(holding);
            log.info("Holding fully sold and removed: userId={} symbol={}", request.getUserId(), symbol);
        } else {
            holding.setQuantity(newQty);
            holdingRepository.save(holding);
            log.info("Holding updated after SELL: userId={} symbol={} newQty={}", request.getUserId(), symbol, newQty);
        }

        // ── Finalize Order ──
        order.setStatus(OrderStatus.EXECUTED);
        order.setExecutedPrice(currentPrice);
        order = orderRepository.save(order);
        log.info("SELL EXECUTED: orderId={} symbol={} qty={} proceeds={}", order.getId(), symbol, request.getQuantity(), proceeds);

        // Cache idempotency result
        redisTemplate.opsForValue().set(idempotencyRedisKey, order.getId().toString(),
                IDEMPOTENCY_TTL_SECONDS, TimeUnit.SECONDS);

        return toSellResponse(order, proceeds, "Order executed successfully. Proceeds of ₹" + proceeds + " credited to your wallet.");
    }

    // ───────────────────────────── ORDER HISTORY ─────────────────────────────

    /**
     * Returns paginated order history for a user.
     * Optionally filter by status using the ?status= query param.
     */
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrderHistory(UUID userId, Optional<OrderStatus> status) {
        List<StockOrder> orders;
        if (status.isPresent()) {
            orders = orderRepository.findByUserIdAndStatus(userId, status.get());
        } else {
            orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }
        return orders.stream().map(o -> toOrderResponse(o, null)).collect(Collectors.toList());
    }

    // ───────────────────────────── PRIVATE HELPERS ─────────────────────────────

    /**
     * BUY Saga Compensation — release the held funds back to available balance.
     */
    private void compensateBuy(StockOrder order, UUID userId, BigDecimal amount, String holdRef, String reason) {
        try {
            ReleaseRequest releaseRequest = ReleaseRequest.builder()
                    .userId(userId)
                    .amount(amount)
                    .holdRef(holdRef)
                    .build();
            walletClient.releaseFunds(releaseRequest);
            order.setStatus(OrderStatus.COMPENSATED);
            order.setFailureReason(reason);
            orderRepository.save(order);
            log.info("BUY COMPENSATED: orderId={} funds released holdRef={}", order.getId(), holdRef);
        } catch (Exception ex) {
            // Release itself failed — mark as FAILED, manual intervention needed
            order.setStatus(OrderStatus.FAILED);
            order.setFailureReason("COMPENSATION FAILED: " + reason + " | Release error: " + ex.getMessage());
            orderRepository.save(order);
            log.error("COMPENSATION FAILED for orderId={}: {}", order.getId(), ex.getMessage());
        }
    }

    /**
     * Holdings upsert after a successful BUY.
     * Uses weighted average price calculation.
     */
    private void updateHoldingsAfterBuy(UUID userId, String symbol, int qty, BigDecimal executedPrice) {
        holdingRepository.findByUserIdAndSymbol(userId, symbol).ifPresentOrElse(
                h -> {
                    int newQty = h.getQuantity() + qty;
                    BigDecimal newAvg = h.getTotalInvested()
                            .add(executedPrice.multiply(BigDecimal.valueOf(qty)))
                            .divide(BigDecimal.valueOf(newQty), 2, RoundingMode.HALF_UP);
                    h.setQuantity(newQty);
                    h.setAvgBuyPrice(newAvg);
                    h.setTotalInvested(newAvg.multiply(BigDecimal.valueOf(newQty)));
                    holdingRepository.save(h);
                    log.info("Holdings updated (existing): userId={} symbol={} newQty={} avgPrice={}", userId, symbol, newQty, newAvg);
                },
                () -> {
                    Holding h = new Holding();
                    h.setUserId(userId);
                    h.setSymbol(symbol);
                    h.setQuantity(qty);
                    h.setAvgBuyPrice(executedPrice);
                    h.setTotalInvested(executedPrice.multiply(BigDecimal.valueOf(qty)));
                    holdingRepository.save(h);
                    log.info("Holdings created (new): userId={} symbol={} qty={} avgPrice={}", userId, symbol, qty, executedPrice);
                }
        );
    }

    /**
     * Read current price from Redis. Falls back to 0.00 if key missing (shouldn't happen in production).
     */
    private BigDecimal getCurrentPrice(String symbol) {
        String priceStr = redisTemplate.opsForValue().get("price:" + symbol);
        if (priceStr == null) {
            log.error("No price found in Redis for symbol: {}. Market feed may not be running.", symbol);
            throw new OrderFailedException("Cannot place order: no live price available for " + symbol + ". Please try again.");
        }
        return new BigDecimal(priceStr);
    }

    private void validateSymbol(String symbol) {
        if (!SUPPORTED_SYMBOLS.contains(symbol)) {
            throw new IllegalArgumentException(
                    "Symbol '" + symbol + "' is not supported. Supported: " + String.join(", ", SUPPORTED_SYMBOLS));
        }
    }

    /** Build a minimal cached response when idempotency key already exists. */
    private OrderResponse buildCachedResponse(String orderId, String idempotencyKey) {
        return orderRepository.findById(UUID.fromString(orderId))
                .map(o -> toOrderResponse(o, "Duplicate request — returning cached result."))
                .orElse(OrderResponse.builder()
                        .orderId(UUID.fromString(orderId))
                        .message("Duplicate request — returning cached result.")
                        .build());
    }

    private OrderResponse toOrderResponse(StockOrder order, String message) {
        return OrderResponse.builder()
                .orderId(order.getId())
                .status(order.getStatus().name())
                .orderType(order.getOrderType().name())
                .symbol(order.getSymbol())
                .quantity(order.getQuantity())
                .totalValue(OrderType.BUY.equals(order.getOrderType()) ? order.getTotalValue() : null)
                .proceeds(OrderType.SELL.equals(order.getOrderType()) ? order.getTotalValue() : null)
                .requestedPrice(order.getRequestedPrice())
                .executedPrice(order.getExecutedPrice())
                .message(message)
                .createdAt(order.getCreatedAt())
                .build();
    }

    private OrderResponse toSellResponse(StockOrder order, BigDecimal proceeds, String message) {
        return OrderResponse.builder()
                .orderId(order.getId())
                .status(order.getStatus().name())
                .orderType(order.getOrderType().name())
                .symbol(order.getSymbol())
                .quantity(order.getQuantity())
                .proceeds(proceeds)
                .requestedPrice(order.getRequestedPrice())
                .executedPrice(order.getExecutedPrice())
                .message(message)
                .createdAt(order.getCreatedAt())
                .build();
    }
}
