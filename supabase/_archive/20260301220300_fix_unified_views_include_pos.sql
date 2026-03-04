-- ============================================================
-- Fix: Unified views UNION ALL demo + POS data from CDM tables
-- ============================================================
-- Previously all 3 views hardcoded 'demo' and only read demo tables.
-- Now they UNION ALL with POS data aggregated from cdm_orders/cdm_order_lines.

-- Must DROP sales_daily_unified first (has dependents like mart_kpi_daily_mv)
DROP VIEW IF EXISTS mart_kpi_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_kpi_daily_mv CASCADE;
DROP VIEW IF EXISTS sales_daily_unified CASCADE;

-- 1) sales_daily_unified: demo (daily_sales) + POS (cdm_orders aggregated)
CREATE VIEW sales_daily_unified AS
SELECT
  ds.org_id,
  ds.location_id,
  ds.day                                                        AS date,
  COALESCE(ds.net_sales,  0)::numeric                           AS net_sales,
  COALESCE(ds.gross_sales, 0)::numeric                          AS gross_sales,
  COALESCE(ds.orders_count, 0)::integer                         AS orders_count,
  CASE WHEN COALESCE(ds.orders_count, 0) > 0
       THEN (ds.net_sales / ds.orders_count)::numeric
       ELSE 0 END                                               AS avg_check,
  0::numeric                                                    AS payments_cash,
  COALESCE(ds.payments_total, 0)::numeric                       AS payments_card,
  0::numeric                                                    AS payments_other,
  COALESCE(ds.refunds, 0)::numeric                              AS refunds_amount,
  0::integer                                                    AS refunds_count,
  COALESCE(ds.discounts, 0)::numeric                            AS discounts_amount,
  COALESCE(ds.comps, 0)::numeric                                AS comps_amount,
  COALESCE(ds.voids, 0)::numeric                                AS voids_amount,
  COALESCE(lab.labour_cost, 0)::numeric                         AS labor_cost,
  COALESCE(lab.labour_hours, 0)::numeric                        AS labor_hours,
  'demo'::text                                                  AS data_source
FROM daily_sales ds
LEFT JOIN (
  SELECT
    te.org_id, te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) AS labour_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) * 14.50 AS labour_cost
  FROM time_entries te
  JOIN locations l ON l.id = te.location_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date
) lab ON lab.org_id = ds.org_id AND lab.location_id = ds.location_id AND lab.day = ds.day
UNION ALL
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at::date)                                           AS date,
  COALESCE(SUM(o.net_sales), 0)::numeric                       AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric AS gross_sales,
  COUNT(*)::integer                                              AS orders_count,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric
       ELSE 0 END                                               AS avg_check,
  0::numeric                                                    AS payments_cash,
  COALESCE(SUM(o.payments_total), 0)::numeric                  AS payments_card,
  0::numeric                                                    AS payments_other,
  COALESCE(SUM(o.refunds), 0)::numeric                         AS refunds_amount,
  0::integer                                                    AS refunds_count,
  COALESCE(SUM(o.discounts), 0)::numeric                       AS discounts_amount,
  COALESCE(SUM(o.comps), 0)::numeric                           AS comps_amount,
  COALESCE(SUM(o.voids), 0)::numeric                           AS voids_amount,
  0::numeric                                                    AS labor_cost,
  0::numeric                                                    AS labor_hours,
  'pos'::text                                                   AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date;

GRANT SELECT ON sales_daily_unified TO anon, authenticated;

-- Recreate mart_kpi_daily_mv
CREATE MATERIALIZED VIEW mart_kpi_daily_mv AS
SELECT org_id, location_id, date, net_sales, gross_sales, orders_count,
       avg_check, labor_cost, labor_hours, data_source
FROM sales_daily_unified;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkd_mv ON mart_kpi_daily_mv (org_id, location_id, date, data_source);
CREATE OR REPLACE VIEW mart_kpi_daily AS SELECT * FROM mart_kpi_daily_mv;
GRANT SELECT ON mart_kpi_daily_mv TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily TO anon, authenticated;

-- 2) sales_hourly_unified: demo (v1 MV) + POS (cdm_orders aggregated hourly)
CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  mv.org_id, mv.location_id, mv.day, mv.hour_bucket, mv.hour_of_day,
  mv.net_sales, mv.gross_sales, mv.orders_count, mv.covers, mv.avg_check,
  mv.discounts, mv.refunds,
  'demo'::text AS data_source
FROM sales_hourly_unified_mv mv
UNION ALL
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at::date) AS day,
  date_trunc('hour', o.closed_at)::timestamptz AS hour_bucket,
  EXTRACT(HOUR FROM o.closed_at)::integer AS hour_of_day,
  COALESCE(SUM(o.net_sales), 0)::numeric AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric AS gross_sales,
  COUNT(*)::integer AS orders_count,
  COUNT(*)::integer AS covers,
  CASE WHEN COUNT(*) > 0 THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END AS avg_check,
  COALESCE(SUM(o.discounts), 0)::numeric AS discounts,
  COALESCE(SUM(o.refunds), 0)::numeric AS refunds,
  'pos'::text AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         date_trunc('hour', o.closed_at), EXTRACT(HOUR FROM o.closed_at);

GRANT SELECT ON sales_hourly_unified TO anon, authenticated;

-- 3) product_sales_daily_unified: demo (v1 MV) + POS (cdm_order_lines aggregated)
CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  mv.org_id, mv.location_id, mv.day, mv.product_id, mv.product_name,
  mv.product_category, mv.units_sold, mv.net_sales, mv.cogs,
  mv.gross_profit, mv.margin_pct,
  'demo'::text AS data_source,
  mv.day AS date
FROM product_sales_daily_unified_mv mv
UNION ALL
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at::date) AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(ci.name, 'Unknown') AS product_name,
  COALESCE(ci.category, 'Other') AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric AS net_sales,
  ROUND(COALESCE(SUM(ol.gross), 0) * 0.30, 2)::numeric AS cogs,
  ROUND(COALESCE(SUM(ol.gross), 0) * 0.70, 2)::numeric AS gross_profit,
  70.0::numeric AS margin_pct,
  'pos'::text AS data_source,
  (o.closed_at::date) AS date
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         ol.item_id, ci.name, ci.category;

GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
