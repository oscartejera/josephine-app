-- ============================================================
-- UI Contract View: forecast_daily_unified
--
-- Daily forecast metrics per location with confidence bands
-- from the hourly model aggregated to daily level.
--
-- Sources: forecast_daily_metrics + forecast_hourly_metrics + locations
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

CREATE OR REPLACE VIEW forecast_daily_unified AS
SELECT
  l.group_id                                                  AS org_id,
  fdm.location_id,
  fdm.date                                                    AS day,
  fdm.forecast_sales::numeric(12,2)                           AS forecast_sales,
  fdm.forecast_orders::numeric(12,2)                          AS forecast_orders,
  fdm.planned_labor_hours::numeric(12,2)                      AS planned_labor_hours,
  fdm.planned_labor_cost::numeric(12,2)                       AS planned_labor_cost,
  CASE
    WHEN fdm.forecast_orders > 0
    THEN (fdm.forecast_sales / fdm.forecast_orders)::numeric(12,2)
    ELSE 0::numeric(12,2)
  END                                                          AS forecast_avg_check,
  COALESCE(bands.forecast_sales_lower, 0)::numeric(12,2)      AS forecast_sales_lower,
  COALESCE(bands.forecast_sales_upper, 0)::numeric(12,2)      AS forecast_sales_upper,
  fdm.data_source
FROM forecast_daily_metrics fdm
JOIN locations l ON l.id = fdm.location_id
LEFT JOIN LATERAL (
  SELECT
    SUM(fh.forecast_sales_lower) AS forecast_sales_lower,
    SUM(fh.forecast_sales_upper) AS forecast_sales_upper
  FROM forecast_hourly_metrics fh
  WHERE fh.location_id = fdm.location_id
    AND fh.forecast_date = fdm.date
    AND fh.data_source = fdm.data_source
) bands ON true;

ALTER VIEW forecast_daily_unified SET (security_invoker = true);

COMMENT ON VIEW forecast_daily_unified IS
  'UI contract: daily forecast with confidence bands. '
  'Joins forecast_daily_metrics + forecast_hourly_metrics (aggregated). '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON forecast_daily_unified TO authenticated;

-- Recommended indexes for the LATERAL join on forecast_hourly_metrics
CREATE INDEX IF NOT EXISTS idx_forecast_daily_metrics_loc_date
  ON forecast_daily_metrics(location_id, date);
CREATE INDEX IF NOT EXISTS idx_forecast_hourly_loc_date_ds
  ON forecast_hourly_metrics(location_id, forecast_date, data_source);
