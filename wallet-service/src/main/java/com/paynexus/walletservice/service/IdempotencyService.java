package com.paynexus.walletservice.service;

import com.paynexus.walletservice.exception.DuplicateIdempotencyKeyException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * IdempotencyService — Prevents Duplicate Requests Using Redis.
 *
 * Problem It Solves:
 * When a user clicks "Transfer ₹5,000", several things can go wrong:
 *  - The browser sends the request twice due to a slow network.
 *  - The mobile app retries on timeout.
 *  - A Razorpay webhook is replayed by their retry mechanism.
 *
 * Solution:
 * The client generates a unique UUID (idempotency key) before each operation.
 * When we receive a request, we store that key in Redis for 120 seconds.
 * If the SAME key arrives again, we know it's a duplicate and reject it.
 *
 * Implementation Detail:
 * We use setIfAbsent() — this is a Redis SET with NX (only if not exists) flag.
 * It returns TRUE if it was newly set (first time) or FALSE if the key already existed.
 * This is atomic in Redis, so two simultaneous requests with the same key
 * will never BOTH get TRUE — only one will.
 */
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final StringRedisTemplate redisTemplate;

    /**
     * Marks a key as "in use" for 120 seconds.
     * Throws DuplicateIdempotencyKeyException if the key was already used.
     *
     * @param key — the idempotency key from the request (client-generated UUID)
     */
    public void checkAndMark(String key) {
        String redisKey = "idempotency:" + key;

        // setIfAbsent = Redis SET NX (Set if Not eXists) + EX (expiry)
        // Returns TRUE if the key was freshly created (request is new — proceed!)
        // Returns FALSE if the key already existed (duplicate — reject!)
        Boolean isNew = redisTemplate.opsForValue()
                .setIfAbsent(redisKey, "1", Duration.ofSeconds(120));

        if (Boolean.FALSE.equals(isNew)) {
            throw new DuplicateIdempotencyKeyException(
                    "Duplicate request detected. This operation was already processed. " +
                    "If you believe this is an error, retry after 2 minutes.");
        }
    }
}
