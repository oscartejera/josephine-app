-- =============================================
-- CREATE UNIFIED SALES VIEW
-- =============================================

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_date_location 
  ON pos_daily_metrics(date, location_id);
CREATE INDEX IF NOT EXISTS idx_pos_daily_finance_date_location 
  ON pos_daily_finance(date, location_id);

-- Create the unified view combining both tables
CREATE OR REPLACE VIEW sales_daily_unified AS
SELECT 
  COALESCE(pdm.date, pdf.date) as date,
  COALESCE(pdm.location_id, pdf.location_id) as location_id,
  -- Actual Sales (prefer pos_daily_metrics, fallback to pos_daily_finance)
  COALESCE(pdm.net_sales, pdf.net_sales, 0) as net_sales,
  COALESCE(pdm.orders, pdf.orders_count, 0) as orders_count,
  -- Labor data (only in pos_daily_metrics)
  pdm.labor_cost,
  pdm.labor_hours,
  -- Cash breakdown (only in pos_daily_finance)
  pdf.gross_sales,
  pdf.payments_cash,
  pdf.payments_card,
  pdf.payments_other,
  pdf.refunds_amount,
  pdf.refunds_count,
  pdf.discounts_amount,
  pdf.comps_amount,
  pdf.voids_amount
FROM pos_daily_metrics pdm
FULL OUTER JOIN pos_daily_finance pdf 
  ON pdm.date = pdf.date 
  AND pdm.location_id = pdf.location_id;

-- =============================================
-- UPDATE LABOUR RPCs TO USE UNIFIED VIEW
-- =============================================

