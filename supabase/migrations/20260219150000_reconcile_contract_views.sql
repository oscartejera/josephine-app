-- ============================================================
-- PR3: Reconcile Contract Views
-- 1. budget_daily_unified — add budget_drivers join
-- 2. labour_daily_unified — use real hourly_cost from employees
-- 3. forecast_daily_unified — already has forecast_orders (no change)
-- Idempotent: CREATE OR REPLACE VIEW throughout.
-- ============================================================

-- ------------------------------------------------------------
-- 1. budget_daily_unified — add budget_drivers columns
-- JOIN budget_drivers via budget_day_id for target KPIs
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW budget_daily_unified AS
SELECT
  bd.org_id,
  bd.location_id,
  bd.day,
  COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'    THEN bm.value END), 0)::numeric AS budget_sales,
  COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost'  THEN bm.value END), 0)::numeric AS budget_labour,
  COALESCE(MAX(CASE WHEN bm.metric = 'cogs'         THEN bm.value END), 0)::numeric AS budget_cogs,
  -- profit = sales - labour - cogs
  (COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))::numeric AS budget_profit,
  -- margin_pct = profit / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN ((COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_margin_pct,
  -- col_pct = labour / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_col_pct,
  -- cogs_pct = cogs / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_cogs_pct,
  -- NEW: budget_drivers columns
  COALESCE(MAX(drv.target_covers), 0)::numeric           AS target_covers,
  COALESCE(MAX(drv.target_avg_check), 0)::numeric        AS target_avg_check,
  COALESCE(MAX(drv.target_cogs_pct), 0)::numeric         AS target_cogs_pct,
  COALESCE(MAX(drv.target_labour_hours), 0)::numeric     AS target_labour_hours,
  COALESCE(MAX(drv.target_hourly_rate), 0)::numeric      AS target_hourly_rate
FROM budget_days bd
JOIN budget_versions bv ON bv.id = bd.budget_version_id
LEFT JOIN budget_metrics bm
  ON bm.budget_day_id = bd.id
  AND bm.layer IN ('final', 'base')
LEFT JOIN budget_drivers drv
  ON drv.budget_day_id = bd.id
WHERE bv.status IN ('published', 'frozen')
GROUP BY bd.org_id, bd.location_id, bd.day;

GRANT SELECT ON budget_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. labour_daily_unified — use real hourly_cost from employees
-- COALESCE to 14.50 EUR/h as fallback for employees without cost
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW labour_daily_unified AS
SELECT
  COALESCE(a.org_id,       s.org_id)       AS org_id,
  COALESCE(a.location_id,  s.location_id)  AS location_id,
  COALESCE(a.day,          s.day)          AS day,
  COALESCE(a.actual_hours, 0)::numeric     AS actual_hours,
  COALESCE(a.actual_cost,  0)::numeric     AS actual_cost,
  COALESCE(s.scheduled_hours, 0)::numeric  AS scheduled_hours,
  COALESCE(s.scheduled_cost,  0)::numeric  AS scheduled_cost,
  COALESCE(s.scheduled_headcount, 0)::integer AS scheduled_headcount,
  (COALESCE(a.actual_hours, 0) - COALESCE(s.scheduled_hours, 0))::numeric AS hours_variance,
  (COALESCE(a.actual_cost,  0) - COALESCE(s.scheduled_cost,  0))::numeric AS cost_variance,
  CASE WHEN COALESCE(s.scheduled_hours, 0) > 0
       THEN ((COALESCE(a.actual_hours, 0) - s.scheduled_hours) / s.scheduled_hours * 100)::numeric
       ELSE 0 END AS hours_variance_pct
FROM (
  -- Actuals: aggregate time_entries per day with real hourly_cost
  SELECT
    te.org_id,
    te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)          AS actual_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
        * COALESCE(e.hourly_cost, 14.50))                                   AS actual_cost
  FROM time_entries te
  JOIN locations loc ON loc.id = te.location_id
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) a
FULL OUTER JOIN (
  -- Scheduled: aggregate shifts + assignments per day with real hourly_cost
  SELECT
    sch.org_id,
    sh.location_id,
    (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0)             AS scheduled_hours,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0
        * COALESCE(e.hourly_cost, 14.50))                                    AS scheduled_cost,
    COUNT(DISTINCT sa.employee_id)::integer                                   AS scheduled_headcount
  FROM shifts sh
  JOIN schedules sch ON sch.id = sh.schedule_id
  JOIN locations loc ON loc.id = sh.location_id
  LEFT JOIN shift_assignments sa ON sa.shift_id = sh.id
  LEFT JOIN employees e ON e.id = sa.employee_id
  GROUP BY sch.org_id, sh.location_id,
           (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) s ON a.org_id = s.org_id AND a.location_id = s.location_id AND a.day = s.day;

GRANT SELECT ON labour_daily_unified TO anon, authenticated;

-- NOTE: forecast_daily_unified already has forecast_orders from PR1 — no changes needed.
