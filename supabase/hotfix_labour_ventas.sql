-- ═══════════════════════════════════════════════════════════════
-- HOTFIX: Fix Labour + Ventas pages for v2 schema
-- Run this in Supabase SQL Editor (one block at a time if needed)
-- ═══════════════════════════════════════════════════════════════

-- ─── PART 1: Drop ALL overloads of conflicting functions ────
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname IN (
      'get_labour_kpis','get_labour_timeseries','get_labour_locations_table',
      'get_sales_timeseries_unified','get_employee_revenue_scores'
    )
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- ─── PART 2: Drop labour_daily if it's a table (should be a view) ────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'labour_daily' AND schemaname = 'public') THEN
    DROP TABLE public.labour_daily CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'labour_daily' AND schemaname = 'public') THEN
    DROP VIEW public.labour_daily CASCADE;
  END IF;
END $$;

-- ─── PART 3: Recreate labour_daily VIEW ────
CREATE OR REPLACE VIEW public.labour_daily AS
SELECT te.location_id, te.clock_in::date AS date,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric AS labour_cost,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric AS labour_hours
FROM time_entries te
LEFT JOIN employees e ON e.id = te.employee_id
GROUP BY te.location_id, te.clock_in::date;

GRANT SELECT ON labour_daily TO anon, authenticated;

-- ─── PART 4: Recreate mart_kpi_daily ────
CREATE OR REPLACE VIEW public.mart_kpi_daily AS
SELECT
  ds.org_id, ds.location_id, ds.day AS date,
  ds.net_sales, ds.orders_count,
  COALESCE(ld.labour_cost, 0) AS labour_cost,
  COALESCE(ld.labour_hours, 0) AS labour_hours,
  COALESCE(cd.cogs_amount, 0) AS cogs,
  CASE WHEN ds.net_sales > 0 THEN ROUND(COALESCE(ld.labour_cost,0)/ds.net_sales*100, 1) ELSE 0 END AS col_pct,
  CASE WHEN COALESCE(ld.labour_hours,0) > 0 THEN ROUND(ds.net_sales/ld.labour_hours, 2) ELSE 0 END AS splh,
  ds.data_source
FROM daily_sales ds
LEFT JOIN labour_daily ld ON ld.location_id = ds.location_id AND ld.date = ds.day
LEFT JOIN cogs_daily cd ON cd.location_id = ds.location_id AND cd.date = ds.day;

GRANT SELECT ON mart_kpi_daily TO anon, authenticated;

-- ─── PART 5: Compat views needed by frontend ────
CREATE OR REPLACE VIEW public.labour_daily_unified AS
SELECT te.location_id, te.clock_in::date AS date,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric AS labour_cost,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric AS labour_hours,
  'demo'::text AS data_source
FROM time_entries te
LEFT JOIN employees e ON e.id = te.employee_id
GROUP BY te.location_id, te.clock_in::date;

GRANT SELECT ON labour_daily_unified TO anon, authenticated;

CREATE OR REPLACE VIEW public.budget_daily_unified AS
SELECT location_id, date AS day,
  budget_sales, budget_labour, budget_cogs,
  'demo'::text AS data_source
FROM budgets_daily;

GRANT SELECT ON budget_daily_unified TO anon, authenticated;

-- ─── PART 6: get_labour_kpis ────
-- Frontend calls with params: date_from, date_to, selected_location_id, p_data_source
CREATE FUNCTION public.get_labour_kpis(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_sales numeric; v_lc numeric; v_lh numeric; v_shifts numeric;
  v_headcount bigint; v_col_pct numeric; v_splh numeric;
  v_b_sales numeric; v_b_labour numeric;
  v_f_sales numeric; v_f_hours numeric;
  v_orders bigint;
BEGIN
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(labour_cost),0),
         COALESCE(SUM(labour_hours),0), COALESCE(SUM(orders_count),0)
  INTO v_sales, v_lc, v_lh, v_orders FROM mart_kpi_daily
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(planned_hours),0) INTO v_shifts FROM planned_shifts
  WHERE shift_date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COUNT(DISTINCT employee_id) INTO v_headcount FROM time_entries
  WHERE clock_in::date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  v_col_pct := CASE WHEN v_sales > 0 THEN ROUND(v_lc/v_sales*100,1) ELSE 0 END;
  v_splh := CASE WHEN v_lh > 0 THEN ROUND(v_sales/v_lh,2) ELSE 0 END;

  SELECT COALESCE(SUM(budget_sales),0), COALESCE(SUM(budget_labour),0)
  INTO v_b_sales, v_b_labour FROM budgets_daily
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(forecast_sales),0), COALESCE(SUM(planned_labor_hours),0)
  INTO v_f_sales, v_f_hours FROM forecast_daily_metrics
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  RETURN jsonb_build_object(
    'actual_sales', v_sales, 'forecast_sales', v_f_sales,
    'actual_labor_cost', v_lc, 'planned_labor_cost', v_b_labour,
    'actual_labor_hours', v_lh, 'planned_labor_hours', v_shifts,
    'actual_orders', v_orders, 'forecast_orders', 0,
    'actual_col_pct', v_col_pct,
    'planned_col_pct', CASE WHEN v_b_sales > 0 THEN ROUND(v_b_labour/v_b_sales*100,1) ELSE 0 END,
    'actual_splh', v_splh,
    'planned_splh', CASE WHEN v_f_hours > 0 THEN ROUND(v_f_sales/v_f_hours,2) ELSE 0 END,
    'actual_oplh', CASE WHEN v_lh > 0 THEN ROUND(v_orders::numeric/v_lh,2) ELSE 0 END,
    'planned_oplh', 0,
    'sales_delta_pct', 0, 'col_delta_pct', 0, 'hours_delta_pct', 0,
    'splh_delta_pct', 0, 'oplh_delta_pct', 0,
    'labor_cost_source', 'schedule', 'schedule_labor_cost', v_lc,
    'cost_per_cover', 0, 'cogs_total', 0, 'cogs_pct', 0,
    'prime_cost_pct', 0, 'prime_cost_amount', 0, 'avg_headcount', v_headcount
  );
