package com.paynexus.orderengineservice.dto.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedStatusResponse {

    private String mode;            // "SIMULATION" | "LIVE"
    private LocalDateTime lastUpdated;
    private int trackedSymbols;
    private String description;
}
