package com.paynexus.orderengineservice.dto.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockPriceResponse {

    private String symbol;
    private double currentPrice;
    private List<String> priceHistory; // last 20 ticks, most recent first
}
