package com.paynexus.orderengineservice.dto.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketPricesResponse {

    private Map<String, Double> prices;
    private int totalSymbols;
}
