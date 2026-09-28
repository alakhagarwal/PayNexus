package com.paynexus.orderengineservice.repository;

import com.paynexus.orderengineservice.entity.StockOrder;
import com.paynexus.orderengineservice.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repository for stock order CRUD and query operations. */
@Repository
public interface StockOrderRepository extends JpaRepository<StockOrder, UUID> {

    /** All orders for a user, newest first. Used for order history endpoint. */
    List<StockOrder> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /** Orders for a user filtered by status. */
    List<StockOrder> findByUserIdAndStatus(UUID userId, OrderStatus status);

    /** Idempotency key lookup - prevents duplicate order submissions. */
    Optional<StockOrder> findByIdempotencyKey(String idempotencyKey);

    /** All orders for a specific symbol. */
    List<StockOrder> findBySymbol(String symbol);
}