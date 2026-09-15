package com.paynexus.walletservice.repository;

import com.paynexus.walletservice.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID> {

    Optional<Wallet> findByUserId(UUID userId);

    /**
     * Called by the @Scheduled daily reset job at midnight.
     * Resets every wallet's daily_spent counter back to 0.
     */
    @Modifying
    @Query("UPDATE Wallet w SET w.dailySpent = 0")
    void resetAllDailySpent();
}