END;$$;

-- ─── PART 7: get_labour_timeseries ────
CREATE FUNCTION public.get_labour_timeseries(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date),'[]'::jsonb) INTO v_result
  FROM (
    SELECT k.date,
      k.net_sales AS actual_sales, k.labour_cost AS actual_labor_cost,
      k.labour_hours AS actual_hours, k.orders_count AS actual_orders,
      k.col_pct AS actual_col_pct, k.splh AS actual_splh,
      CASE WHEN k.labour_hours > 0 THEN ROUND(k.orders_count::numeric/k.labour_hours,2) ELSE 0 END AS actual_oplh,
      COALESCE(b.budget_sales,0) AS forecast_sales,
      COALESCE(b.budget_labour,0) AS planned_labor_cost,
      0 AS planned_hours, 0 AS forecast_orders,
      CASE WHEN COALESCE(b.budget_sales,0) > 0 THEN ROUND(COALESCE(b.budget_labour,0)/b.budget_sales*100,1) ELSE 0 END AS planned_col_pct,
      0 AS planned_splh, 0 AS planned_oplh, 0 AS hours_variance, 0 AS hours_variance_pct
    FROM mart_kpi_daily k
    LEFT JOIN budgets_daily b ON b.location_id = k.location_id AND b.date = k.date
    WHERE k.date BETWEEN date_from AND date_to
      AND (selected_location_id IS NULL OR k.location_id = selected_location_id)
  ) d;
  RETURN v_result;
END;$$;

-- ─── PART 8: get_labour_locations_table ────
CREATE FUNCTION public.get_labour_locations_table(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb),'[]'::jsonb) INTO v_result
  FROM (
    SELECT l.id::text AS location_id, l.name AS location_name,
      COALESCE(SUM(k.net_sales),0) AS sales_actual,
      0 AS sales_projected, 0 AS sales_delta_pct,
      COALESCE(SUM(k.labour_cost),0) AS labor_cost_actual,
      0 AS labor_cost_projected,
      COALESCE(SUM(k.labour_hours),0) AS hours_actual,
      0 AS hours_projected,
      CASE WHEN SUM(k.net_sales) > 0 THEN ROUND(SUM(k.labour_cost)/SUM(k.net_sales)*100,1) ELSE 0 END AS col_actual_pct,
      0 AS col_projected_pct, 0 AS col_delta_pct,
      CASE WHEN SUM(k.labour_hours) > 0 THEN ROUND(SUM(k.net_sales)/SUM(k.labour_hours),2) ELSE 0 END AS splh_actual,
      0 AS splh_projected, 0 AS splh_delta_pct,
      0 AS oplh_actual, 0 AS oplh_projected, 0 AS oplh_delta_pct,
      false AS is_summary
    FROM locations l
    LEFT JOIN mart_kpi_daily k ON k.location_id = l.id AND k.date BETWEEN date_from AND date_to
    WHERE (selected_location_id IS NULL OR l.id = selected_location_id)
    GROUP BY l.id, l.name
  ) d;
  RETURN v_result;
END;$$;

-- ─── PART 9: get_sales_timeseries_unified ────
CREATE FUNCTION public.get_sales_timeseries_unified(
  p_org_id uuid, p_location_ids uuid[], p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_ds jsonb; v_kpis jsonb; v_daily jsonb;
  v_total_sales numeric; v_total_orders bigint;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(orders_count),0)
  INTO v_total_sales, v_total_orders
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  v_kpis := jsonb_build_object(
    'actual_sales', v_total_sales, 'forecast_sales', 0,
    'actual_orders', v_total_orders, 'forecast_orders', 0,
    'avg_check_actual', CASE WHEN v_total_orders > 0 THEN ROUND(v_total_sales / v_total_orders, 2) ELSE 0 END,
    'avg_check_forecast', 0
  );

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT s.day AS date, SUM(s.net_sales)::numeric AS actual_sales,
      SUM(s.orders_count)::bigint AS actual_orders,
      0::numeric AS forecast_sales, 0::bigint AS forecast_orders,
      0::numeric AS lower, 0::numeric AS upper
    FROM daily_sales s
    WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids) AND s.day BETWEEN p_from AND p_to
    GROUP BY s.day
  ) d;

  RETURN jsonb_build_object(
    'data_source', v_ds->>'data_source', 'mode', v_ds->>'mode',
    'reason', COALESCE(v_ds->>'reason', 'ok'),
    'last_synced_at', v_ds->>'last_synced_at',
    'kpis', v_kpis, 'hourly', '[]'::jsonb, 'daily', v_daily, 'busy_hours', '[]'::jsonb
  );
END;$$;

-- ─── PART 10: get_employee_revenue_scores (stub) ────
CREATE FUNCTION public.get_employee_revenue_scores(
  p_location_id uuid DEFAULT NULL,
  p_date_from date DEFAULT CURRENT_DATE - 30,
  p_date_to date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN '[]'::jsonb;
END;$$;

-- ─── PART 11: GRANTs ────
GRANT EXECUTE ON FUNCTION get_labour_kpis(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_timeseries(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_locations_table(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sales_timeseries_unified(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_employee_revenue_scores(uuid, date, date) TO anon, authenticated;

-- ─── Reload PostgREST schema cache ────
NOTIFY pgrst, 'reload schema';
