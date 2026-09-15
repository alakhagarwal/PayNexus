package com.paynexus.walletservice.service;

import com.paynexus.walletservice.dto.response.InitiatePaymentResponse;
import com.paynexus.walletservice.exception.PaymentInitiationException;
import com.paynexus.walletservice.exception.WebhookVerificationException;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.UUID;

/**
 * RazorpayService — Payment Gateway Integration.
 *
 * Two-Phase Wallet Top-Up Flow:
 * ──────────────────────────────
 * Phase 1 (Initiate):
 *   - Frontend calls POST /api/v1/payments/initiate with userId + amount
 *   - We create a Razorpay Order (server-side) and return the order_id
 *   - Frontend uses order_id to open the Razorpay Checkout modal
 *   - User enters card/UPI/netbanking details directly in Razorpay's UI
 *
 * Phase 2 (Webhook):
 *   - After payment succeeds, Razorpay sends a POST to /api/v1/payments/webhook
 *   - We VERIFY the HMAC-SHA256 signature (using webhook secret)
 *   - We check idempotency (Razorpay retries webhooks multiple times!)
 *   - If valid, we credit the user's wallet via WalletService
 *
 * WHY WE VERIFY SIGNATURE:
 *   Anyone could send a fake POST to your webhook endpoint claiming a payment succeeded.
 *   The HMAC signature is a cryptographic proof that the request genuinely came from Razorpay.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RazorpayService {

    private final RazorpayClient razorpayClient;
    private final WalletService walletService;
    private final StringRedisTemplate redisTemplate;

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.webhook-secret}")
    private String webhookSecret;

    /**
     * Phase 1: Creates a Razorpay order.
     * Amount is converted from INR to Paise (1 INR = 100 Paise) for Razorpay's API.
     */
    public InitiatePaymentResponse createOrder(UUID userId, BigDecimal amount) {
        try {
            JSONObject orderReq = new JSONObject();
            orderReq.put("amount", amount.multiply(BigDecimal.valueOf(100)).intValue()); // paise
            orderReq.put("currency", "INR");
            orderReq.put("receipt", "receipt_" + UUID.randomUUID());
            // Store userId in notes so the webhook knows which user to credit
            orderReq.put("notes", new JSONObject().put("userId", userId.toString()));

            Order order = razorpayClient.orders.create(orderReq);
            String razorpayOrderId = order.get("id");
            log.info("Created Razorpay order {} for user {} amount ₹{}", razorpayOrderId, userId, amount);

            return new InitiatePaymentResponse(razorpayOrderId, amount, "INR", keyId);

        } catch (RazorpayException e) {
            throw new PaymentInitiationException("Failed to create Razorpay order", e);
        }
    }

    /**
     * Phase 2: Processes an incoming Razorpay webhook.
     *
     * IMPORTANT: This method must return fast. Razorpay expects HTTP 200 within 5 seconds.
     * If it takes too long, Razorpay retries — hence the Redis idempotency check below.
     */
    public void processWebhook(String payload, String razorpaySignature) {

        // ── STEP 1: Verify HMAC-SHA256 signature ────────────────────────────
        // Throws WebhookVerificationException if signature is invalid or missing.
        // This rejects any request that didn't come from Razorpay's servers.
        try {
            boolean isValid = Utils.verifyWebhookSignature(payload, razorpaySignature, webhookSecret);
            if (!isValid) {
                throw new WebhookVerificationException("Razorpay webhook signature verification failed");
            }
        } catch (RazorpayException e) {
            throw new WebhookVerificationException("Error verifying webhook signature: " + e.getMessage());
        }

        // ── STEP 2: Parse event type ─────────────────────────────────────────
        JSONObject event = new JSONObject(payload);
        String eventType = event.getString("event");

        // Only process payment captures; ignore other events (refunds, disputes, etc.)
        if (!"payment.captured".equals(eventType)) {
            log.debug("Ignoring Razorpay event: {}", eventType);
            return;
        }

        // ── STEP 3: Extract payment details ─────────────────────────────────
        JSONObject payment = event.getJSONObject("payload")
                .getJSONObject("payment")
                .getJSONObject("entity");

        String paymentId = payment.getString("id");
        // Amount from Razorpay is in paise — convert back to INR
        BigDecimal amount = BigDecimal.valueOf(payment.getLong("amount") / 100.0);
        UUID userId = UUID.fromString(payment.getJSONObject("notes").getString("userId"));

        // ── STEP 4: Idempotency check (Razorpay RETRIES webhooks!) ───────────
        String idempotencyKey = "webhook:processed:" + paymentId;
        Boolean alreadyProcessed = Boolean.FALSE.equals(
                redisTemplate.opsForValue().setIfAbsent(idempotencyKey, "1", Duration.ofHours(48)));

        if (alreadyProcessed) {
            log.info("Razorpay webhook for payment {} already processed. Skipping.", paymentId);
            return;
        }

        // ── STEP 5: Credit the wallet ────────────────────────────────────────
        walletService.creditWallet(userId, amount, "razorpay:" + paymentId,
                "Wallet top-up via Razorpay (Payment ID: " + paymentId + ")");

        log.info("Wallet topped up: user={}, amount=₹{}, paymentId={}", userId, amount, paymentId);
    }
}
