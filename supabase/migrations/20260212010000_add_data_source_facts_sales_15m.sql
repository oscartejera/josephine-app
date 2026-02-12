-- Add data_source column to facts_sales_15m for A/B switching (POS vs simulated)
ALTER TABLE facts_sales_15m ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'simulated';
CREATE INDEX IF NOT EXISTS idx_facts_sales_15m_data_source ON facts_sales_15m(data_source);
