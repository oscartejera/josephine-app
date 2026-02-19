-- ============================================================
-- PR6: Materialized View Refresh via pg_cron
-- Schedule 15-minute concurrent refreshes for materialized views.
-- ============================================================

-- Enable pg_cron extension (Supabase has it available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (required for Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule: refresh product_sales_daily_unified every 15 minutes
SELECT cron.schedule(
  'refresh_product_sales_daily_unified',
  '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_daily_unified$$
);

-- Schedule: refresh mv_sales_hourly every 15 minutes (if it exists as MV)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_sales_hourly'
  ) THEN
    PERFORM cron.schedule(
      'refresh_mv_sales_hourly',
      '*/15 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_hourly'
    );
  END IF;
END $$;
