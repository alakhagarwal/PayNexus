package com.paynexus.walletservice.client;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.UUID;

/**
 * NotificationFeignClient — Calls the notification-service via Eureka service discovery.
 *
 * The name "NOTIFICATION-SERVICE" must match the spring.application.name
 * registered in Eureka by the notification-service.
 *
 * When this Feign call fails (e.g., notification-service is down), it should NOT
 * cause the wallet operation to fail. In V2, we'll add a fallback/resilience pattern.
 */
@FeignClient(name = "NOTIFICATION-SERVICE")
public interface NotificationFeignClient {

    @PostMapping("/internal/notifications/create")
    void createNotification(@RequestBody CreateNotificationRequest request);

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    class CreateNotificationRequest {
        private UUID userId;
        private String title;
        private String message;
        private String channel;  // IN_APP | EMAIL | IN_APP_AND_EMAIL
    }
}