-- Update get_labour_kpis to use sales_daily_unified
CREATE OR REPLACE FUNCTION public.get_labour_kpis(date_from date, date_to date, selected_location_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_group_id uuid;
  v_actual_sales numeric;
  v_forecast_sales numeric;
  v_actual_labor_cost numeric;
  v_planned_labor_cost numeric;
  v_actual_hours numeric;
  v_planned_hours numeric;
  v_actual_orders numeric;
  v_forecast_orders numeric;
BEGIN
  v_group_id := get_user_group_id();
  
  SELECT
    COALESCE(SUM(p.net_sales), 0),
    COALESCE(SUM(f.forecast_sales), 0),
    COALESCE(SUM(p.labor_cost), 0),
    COALESCE(SUM(f.planned_labor_cost), 0),
    COALESCE(SUM(p.labor_hours), 0),
    COALESCE(SUM(f.planned_labor_hours), 0),
    COALESCE(SUM(p.orders_count), 0),
    COALESCE(SUM(f.forecast_orders), 0)
  INTO v_actual_sales, v_forecast_sales, v_actual_labor_cost, v_planned_labor_cost, 
       v_actual_hours, v_planned_hours, v_actual_orders, v_forecast_orders
  FROM sales_daily_unified p
  FULL OUTER JOIN forecast_daily_metrics f 
    ON p.date = f.date AND p.location_id = f.location_id
  JOIN locations l ON COALESCE(p.location_id, f.location_id) = l.id
  WHERE l.group_id = v_group_id
    AND COALESCE(p.date, f.date) >= date_from
    AND COALESCE(p.date, f.date) <= date_to
    AND (selected_location_id IS NULL OR COALESCE(p.location_id, f.location_id) = selected_location_id)
    AND COALESCE(p.location_id, f.location_id) IN (SELECT get_accessible_location_ids());

  v_result := jsonb_build_object(
    'actual_sales', v_actual_sales,
    'forecast_sales', v_forecast_sales,
    'actual_labor_cost', v_actual_labor_cost,
    'planned_labor_cost', v_planned_labor_cost,
    'actual_labor_hours', v_actual_hours,
    'planned_labor_hours', v_planned_hours,
    'actual_orders', v_actual_orders,
    'forecast_orders', v_forecast_orders,
    'actual_col_pct', CASE WHEN v_actual_sales > 0 THEN ROUND((v_actual_labor_cost / v_actual_sales * 100)::numeric, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND((v_planned_labor_cost / v_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'actual_splh', CASE WHEN v_actual_hours > 0 THEN ROUND((v_actual_sales / v_actual_hours)::numeric, 2) ELSE 0 END,
    'planned_splh', CASE WHEN v_planned_hours > 0 THEN ROUND((v_forecast_sales / v_planned_hours)::numeric, 2) ELSE 0 END,
    'actual_oplh', CASE WHEN v_actual_hours > 0 THEN ROUND((v_actual_orders / v_actual_hours)::numeric, 2) ELSE 0 END,
    'planned_oplh', CASE WHEN v_planned_hours > 0 THEN ROUND((v_forecast_orders / v_planned_hours)::numeric, 2) ELSE 0 END,
    'sales_delta_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND(((v_actual_sales - v_forecast_sales) / v_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'col_delta_pct', CASE 
      WHEN v_forecast_sales > 0 AND v_actual_sales > 0 AND v_planned_labor_cost > 0 THEN 
        ROUND((((v_actual_labor_cost / v_actual_sales) - (v_planned_labor_cost / v_forecast_sales)) / (v_planned_labor_cost / v_forecast_sales) * 100)::numeric, 2)
      ELSE 0 
    END,
    'hours_delta_pct', CASE WHEN v_planned_hours > 0 THEN ROUND(((v_actual_hours - v_planned_hours) / v_planned_hours * 100)::numeric, 2) ELSE 0 END,
    'splh_delta_pct', CASE 
      WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_sales > 0 THEN 
        ROUND((((v_actual_sales / v_actual_hours) - (v_forecast_sales / v_planned_hours)) / (v_forecast_sales / v_planned_hours) * 100)::numeric, 2)
      ELSE 0 
    END,
    'oplh_delta_pct', CASE 
      WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_orders > 0 THEN 
        ROUND((((v_actual_orders / v_actual_hours) - (v_forecast_orders / v_planned_hours)) / (v_forecast_orders / v_planned_hours) * 100)::numeric, 2)
      ELSE 0 
    END
  );
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;

-- Update get_labour_timeseries to use sales_daily_unified
CREATE OR REPLACE FUNCTION public.get_labour_timeseries(date_from date, date_to date, selected_location_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(date date, actual_sales numeric, forecast_sales numeric, actual_labor_cost numeric, planned_labor_cost numeric, actual_hours numeric, planned_hours numeric, actual_orders numeric, forecast_orders numeric, actual_col_pct numeric, planned_col_pct numeric, actual_splh numeric, planned_splh numeric, actual_oplh numeric, planned_oplh numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH daily_agg AS (
    SELECT
      COALESCE(p.date, f.date) as agg_date,
      COALESCE(SUM(p.net_sales), 0) as sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) as sum_forecast_sales,
      COALESCE(SUM(p.labor_cost), 0) as sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) as sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) as sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) as sum_planned_hours,
      COALESCE(SUM(p.orders_count), 0) as sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) as sum_forecast_orders
    FROM sales_daily_unified p
    FULL OUTER JOIN forecast_daily_metrics f 
      ON p.date = f.date AND p.location_id = f.location_id
    JOIN locations l ON COALESCE(p.location_id, f.location_id) = l.id
    WHERE l.group_id = get_user_group_id()
      AND COALESCE(p.date, f.date) >= date_from
      AND COALESCE(p.date, f.date) <= date_to
      AND (selected_location_id IS NULL OR COALESCE(p.location_id, f.location_id) = selected_location_id)
      AND COALESCE(p.location_id, f.location_id) IN (SELECT get_accessible_location_ids())
    GROUP BY COALESCE(p.date, f.date)
    ORDER BY COALESCE(p.date, f.date)
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
  FROM daily_agg;
$function$;

-- Update get_labour_locations_table to use sales_daily_unified
CREATE OR REPLACE FUNCTION public.get_labour_locations_table(date_from date, date_to date, selected_location_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(location_id uuid, location_name text, sales_actual numeric, sales_projected numeric, sales_delta_pct numeric, col_actual_pct numeric, col_projected_pct numeric, col_delta_pct numeric, splh_actual numeric, splh_projected numeric, splh_delta_pct numeric, oplh_actual numeric, oplh_projected numeric, oplh_delta_pct numeric, labor_cost_actual numeric, labor_cost_projected numeric, hours_actual numeric, hours_projected numeric, is_summary boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH location_agg AS (
    SELECT
      l.id as loc_id,
      l.name as loc_name,
      COALESCE(SUM(p.net_sales), 0) as sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) as sum_forecast,
      COALESCE(SUM(p.labor_cost), 0) as sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) as sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) as sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) as sum_planned_hours,
      COALESCE(SUM(p.orders_count), 0) as sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) as sum_forecast_orders
    FROM locations l
    LEFT JOIN sales_daily_unified p ON p.location_id = l.id AND p.date >= date_from AND p.date <= date_to
    LEFT JOIN forecast_daily_metrics f ON f.location_id = l.id AND f.date >= date_from AND f.date <= date_to
    WHERE l.group_id = get_user_group_id()
      AND (selected_location_id IS NULL OR l.id = selected_location_id)
      AND l.id IN (SELECT get_accessible_location_ids())
    GROUP BY l.id, l.name
    HAVING COALESCE(SUM(p.net_sales), 0) > 0 OR COALESCE(SUM(f.forecast_sales), 0) > 0
  ),
  with_calcs AS (
    SELECT
      loc_id,
      loc_name,
      ROUND(sum_sales::numeric, 2) as s_actual,
      ROUND(sum_forecast::numeric, 2) as s_projected,
      CASE WHEN sum_forecast > 0 THEN ROUND(((sum_sales - sum_forecast) / sum_forecast * 100)::numeric, 2) ELSE 0 END as s_delta,
      CASE WHEN sum_sales > 0 THEN ROUND((sum_labor_cost / sum_sales * 100)::numeric, 2) ELSE 0 END as c_actual,
      CASE WHEN sum_forecast > 0 THEN ROUND((sum_planned_cost / sum_forecast * 100)::numeric, 2) ELSE 0 END as c_projected,
      CASE WHEN sum_hours > 0 THEN ROUND((sum_sales / sum_hours)::numeric, 2) ELSE 0 END as spl_act,
      CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast / sum_planned_hours)::numeric, 2) ELSE 0 END as spl_proj,
      CASE WHEN sum_hours > 0 THEN ROUND((sum_orders / sum_hours)::numeric, 2) ELSE 0 END as opl_act,
      CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast_orders / sum_planned_hours)::numeric, 2) ELSE 0 END as opl_proj,
      ROUND(sum_labor_cost::numeric, 2) as lc_act,
      ROUND(sum_planned_cost::numeric, 2) as lc_proj,
      ROUND(sum_hours::numeric, 1) as h_act,
      ROUND(sum_planned_hours::numeric, 1) as h_proj,
      sum_sales as raw_s,
      sum_forecast as raw_f,
      sum_labor_cost as raw_lc,
      sum_planned_cost as raw_pc,
      sum_hours as raw_h,
      sum_planned_hours as raw_ph,
      sum_orders as raw_o,
      sum_forecast_orders as raw_fo
    FROM location_agg
  ),
  ordered_locs AS (
    SELECT
      loc_id,
      loc_name,
      s_actual,
      s_projected,
      s_delta,
      c_actual,
      c_projected,
      CASE WHEN c_projected > 0 THEN ROUND(((c_actual - c_projected) / c_projected * 100)::numeric, 2) ELSE 0 END as c_delta,
      spl_act,
      spl_proj,
      CASE WHEN spl_proj > 0 THEN ROUND(((spl_act - spl_proj) / spl_proj * 100)::numeric, 2) ELSE 0 END as spl_delta,
      opl_act,
      opl_proj,
      CASE WHEN opl_proj > 0 THEN ROUND(((opl_act - opl_proj) / opl_proj * 100)::numeric, 2) ELSE 0 END as opl_delta,
      lc_act,
      lc_proj,
      h_act,
      h_proj,
      false as is_sum,
      raw_s, raw_f, raw_lc, raw_pc, raw_h, raw_ph, raw_o, raw_fo
    FROM with_calcs
    ORDER BY loc_name
  ),
  totals AS (
    SELECT
      SUM(raw_s) as tot_s,
      SUM(raw_f) as tot_f,
      SUM(raw_lc) as tot_lc,
      SUM(raw_pc) as tot_pc,
      SUM(raw_h) as tot_h,
      SUM(raw_ph) as tot_ph,
      SUM(raw_o) as tot_o,
      SUM(raw_fo) as tot_fo
    FROM ordered_locs
  ),
  all_rows AS (
    SELECT loc_id, loc_name, s_actual, s_projected, s_delta, c_actual, c_projected, c_delta, 
           spl_act, spl_proj, spl_delta, opl_act, opl_proj, opl_delta, lc_act, lc_proj, h_act, h_proj, is_sum, 0 as sort_order
    FROM ordered_locs

    UNION ALL

    SELECT
      NULL::uuid,
      'Total / Average'::text,
      ROUND(tot_s::numeric, 2),
      ROUND(tot_f::numeric, 2),
      CASE WHEN tot_f > 0 THEN ROUND(((tot_s - tot_f) / tot_f * 100)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_s > 0 THEN ROUND((tot_lc / tot_s * 100)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_f > 0 THEN ROUND((tot_pc / tot_f * 100)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_f > 0 AND tot_s > 0 AND tot_pc > 0 THEN 
        ROUND((((tot_lc / tot_s) - (tot_pc / tot_f)) / (tot_pc / tot_f) * 100)::numeric, 2) 
      ELSE 0 END,
      CASE WHEN tot_h > 0 THEN ROUND((tot_s / tot_h)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_ph > 0 THEN ROUND((tot_f / tot_ph)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_ph > 0 AND tot_h > 0 AND tot_f > 0 THEN 
        ROUND((((tot_s / tot_h) - (tot_f / tot_ph)) / (tot_f / tot_ph) * 100)::numeric, 2) 
      ELSE 0 END,
      CASE WHEN tot_h > 0 THEN ROUND((tot_o / tot_h)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_ph > 0 THEN ROUND((tot_fo / tot_ph)::numeric, 2) ELSE 0 END,
      CASE WHEN tot_ph > 0 AND tot_h > 0 AND tot_fo > 0 THEN 
        ROUND((((tot_o / tot_h) - (tot_fo / tot_ph)) / (tot_fo / tot_ph) * 100)::numeric, 2) 
      ELSE 0 END,
      ROUND(tot_lc::numeric, 2),
      ROUND(tot_pc::numeric, 2),
      ROUND(tot_h::numeric, 1),
      ROUND(tot_ph::numeric, 1),
      true,
      1
    FROM totals
  )
  SELECT loc_id, loc_name, s_actual, s_projected, s_delta, c_actual, c_projected, c_delta, 
         spl_act, spl_proj, spl_delta, opl_act, opl_proj, opl_delta, lc_act, lc_proj, h_act, h_proj, is_sum
  FROM all_rows
  ORDER BY sort_order, loc_name;
END;
$function$;