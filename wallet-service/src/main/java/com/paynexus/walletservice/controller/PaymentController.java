package com.paynexus.walletservice.controller;

import com.paynexus.walletservice.dto.request.InitiatePaymentRequest;
import com.paynexus.walletservice.dto.response.ApiResponse;
import com.paynexus.walletservice.dto.response.InitiatePaymentResponse;
import com.paynexus.walletservice.service.RazorpayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final RazorpayService razorpayService;

    /**
     * POST /api/v1/payments/initiate
     * Creates a Razorpay order. Frontend uses the returned order_id to open the checkout modal.
     *
     * Request:  { "userId": "...", "amount": 5000.00 }
     * Response: { "razorpayOrderId": "order_AbcXyz", "amount": 5000.00, "currency": "INR", "razorpayKeyId": "..." }
     */
    @PostMapping("/initiate")
    public ResponseEntity<ApiResponse<InitiatePaymentResponse>> initiatePayment(
            @Valid @RequestBody InitiatePaymentRequest request) {
        InitiatePaymentResponse response = razorpayService.createOrder(request.getUserId(), request.getAmount());
        return ResponseEntity.ok(ApiResponse.success("Payment order created", response));
    }

    /**
     * POST /api/v1/payments/webhook
     * Receives Razorpay payment success notifications.
     * This endpoint MUST be public (no auth) and registered in Razorpay Dashboard.
     *
     * Razorpay sends: X-Razorpay-Signature header for HMAC-SHA256 verification.
     * DO NOT trust any webhook that fails signature verification.
     */
    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("X-Razorpay-Signature") String signature) {
        razorpayService.processWebhook(payload, signature);
        return ResponseEntity.ok("OK");  // Must respond with 200 quickly; Razorpay retries on non-200
    }
}
