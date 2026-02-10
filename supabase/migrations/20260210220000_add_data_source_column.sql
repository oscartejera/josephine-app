-- Add data_source column to distinguish simulated vs real POS data
-- When POS is connected, app shows only 'pos' data; when disconnected, shows 'simulated'

ALTER TABLE pos_daily_finance ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'simulated';
ALTER TABLE product_sales_daily ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'simulated';
ALTER TABLE pos_daily_metrics ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'simulated';

CREATE INDEX IF NOT EXISTS idx_pos_daily_finance_data_source ON pos_daily_finance(data_source);
CREATE INDEX IF NOT EXISTS idx_product_sales_daily_data_source ON product_sales_daily(data_source);
CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_data_source ON pos_daily_metrics(data_source);
