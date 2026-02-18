-- ============================================================
-- UI Contract View: labour_daily_unified
--
-- Combines actual labour data with scheduled shifts into a
-- single daily view per location. Uses CTEs to pre-aggregate
-- each source independently, then joins once.
--
-- Sources:
--   - labour_daily        → actual hours & cost
--   - planned_shifts      → scheduled hours & cost & headcount
--   - locations           → org_id (group_id)
--
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

CREATE OR REPLACE VIEW labour_daily_unified AS
WITH scheduled AS (
  SELECT
    ps.location_id,
    ps.shift_date                          AS day,
    SUM(ps.planned_hours)::numeric(12,2)   AS scheduled_hours,
    SUM(COALESCE(ps.planned_cost, 0))::numeric(12,2)
                                            AS scheduled_cost,
    COUNT(DISTINCT ps.employee_id)::int    AS scheduled_headcount
  FROM planned_shifts ps
  WHERE ps.status NOT IN ('cancelled')
  GROUP BY ps.location_id, ps.shift_date
),
actual AS (
  SELECT
    ld.location_id,
    ld.date                                AS day,
    ld.labour_hours::numeric(12,2)         AS actual_hours,
    ld.labour_cost::numeric(12,2)          AS actual_cost
  FROM labour_daily ld
)
SELECT
  l.group_id                                                   AS org_id,
  COALESCE(a.location_id, s.location_id)                       AS location_id,
  COALESCE(a.day, s.day)                                       AS day,
  COALESCE(a.actual_hours, 0)::numeric(12,2)                   AS actual_hours,
  COALESCE(a.actual_cost, 0)::numeric(12,2)                    AS actual_cost,
  COALESCE(s.scheduled_hours, 0)::numeric(12,2)                AS scheduled_hours,
  COALESCE(s.scheduled_cost, 0)::numeric(12,2)                 AS scheduled_cost,
  COALESCE(s.scheduled_headcount, 0)::int                      AS scheduled_headcount,
  (COALESCE(a.actual_hours, 0)
   - COALESCE(s.scheduled_hours, 0))::numeric(12,2)            AS hours_variance,
  (COALESCE(a.actual_cost, 0)
   - COALESCE(s.scheduled_cost, 0))::numeric(12,2)             AS cost_variance,
  CASE
    WHEN COALESCE(s.scheduled_hours, 0) > 0
    THEN ((COALESCE(a.actual_hours, 0) - s.scheduled_hours)
          / s.scheduled_hours * 100)::numeric(5,2)
    ELSE 0::numeric(5,2)
  END                                                           AS hours_variance_pct
FROM actual a
FULL OUTER JOIN scheduled s
  ON a.location_id = s.location_id
  AND a.day = s.day
JOIN locations l
  ON l.id = COALESCE(a.location_id, s.location_id);

ALTER VIEW labour_daily_unified SET (security_invoker = true);

COMMENT ON VIEW labour_daily_unified IS
  'UI contract: daily labour actual vs scheduled per location. '
  'Joins labour_daily (actuals) + planned_shifts (schedule). '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON labour_daily_unified TO authenticated;

-- Recommended indexes on base tables
CREATE INDEX IF NOT EXISTS idx_labour_daily_loc_date
  ON labour_daily(location_id, date);
CREATE INDEX IF NOT EXISTS idx_planned_shifts_loc_date_status
  ON planned_shifts(location_id, shift_date, status);
