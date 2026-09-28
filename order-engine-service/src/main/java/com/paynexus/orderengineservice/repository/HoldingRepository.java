package com.paynexus.orderengineservice.repository;

import com.paynexus.orderengineservice.entity.Holding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repository for user stock holdings. */
@Repository
public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    /** All holdings for a user - used to render portfolio. */
    List<Holding> findByUserId(UUID userId);

    /**
     * Single holding for a (user, symbol) pair.
     * Used to upsert position after BUY/SELL execution.
     */
    Optional<Holding> findByUserIdAndSymbol(UUID userId, String symbol);

    /** All users who hold a specific symbol. */
    List<Holding> findBySymbol(String symbol);
}