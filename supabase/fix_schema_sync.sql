-- ===========================================
-- FIX 1: Recreate sales_daily_unified with org_id
-- ===========================================
DROP VIEW IF EXISTS sales_daily_unified CASCADE;

CREATE VIEW sales_daily_unified AS
-- Demo data
SELECT
  ds.org_id, ds.location_id,
  ds.day AS date,
  COALESCE(ds.net_sales, 0)::numeric AS net_sales,
  COALESCE(ds.gross_sales, 0)::numeric AS gross_sales,
  COALESCE(ds.orders_count, 0)::integer AS orders_count,
  CASE WHEN COALESCE(ds.orders_count, 0) > 0
       THEN (ds.net_sales / ds.orders_count)::numeric ELSE 0 END AS avg_check,
  COALESCE(ds.payments_cash, ROUND(ds.payments_total * 0.25, 2), 0)::numeric AS payments_cash,
  COALESCE(ds.payments_card, ROUND(ds.payments_total * 0.75, 2), 0)::numeric AS payments_card,
  0::numeric AS payments_other,
  COALESCE(ds.refunds, 0)::numeric AS refunds_amount,
  GREATEST(1, COALESCE(ds.orders_count, 0) / 50)::integer AS refunds_count,
  COALESCE(ds.discounts, 0)::numeric AS discounts_amount,
  COALESCE(ds.comps, 0)::numeric AS comps_amount,
  COALESCE(ds.voids, 0)::numeric AS voids_amount,
  COALESCE(lab.labour_cost, 0)::numeric AS labor_cost,
  COALESCE(lab.labour_hours, 0)::numeric AS labor_hours,
  'demo'::text AS data_source
FROM daily_sales ds
LEFT JOIN (
  SELECT te.org_id, te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) AS labour_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0 
        * COALESCE(e.hourly_cost, 14.50)) AS labour_cost
  FROM time_entries te
  JOIN locations l ON l.id = te.location_id
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date
) lab ON lab.org_id = ds.org_id AND lab.location_id = ds.location_id AND lab.day = ds.day
UNION ALL
-- POS data
SELECT
  o.org_id, o.location_id,
  (o.closed_at::date) AS date,
  COALESCE(SUM(o.net_sales), 0)::numeric AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric AS gross_sales,
  COUNT(*)::integer AS orders_count,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END AS avg_check,
  ROUND(COALESCE(SUM(o.payments_total), 0) * 0.25, 2)::numeric AS payments_cash,
  ROUND(COALESCE(SUM(o.payments_total), 0) * 0.75, 2)::numeric AS payments_card,
  0::numeric AS payments_other,
  COALESCE(SUM(o.refunds), 0)::numeric AS refunds_amount,
  0::integer AS refunds_count,
  COALESCE(SUM(o.discounts), 0)::numeric AS discounts_amount,
  COALESCE(SUM(o.comps), 0)::numeric AS comps_amount,
  COALESCE(SUM(o.voids), 0)::numeric AS voids_amount,
  0::numeric AS labor_cost,
  0::numeric AS labor_hours,
  'pos'::text AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date;

-- Grant permissions
GRANT SELECT ON sales_daily_unified TO anon, authenticated;
