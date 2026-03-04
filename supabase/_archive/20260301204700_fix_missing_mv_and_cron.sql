-- Fix: Create missing mart_sales_category_daily_mv + add refresh_marts cron
-- ============================================================

-- 1. Create the missing materialized view
-- Based on product_sales_daily_unified (which already includes POS data)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mart_sales_category_daily_mv AS
SELECT
  p.org_id,
  p.location_id,
  p.day AS date,
  p.product_id,
  p.product_name,
  p.product_category AS category,
  p.units_sold,
  p.net_sales,
  (p.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0) AS cogs,
  'estimated'::text AS cogs_source
FROM product_sales_daily_unified p
LEFT JOIN location_settings ls ON ls.location_id = p.location_id;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mart_sales_category_daily_mv_pk
  ON mart_sales_category_daily_mv (org_id, location_id, date, product_id);

GRANT SELECT ON mart_sales_category_daily_mv TO anon, authenticated;

-- Wrapper view
DROP VIEW IF EXISTS mart_sales_category_daily;
CREATE OR REPLACE VIEW mart_sales_category_daily AS
SELECT * FROM mart_sales_category_daily_mv;
GRANT SELECT ON mart_sales_category_daily TO anon, authenticated;

-- 2. Add cron job for refresh_marts (every 15 minutes)
-- Uses pg_cron to call refresh_all_mvs + process_refresh_mvs_jobs
-- ============================================================

SELECT cron.schedule(
  'refresh-marts-every-15m',
  '*/15 * * * *',
  $$SELECT refresh_all_mvs('cron')$$
);

SELECT cron.schedule(
  'process-refresh-jobs-every-5m',
  '*/5 * * * *',
  $$SELECT process_refresh_mvs_jobs()$$
);
