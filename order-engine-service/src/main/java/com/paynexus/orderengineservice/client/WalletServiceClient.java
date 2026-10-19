package com.paynexus.orderengineservice.client;

import com.paynexus.orderengineservice.client.dto.*;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Feign client for communicating with wallet-service internal endpoints.
 * Called during the Stock Order Saga to hold, settle, release, and credit funds.
 *
 * Circuit breaker (Resilience4j) wraps each call via feign.circuitbreaker.enabled=true.
 * Fallback factory: WalletServiceFallbackFactory — throws ServiceUnavailableException
 * so the saga catches it and triggers compensation.
 */
@FeignClient(
        name = "wallet-service",
        fallbackFactory = WalletServiceFallbackFactory.class
)
public interface WalletServiceClient {

    /**
     * Step 1 of BUY saga: Move amount from available → reserved balance.
     * POST /internal/wallet/hold
     */
    @PostMapping("/internal/wallet/hold")
    WalletApiResponse<HoldResponse> holdFunds(@RequestBody HoldRequest request);

    /**
     * Step 3 of BUY saga (success path): Permanently debit reserved funds.
     * POST /internal/wallet/settle
     */
    @PostMapping("/internal/wallet/settle")
    WalletApiResponse<Void> settleFunds(@RequestBody SettleRequest request);

    /**
     * BUY saga compensation: Return reserved funds to available balance.
     * POST /internal/wallet/release
     */
    @PostMapping("/internal/wallet/release")
    WalletApiResponse<Void> releaseFunds(@RequestBody ReleaseRequest request);

    /**
     * Step 1 of SELL saga (success path): Credit wallet with stock sale proceeds.
     * POST /internal/wallet/credit
     */
    @PostMapping("/internal/wallet/credit")
    WalletApiResponse<Void> creditWallet(@RequestBody CreditRequest request);
}
