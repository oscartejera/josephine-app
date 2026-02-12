-- ============================================================
-- Unified data_source VIEWs
--
-- Problem: legacy fact tables use 'simulated' for demo data,
-- while newer forecast tables use 'demo'. Every RPC has to map
-- 'demo' -> 'simulated' with a v_ds_legacy variable.
--
-- Solution: VIEWs that expose a normalized `data_source_unified`
-- column ('demo' | 'pos') so consumers can filter with a single
-- value. The original `data_source` column is preserved.
-- ============================================================

-- 1) facts_sales_15m
CREATE OR REPLACE VIEW v_facts_sales_15m_unified AS
SELECT
  *,
  CASE WHEN data_source = 'simulated' THEN 'demo' ELSE data_source END
    AS data_source_unified
FROM facts_sales_15m;

COMMENT ON VIEW v_facts_sales_15m_unified IS
  'facts_sales_15m with normalized data_source_unified (demo|pos)';

-- 2) pos_daily_finance
CREATE OR REPLACE VIEW v_pos_daily_finance_unified AS
SELECT
  *,
  CASE WHEN data_source = 'simulated' THEN 'demo' ELSE data_source END
    AS data_source_unified
FROM pos_daily_finance;

COMMENT ON VIEW v_pos_daily_finance_unified IS
  'pos_daily_finance with normalized data_source_unified (demo|pos)';

-- 3) product_sales_daily
CREATE OR REPLACE VIEW v_product_sales_daily_unified AS
SELECT
  *,
  CASE WHEN data_source = 'simulated' THEN 'demo' ELSE data_source END
    AS data_source_unified
FROM product_sales_daily;

COMMENT ON VIEW v_product_sales_daily_unified IS
  'product_sales_daily with normalized data_source_unified (demo|pos)';

-- Grant SELECT on views to authenticated users
GRANT SELECT ON v_facts_sales_15m_unified TO authenticated;
GRANT SELECT ON v_pos_daily_finance_unified TO authenticated;
GRANT SELECT ON v_product_sales_daily_unified TO authenticated;
