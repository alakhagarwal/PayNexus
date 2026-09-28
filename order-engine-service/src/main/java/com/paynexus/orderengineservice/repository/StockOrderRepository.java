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

    List<StockOrder> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<StockOrder> findByUserIdAndStatus(UUID userId, OrderStatus status);
    Optional<StockOrder> findByIdempotencyKey(String idempotencyKey);
    List<StockOrder> findBySymbol(String symbol);
}