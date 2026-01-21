-- =============================================
-- GET LABOUR LOCATIONS TABLE RPC (using PL/pgSQL for UNION support)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_labour_locations_table(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  location_id uuid,
  location_name text,
  sales_actual numeric,
  sales_projected numeric,
  sales_delta_pct numeric,
  col_actual_pct numeric,
  col_projected_pct numeric,
  col_delta_pct numeric,
  splh_actual numeric,
  splh_projected numeric,
  splh_delta_pct numeric,
  oplh_actual numeric,
  oplh_projected numeric,
  oplh_delta_pct numeric,
  labor_cost_actual numeric,
  labor_cost_projected numeric,
  hours_actual numeric,
  hours_projected numeric,
  is_summary boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
      COALESCE(SUM(p.orders), 0) as sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) as sum_forecast_orders
    FROM locations l
    LEFT JOIN pos_daily_metrics p ON p.location_id = l.id AND p.date >= date_from AND p.date <= date_to
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
$$;