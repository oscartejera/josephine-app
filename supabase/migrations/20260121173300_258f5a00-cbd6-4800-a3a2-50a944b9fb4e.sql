-- =============================================
-- SEED DEMO LABOUR DATA RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_demo_labour_data(
  p_days int DEFAULT 30,
  p_locations int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_location RECORD;
  v_day date;
  v_base_sales numeric;
  v_sales_multiplier numeric;
  v_net_sales numeric;
  v_orders numeric;
  v_labor_hours numeric;
  v_labor_cost numeric;
  v_blended_rate numeric;
  v_forecast_sales numeric;
  v_forecast_orders numeric;
  v_planned_hours numeric;
  v_planned_cost numeric;
  v_dow int;
  v_locations_count int := 0;
  v_days_count int := 0;
BEGIN
  v_group_id := get_user_group_id();
  
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('seeded', false, 'error', 'No group found');
  END IF;

  -- Clear existing demo data first
  DELETE FROM pos_daily_metrics 
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  
  DELETE FROM forecast_daily_metrics 
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);

  -- Generate data for each location in the user's group
  FOR v_location IN 
    SELECT id, name FROM locations WHERE group_id = v_group_id
  LOOP
    v_locations_count := v_locations_count + 1;
    
    -- Set base sales based on location (simulate different venue sizes)
    v_base_sales := CASE 
      WHEN v_location.name ILIKE '%HQ%' THEN 18000 + random() * 5000
      WHEN v_location.name ILIKE '%Centro%' OR v_location.name ILIKE '%Central%' THEN 22000 + random() * 8000
      ELSE 8000 + random() * 12000
    END;
    
    -- Blended hourly rate varies by location
    v_blended_rate := 12 + random() * 8;
    
    -- Generate data for each day
    FOR v_day IN SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::interval, 
      CURRENT_DATE - interval '1 day', 
      '1 day'
    )::date
    LOOP
      v_dow := EXTRACT(DOW FROM v_day);
      
      -- Sales multiplier based on day of week
      v_sales_multiplier := CASE v_dow
        WHEN 5 THEN 1.35 + random() * 0.15
        WHEN 6 THEN 1.45 + random() * 0.20
        WHEN 0 THEN 1.10 + random() * 0.15
        WHEN 1 THEN 0.75 + random() * 0.10
        ELSE 0.90 + random() * 0.15
      END;
      
      -- Calculate actual metrics
      v_net_sales := ROUND((v_base_sales * v_sales_multiplier * (0.85 + random() * 0.30))::numeric, 2);
      v_orders := ROUND(v_net_sales / (25 + random() * 15));
      v_labor_hours := ROUND((v_orders / (4 + random() * 3))::numeric, 1);
      v_labor_cost := ROUND((v_labor_hours * v_blended_rate * (0.95 + random() * 0.10))::numeric, 2);
      
      -- Forecast with variations
      v_forecast_sales := ROUND((v_net_sales * (0.88 + random() * 0.24))::numeric, 2);
      v_forecast_orders := ROUND(v_orders * (0.90 + random() * 0.20));
      v_planned_hours := ROUND((v_labor_hours * (0.85 + random() * 0.30))::numeric, 1);
      v_planned_cost := ROUND((v_planned_hours * v_blended_rate)::numeric, 2);
      
      INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
      VALUES (v_day, v_location.id, v_net_sales, v_orders, v_labor_hours, v_labor_cost)
      ON CONFLICT (date, location_id) DO UPDATE SET
        net_sales = EXCLUDED.net_sales,
        orders = EXCLUDED.orders,
        labor_hours = EXCLUDED.labor_hours,
        labor_cost = EXCLUDED.labor_cost;
      
      INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders, planned_labor_hours, planned_labor_cost)
      VALUES (v_day, v_location.id, v_forecast_sales, v_forecast_orders, v_planned_hours, v_planned_cost)
      ON CONFLICT (date, location_id) DO UPDATE SET
        forecast_sales = EXCLUDED.forecast_sales,
        forecast_orders = EXCLUDED.forecast_orders,
        planned_labor_hours = EXCLUDED.planned_labor_hours,
        planned_labor_cost = EXCLUDED.planned_labor_cost;
      
      v_days_count := v_days_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'seeded', true,
    'locations', v_locations_count,
    'days', v_days_count / GREATEST(v_locations_count, 1)
  );
END;
$$;

-- =============================================
-- GET LABOUR KPIs RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(SUM(p.orders), 0),
    COALESCE(SUM(f.forecast_orders), 0)
  INTO v_actual_sales, v_forecast_sales, v_actual_labor_cost, v_planned_labor_cost, 
       v_actual_hours, v_planned_hours, v_actual_orders, v_forecast_orders
  FROM pos_daily_metrics p
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
$$;