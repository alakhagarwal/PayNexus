package com.paynexus.orderengineservice.client;

import com.paynexus.orderengineservice.client.dto.*;
import com.paynexus.orderengineservice.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

/**
 * Fallback factory for WalletServiceClient.
 * When wallet-service is down or circuit breaker is OPEN, every method throws
 * ServiceUnavailableException so the OrderService saga can catch it and compensate.
 */
@Component
@Slf4j
public class WalletServiceFallbackFactory implements FallbackFactory<WalletServiceClient> {

    @Override
    public WalletServiceClient create(Throwable cause) {
        log.error("WalletServiceClient fallback triggered. Cause: {}", cause.getMessage());

        return new WalletServiceClient() {

            @Override
            public WalletApiResponse<HoldResponse> holdFunds(HoldRequest request) {
                log.error("FALLBACK: holdFunds failed for userId={} amount={}", request.getUserId(), request.getAmount());
                throw new ServiceUnavailableException("Wallet service unavailable - cannot hold funds. Please try again later.");
            }

            @Override
            public WalletApiResponse<Void> settleFunds(SettleRequest request) {
                log.error("FALLBACK: settleFunds failed for holdRef={}", request.getHoldRef());
                throw new ServiceUnavailableException("Wallet service unavailable - cannot settle funds. Compensation will be triggered.");
            }

            @Override
            public WalletApiResponse<Void> releaseFunds(ReleaseRequest request) {
                log.error("FALLBACK: releaseFunds failed for holdRef={}", request.getHoldRef());
                throw new ServiceUnavailableException("Wallet service unavailable - cannot release funds.");
            }

            @Override
            public WalletApiResponse<Void> creditWallet(CreditRequest request) {
                log.error("FALLBACK: creditWallet failed for userId={} amount={}", request.getUserId(), request.getAmount());
                throw new ServiceUnavailableException("Wallet service unavailable - cannot credit proceeds. Compensation will be triggered.");
            }
        };
    }
}
