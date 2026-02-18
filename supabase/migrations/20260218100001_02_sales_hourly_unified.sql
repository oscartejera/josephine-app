-- ============================================================
-- UI Contract View: sales_hourly_unified
--
-- Aggregates 15-minute fact buckets into hourly granularity.
-- Provides org_id, location_id, day, hour_of_day + hourly KPIs.
--
-- Source: facts_sales_15m (pre-aggregated fact table)
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  l.group_id                                                AS org_id,
  f.location_id,
  (f.ts_bucket AT TIME ZONE l.timezone)::date               AS day,
  date_trunc('hour', f.ts_bucket AT TIME ZONE l.timezone)
    AT TIME ZONE l.timezone                                 AS hour_bucket,
  EXTRACT(hour FROM f.ts_bucket AT TIME ZONE l.timezone)::smallint
                                                             AS hour_of_day,
  SUM(f.sales_net)::numeric(12,2)                            AS net_sales,
  SUM(f.sales_gross)::numeric(12,2)                          AS gross_sales,
  SUM(f.tickets)::int                                        AS orders_count,
  SUM(f.covers)::int                                         AS covers,
  CASE
    WHEN SUM(f.tickets) > 0
    THEN (SUM(f.sales_net) / SUM(f.tickets))::numeric(12,2)
    ELSE 0::numeric(12,2)
  END                                                        AS avg_check,
  SUM(f.discounts)::numeric(12,2)                            AS discounts,
  SUM(f.refunds)::numeric(12,2)                              AS refunds,
  f.data_source
FROM facts_sales_15m f
JOIN locations l ON l.id = f.location_id
GROUP BY
  l.group_id,
  f.location_id,
  l.timezone,
  (f.ts_bucket AT TIME ZONE l.timezone)::date,
  date_trunc('hour', f.ts_bucket AT TIME ZONE l.timezone),
  EXTRACT(hour FROM f.ts_bucket AT TIME ZONE l.timezone),
  f.data_source;

ALTER VIEW sales_hourly_unified SET (security_invoker = true);

COMMENT ON VIEW sales_hourly_unified IS
  'UI contract: hourly sales aggregated from 15-min fact buckets. '
  'Timezone-aware via locations.timezone. '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON sales_hourly_unified TO authenticated;

-- Recommended index: the UNIQUE(location_id, ts_bucket) on facts_sales_15m
-- already covers the primary access pattern. Add a covering index for
-- date-range scans if not present.
CREATE INDEX IF NOT EXISTS idx_facts_sales_15m_loc_bucket_ds
  ON facts_sales_15m(location_id, ts_bucket, data_source);
