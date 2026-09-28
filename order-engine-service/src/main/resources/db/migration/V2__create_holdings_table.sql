CREATE TABLE holdings (
                          id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          user_id        UUID NOT NULL,
                          symbol         VARCHAR(20) NOT NULL,
                          quantity       INT NOT NULL DEFAULT 0,
                          avg_buy_price  DECIMAL(10, 2) NOT NULL,
                          total_invested DECIMAL(15, 2) NOT NULL,
                          updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                          CONSTRAINT unique_user_symbol UNIQUE (user_id, symbol)
);
