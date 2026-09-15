package com.paynexus.walletservice.repository;

import com.paynexus.walletservice.entity.UserKyc;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserKycRepository extends JpaRepository<UserKyc, UUID> {

    Optional<UserKyc> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    /** Returns all pending KYC submissions for admin review queue. */
    List<UserKyc> findByUser_KycStatus(com.paynexus.walletservice.enums.KycStatus status);
}
