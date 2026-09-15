package com.paynexus.walletservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Password encoder configuration using spring-security-crypto (standalone library).
 *
 * We use BCrypt (strength=10) to hash:
 *  1. User account passwords
 *  2. Transaction PINs
 *
 * Why standalone crypto and not spring-boot-starter-security?
 * - The full security starter auto-blocks ALL endpoints with HTTP 401.
 * - We don't have Keycloak / JWT yet (that's V3).
 * - spring-security-crypto gives us ONLY BCryptPasswordEncoder — no filters, no CSRF, no sessions.
 */
@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10); // strength 10 is production standard
    }
}
