-- ============================================================
-- UI Contract View: budget_daily_unified
--
-- Daily budget targets per location with computed profit target.
--
-- Source: budgets_daily + locations
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

CREATE OR REPLACE VIEW budget_daily_unified AS
SELECT
  l.group_id                                                     AS org_id,
  bd.location_id,
  bd.date                                                        AS day,
  bd.budget_sales::numeric(12,2)                                 AS budget_sales,
  bd.budget_labour::numeric(12,2)                                AS budget_labour,
  bd.budget_cogs::numeric(12,2)                                  AS budget_cogs,
  (bd.budget_sales - bd.budget_cogs - bd.budget_labour)::numeric(12,2)
                                                                  AS budget_profit,
  CASE
    WHEN bd.budget_sales > 0
    THEN ((bd.budget_sales - bd.budget_cogs - bd.budget_labour)
          / bd.budget_sales * 100)::numeric(5,2)
    ELSE 0::numeric(5,2)
  END                                                             AS budget_margin_pct,
  CASE
    WHEN bd.budget_sales > 0
    THEN (bd.budget_labour / bd.budget_sales * 100)::numeric(5,2)
    ELSE 0::numeric(5,2)
  END                                                             AS budget_col_pct,
  CASE
    WHEN bd.budget_sales > 0
    THEN (bd.budget_cogs / bd.budget_sales * 100)::numeric(5,2)
    ELSE 0::numeric(5,2)
  END                                                             AS budget_cogs_pct
FROM budgets_daily bd
JOIN locations l ON l.id = bd.location_id;

ALTER VIEW budget_daily_unified SET (security_invoker = true);

COMMENT ON VIEW budget_daily_unified IS
  'UI contract: daily budget targets per location with derived ratios. '
  'Source: budgets_daily. '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON budget_daily_unified TO authenticated;

-- The UNIQUE(date, location_id) on budgets_daily already provides an index.
-- Add a (location_id, date) index for location-first queries.
CREATE INDEX IF NOT EXISTS idx_budgets_daily_loc_date
  ON budgets_daily(location_id, date);
