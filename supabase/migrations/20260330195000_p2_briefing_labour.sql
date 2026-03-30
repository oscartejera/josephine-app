-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: P2 — Labour Briefing Fix + Consistency
--
-- 1. Fix get_labour_cost_by_date: use time_entries before planned_shifts
--    (same pattern as rpc_kpi_range_summary P1 fix)
-- 2. Signature update: accept date range instead of single date
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old signature (single date)
DROP FUNCTION IF EXISTS get_labour_cost_by_date(uuid[], date);

-- Recreated with date range and time_entries priority
CREATE OR REPLACE FUNCTION get_labour_cost_by_date(
  _location_ids uuid[],
  _from date,
  _to date DEFAULT NULL
)
RETURNS TABLE(location_id uuid, labour_cost numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_to date;
BEGIN
  v_to := COALESCE(_to, _from);

  -- Try time_entries first (actual hours)
  RETURN QUERY
  WITH actual AS (
    SELECT
      te.location_id AS loc_id,
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
        * COALESCE(e.hourly_cost, 0)
      ), 0) AS cost
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    WHERE te.location_id = ANY(_location_ids)
      AND te.clock_in::date BETWEEN _from AND v_to
      AND te.clock_out IS NOT NULL
    GROUP BY te.location_id
  ),
  planned AS (
    SELECT
      ps.location_id AS loc_id,
      COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS cost
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id = ANY(_location_ids)
      AND ps.shift_date BETWEEN _from AND v_to
    GROUP BY ps.location_id
  )
  SELECT
    COALESCE(a.loc_id, p.loc_id) AS location_id,
    CASE WHEN COALESCE(a.cost, 0) > 0 THEN a.cost ELSE COALESCE(p.cost, 0) END AS labour_cost
  FROM actual a
  FULL OUTER JOIN planned p ON a.loc_id = p.loc_id;
END;
$$;
