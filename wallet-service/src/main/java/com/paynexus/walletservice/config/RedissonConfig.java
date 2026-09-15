package com.paynexus.walletservice.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RedissonConfig — Distributed Lock Infrastructure.
 *
 * Why Redisson (not plain Spring Data Redis)?
 * - Redisson provides RLock and RedissonMultiLock, which are production-ready
 *   distributed concurrency primitives that are impossible to implement safely
 *   with plain SETNX (no Watchdog, no atomic multi-lock, no re-entrancy).
 *
 * Watchdog Timeout (30s):
 * - When you call lock.tryLock(waitTime, unit) WITHOUT a leaseTime,
 *   Redisson enables the Watchdog. It pings Redis every 10s (= 30s / 3)
 *   to extend the TTL while your thread is still alive.
 * - If the server crashes, the Watchdog dies and Redis auto-expires the lock.
 */
@Configuration
public class RedissonConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient() {
        Config config = new Config();

        config.useSingleServer()
                .setAddress("redis://" + redisHost + ":" + redisPort)
                .setConnectionMinimumIdleSize(5)
                .setConnectionPoolSize(20)
                .setRetryAttempts(3)
                .setRetryInterval(1500);

        // Watchdog default: 30 seconds. Pings Redis every 10 seconds.
        config.setLockWatchdogTimeout(30_000);

        return Redisson.create(config);
    }
}
