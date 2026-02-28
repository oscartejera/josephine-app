-- =============================================================
-- Josephine — Demo Verification Queries
-- =============================================================
-- Usage: Run in the Supabase SQL Editor.
-- Replace <org_id> with your actual org UUID, or use the
-- auto-detect query in section 0.
-- =============================================================

-- 0) Auto-detect org_id
-- (Use the result in all queries below)
SELECT id AS org_id FROM orgs ORDER BY created_at ASC LIMIT 1;


-- 1) Resolver: current data source decision
SELECT resolve_data_source(
  (SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1)
) AS resolver_result;


-- 2) No-mixing: one source per org in sales_daily_unified
SELECT org_id, data_source, COUNT(*) AS rows
FROM sales_daily_unified
GROUP BY 1, 2
ORDER BY 1, 2;


-- 3) Materialized views exist (v1 + v2)
SELECT
  to_regclass('public.sales_hourly_unified_mv')       AS hourly_v1,
  to_regclass('public.sales_hourly_unified_mv_v2')    AS hourly_v2,
  to_regclass('public.product_sales_daily_unified_mv')    AS product_v1,
  to_regclass('public.product_sales_daily_unified_mv_v2') AS product_v2,
  to_regclass('public.mart_kpi_daily_mv')             AS kpi_mart;


-- 4) View row counts
SELECT 'sales_hourly_unified'          AS view, COUNT(*) AS rows FROM sales_hourly_unified
UNION ALL
SELECT 'product_sales_daily_unified',         COUNT(*) FROM product_sales_daily_unified
UNION ALL
SELECT 'sales_daily_unified',                 COUNT(*) FROM sales_daily_unified
UNION ALL
SELECT 'forecast_daily_unified',              COUNT(*) FROM forecast_daily_unified;


-- 5) Refresh all MVs (safe — skips missing ones)
SELECT ops.refresh_all_mvs('demo_verification') AS refresh_result;


-- 6) Refresh log (last 5 entries)
SELECT id, triggered_by, status, duration_ms, error_message
FROM ops.mv_refresh_log
ORDER BY id DESC
LIMIT 5;


-- 7) Trigger on integration_sync_runs
SELECT tgname, pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.integration_sync_runs'::regclass
  AND tgname ILIKE '%refresh%';


-- 8) Recent refresh jobs
SELECT id, job_type::text, status::text, created_at, finished_at, last_error
FROM jobs
WHERE job_type::text ILIKE '%refresh%'
ORDER BY created_at DESC
LIMIT 5;


-- 9) Current org mode
SELECT data_source_mode
FROM org_settings
WHERE org_id = (SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1);


-- 10) Grants check
SELECT
  has_table_privilege('authenticated', 'sales_daily_unified', 'SELECT')           AS auth_sdu,
  has_table_privilege('authenticated', 'sales_hourly_unified', 'SELECT')          AS auth_shu,
  has_table_privilege('authenticated', 'product_sales_daily_unified', 'SELECT')   AS auth_pdu,
  has_table_privilege('authenticated', 'forecast_daily_unified', 'SELECT')        AS auth_fdu,
  has_function_privilege('service_role', 'ops.refresh_all_mvs(text)', 'EXECUTE')  AS sr_refresh;
