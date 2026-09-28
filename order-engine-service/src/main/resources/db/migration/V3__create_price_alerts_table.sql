CREATE TABLE price_alerts (
                              id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              user_id      UUID NOT NULL,
                              symbol       VARCHAR(20) NOT NULL,
                              target_price DECIMAL(10, 2) NOT NULL,
                              direction    VARCHAR(10) NOT NULL,   -- ABOVE | BELOW
                              is_active    BOOLEAN DEFAULT TRUE,
                              triggered_at TIMESTAMP WITH TIME ZONE,
                              created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
