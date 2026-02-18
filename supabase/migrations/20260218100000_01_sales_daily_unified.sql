-- ============================================================
-- UI Contract View: sales_daily_unified
--
-- Replaces the legacy view with an enriched version that adds:
--   - org_id  (from locations.group_id)
--   - day     (canonical date column per UI contract)
--   - avg_check (computed net_sales / orders_count)
--
-- Backward compat: keeps `date` column so existing RPCs and
-- frontend code (.select('date, ...')) continue to work.
--
-- Sources: pos_daily_finance + pos_daily_metrics + locations
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

-- 1) Drop the old view (plpgsql RPCs re-resolve on next call;
--    SQL functions need re-creation below)
DROP VIEW IF EXISTS sales_daily_unified;

-- 2) Create the new contract view
CREATE VIEW sales_daily_unified AS
SELECT
  l.group_id                                                   AS org_id,
  COALESCE(pdf.location_id, pdm.location_id)                  AS location_id,
  COALESCE(pdf.date, pdm.date)                                 AS day,
  COALESCE(pdf.date, pdm.date)                                 AS date,
  COALESCE(pdf.net_sales, pdm.net_sales, 0)::numeric(12,2)    AS net_sales,
  COALESCE(pdf.gross_sales, 0)::numeric(12,2)                  AS gross_sales,
  COALESCE(pdf.orders_count, pdm.orders, 0)::numeric(12,2)    AS orders_count,
  CASE
    WHEN COALESCE(pdf.orders_count, pdm.orders, 0) > 0
    THEN (COALESCE(pdf.net_sales, pdm.net_sales, 0)
          / COALESCE(pdf.orders_count, pdm.orders, 1))::numeric(12,2)
    ELSE 0::numeric(12,2)
  END                                                           AS avg_check,
  COALESCE(pdf.payments_cash, 0)::numeric(12,2)                AS payments_cash,
  COALESCE(pdf.payments_card, 0)::numeric(12,2)                AS payments_card,
  COALESCE(pdf.payments_other, 0)::numeric(12,2)               AS payments_other,
  COALESCE(pdf.refunds_amount, 0)::numeric(12,2)               AS refunds_amount,
  COALESCE(pdf.refunds_count, 0)::numeric(12,2)                AS refunds_count,
  COALESCE(pdf.discounts_amount, 0)::numeric(12,2)             AS discounts_amount,
  COALESCE(pdf.comps_amount, 0)::numeric(12,2)                 AS comps_amount,
  COALESCE(pdf.voids_amount, 0)::numeric(12,2)                 AS voids_amount,
  pdm.labor_cost::numeric(12,2)                                 AS labor_cost,
  pdm.labor_hours::numeric(12,2)                                AS labor_hours,
  COALESCE(pdf.data_source, pdm.data_source, 'simulated')      AS data_source
FROM pos_daily_finance pdf
FULL OUTER JOIN pos_daily_metrics pdm
  ON pdf.date = pdm.date
  AND pdf.location_id = pdm.location_id
JOIN locations l
  ON l.id = COALESCE(pdf.location_id, pdm.location_id);

-- 3) Security: queries execute under the calling user's privileges
ALTER VIEW sales_daily_unified SET (security_invoker = true);

COMMENT ON VIEW sales_daily_unified IS
  'UI contract: daily sales KPIs per location. Joins pos_daily_finance + pos_daily_metrics. '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON sales_daily_unified TO authenticated;

-- 4) Recommended indexes on base tables (location_id first for
--    WHERE location_id = X AND date BETWEEN queries)
CREATE INDEX IF NOT EXISTS idx_pos_daily_finance_loc_date
  ON pos_daily_finance(location_id, date);
CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_loc_date
  ON pos_daily_metrics(location_id, date);

-- ============================================================
-- 5) Re-create the SQL function get_labour_timeseries
--    (SQL-language functions cache plans; the old plan references
--    the dropped view and must be refreshed via CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_labour_timeseries(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL::uuid,
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE(
  date date, actual_sales numeric, forecast_sales numeric,
  actual_labor_cost numeric, planned_labor_cost numeric,
  actual_hours numeric, planned_hours numeric,
  actual_orders numeric, forecast_orders numeric,
  actual_col_pct numeric, planned_col_pct numeric,
  actual_splh numeric, planned_splh numeric,
  actual_oplh numeric, planned_oplh numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH date_range AS (
    SELECT d::date AS the_date
    FROM generate_series(date_from, date_to, '1 day'::interval) d
  ),
  daily_agg AS (
    SELECT
      dr.the_date AS agg_date,
      COALESCE(SUM(p.net_sales), 0) AS sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) AS sum_forecast_sales,
      COALESCE(SUM(p.labor_cost), 0) AS sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) AS sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) AS sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) AS sum_planned_hours,
      COALESCE(SUM(p.orders_count), 0) AS sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) AS sum_forecast_orders
    FROM date_range dr
    LEFT JOIN sales_daily_unified p
      ON p.date = dr.the_date
      AND p.data_source = p_data_source
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
    LEFT JOIN forecast_daily_metrics f
      ON f.date = dr.the_date
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY dr.the_date
  )
  SELECT
    agg_date,
    ROUND(sum_sales::numeric, 2),
    ROUND(sum_forecast_sales::numeric, 2),
    ROUND(sum_labor_cost::numeric, 2),
    ROUND(sum_planned_cost::numeric, 2),
    ROUND(sum_hours::numeric, 1),
    ROUND(sum_planned_hours::numeric, 1),
    ROUND(sum_orders::numeric, 0),
    ROUND(sum_forecast_orders::numeric, 0),
    CASE WHEN sum_sales > 0 THEN ROUND((sum_labor_cost / sum_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_forecast_sales > 0 THEN ROUND((sum_planned_cost / sum_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_hours > 0 THEN ROUND((sum_sales / sum_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast_sales / sum_planned_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_hours > 0 THEN ROUND((sum_orders / sum_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast_orders / sum_planned_hours)::numeric, 2) ELSE 0 END
  FROM daily_agg
  ORDER BY agg_date;
$function$;
