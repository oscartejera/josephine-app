-- ==========================================================================
-- Comprehensive fix: allow POS and simulated data to coexist
-- When POS is connected+synced, frontend shows 'pos' data.
-- When not connected, shows 'simulated' data. Neither is deleted.
-- ==========================================================================

-- =============================================
-- 0) ADD MISSING RLS POLICY for integration_sync_runs
--    RLS was enabled but no SELECT policy existed, blocking
--    all frontend reads via anon/authenticated keys.
-- =============================================

CREATE POLICY "Authenticated users can view sync runs"
  ON integration_sync_runs FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 1) FIX UNIQUE CONSTRAINTS to include data_source
-- =============================================

ALTER TABLE pos_daily_finance DROP CONSTRAINT IF EXISTS pos_daily_finance_date_location_id_key;
ALTER TABLE pos_daily_finance ADD CONSTRAINT pos_daily_finance_date_location_source_key
  UNIQUE (date, location_id, data_source);

ALTER TABLE product_sales_daily DROP CONSTRAINT IF EXISTS product_sales_daily_date_location_id_product_id_key;
ALTER TABLE product_sales_daily ADD CONSTRAINT product_sales_daily_date_loc_prod_source_key
  UNIQUE (date, location_id, product_id, data_source);

ALTER TABLE pos_daily_metrics DROP CONSTRAINT IF EXISTS pos_daily_metrics_date_location_id_key;
ALTER TABLE pos_daily_metrics ADD CONSTRAINT pos_daily_metrics_date_location_source_key
  UNIQUE (date, location_id, data_source);


-- =============================================
-- 2) UPDATE sales_daily_unified VIEW to include data_source
--    and JOIN on data_source to prevent cross-contamination
-- =============================================

DROP VIEW IF EXISTS sales_daily_unified;
CREATE VIEW sales_daily_unified AS
SELECT
  COALESCE(pdm.date, pdf.date) AS date,
  COALESCE(pdm.location_id, pdf.location_id) AS location_id,
  COALESCE(pdm.data_source, pdf.data_source, 'simulated') AS data_source,
  COALESCE(pdm.net_sales, pdf.net_sales, 0) AS net_sales,
  COALESCE(pdm.orders, pdf.orders_count, 0) AS orders_count,
  pdm.labor_cost,
  pdm.labor_hours,
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
  AND pdm.location_id = pdf.location_id
  AND pdm.data_source = pdf.data_source;

GRANT SELECT ON sales_daily_unified TO authenticated;


-- =============================================
-- 3) UPDATE simulate_today_partial_data() to use new constraints
--    and explicitly set data_source = 'simulated'
-- =============================================

CREATE OR REPLACE FUNCTION public.simulate_today_partial_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location RECORD;
  v_progress numeric;
  v_forecast RECORD;
  v_net_sales numeric;
BEGIN
  -- Calculate what fraction of the business day has passed (10am-11pm = 13 hours)
  v_progress := GREATEST(0, LEAST(1,
    (EXTRACT(HOUR FROM NOW()) - 10.0) / 13.0
  ));

  -- If before opening (10am), set small initial values
  IF v_progress <= 0 THEN
    v_progress := 0.02;
  END IF;

  FOR v_location IN SELECT id, name FROM locations LOOP
    SELECT * INTO v_forecast
    FROM forecast_daily_metrics
    WHERE date = CURRENT_DATE AND location_id = v_location.id
    LIMIT 1;

    IF v_forecast IS NULL THEN
      CONTINUE;
    END IF;

    v_net_sales := ROUND((v_forecast.forecast_sales * v_progress * (0.92 + random() * 0.16))::numeric, 2);

    -- 1) pos_daily_finance (simulated only)
    INSERT INTO pos_daily_finance (date, location_id, data_source, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount)
    VALUES (
      CURRENT_DATE, v_location.id, 'simulated',
      v_net_sales,
      ROUND((v_net_sales * 1.05)::numeric, 2),
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_net_sales * 0.25)::numeric, 2),
      ROUND((v_net_sales * 0.70)::numeric, 2),
      ROUND((v_net_sales * 0.05)::numeric, 2),
      ROUND((v_net_sales * 0.005)::numeric, 2),
      1,
      ROUND((v_net_sales * 0.03)::numeric, 2),
      ROUND((v_net_sales * 0.01)::numeric, 2),
      ROUND((v_net_sales * 0.008)::numeric, 2)
    )
    ON CONFLICT (date, location_id, data_source) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      gross_sales = EXCLUDED.gross_sales,
      orders_count = EXCLUDED.orders_count,
      payments_cash = EXCLUDED.payments_cash,
      payments_card = EXCLUDED.payments_card,
      payments_other = EXCLUDED.payments_other,
      refunds_amount = EXCLUDED.refunds_amount,
      discounts_amount = EXCLUDED.discounts_amount,
      comps_amount = EXCLUDED.comps_amount,
      voids_amount = EXCLUDED.voids_amount;

    -- 2) pos_daily_metrics (simulated only)
    INSERT INTO pos_daily_metrics (date, location_id, data_source, net_sales, orders, labor_hours, labor_cost)
    VALUES (
      CURRENT_DATE, v_location.id, 'simulated',
      v_net_sales,
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_forecast.planned_labor_hours * v_progress * (0.92 + random() * 0.12))::numeric, 1),
      ROUND((v_forecast.planned_labor_cost * v_progress * (0.92 + random() * 0.12))::numeric, 2)
    )
    ON CONFLICT (date, location_id, data_source) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      orders = EXCLUDED.orders,
      labor_hours = EXCLUDED.labor_hours,
      labor_cost = EXCLUDED.labor_cost;

    -- 3) labour_daily (no data_source column, unchanged)
    INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_forecast.planned_labor_cost * v_progress * (0.92 + random() * 0.12))::numeric, 2),
      ROUND((v_forecast.planned_labor_hours * v_progress * (0.92 + random() * 0.12))::numeric, 1)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      labour_cost = EXCLUDED.labour_cost,
      labour_hours = EXCLUDED.labour_hours;

    -- 4) cogs_daily
    INSERT INTO cogs_daily (date, location_id, cogs_amount)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_net_sales * 0.28)::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      cogs_amount = EXCLUDED.cogs_amount;

    -- 5) cash_counts_daily
    INSERT INTO cash_counts_daily (date, location_id, cash_counted)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_net_sales * 0.25 * (0.995 + random() * 0.01))::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      cash_counted = EXCLUDED.cash_counted;

  END LOOP;
END;
$$;


-- =============================================
-- 4) UPDATE get_labour_timeseries with p_data_source parameter
-- =============================================

CREATE OR REPLACE FUNCTION public.get_labour_timeseries(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL::uuid,
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE(
  date date, actual_sales numeric, forecast_sales numeric,
  actual_labor_cost numeric, planned_labor_cost numeric,
  actual_hours numeric, planned_hours numeric,
  actual_orders numeric, forecast_orders numeric,
  actual_col_pct numeric, planned_col_pct numeric,
  actual_splh numeric, planned_splh numeric,
  actual_oplh numeric, planned_oplh numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH date_range AS (
    SELECT d::date AS the_date
    FROM generate_series(date_from, date_to, '1 day'::interval) d
  ),
  daily_agg AS (
    SELECT
      dr.the_date AS agg_date,
      COALESCE(SUM(p.net_sales), 0) AS sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) AS sum_forecast_sales,
      COALESCE(SUM(p.labor_cost), 0) AS sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) AS sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) AS sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) AS sum_planned_hours,
      COALESCE(SUM(p.orders_count), 0) AS sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) AS sum_forecast_orders
    FROM date_range dr
    LEFT JOIN sales_daily_unified p
      ON p.date = dr.the_date
      AND p.data_source = p_data_source
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
    LEFT JOIN forecast_daily_metrics f
      ON f.date = dr.the_date
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY dr.the_date
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
  FROM daily_agg
  ORDER BY agg_date;
$function$;


-- =============================================
-- 5) UPDATE get_labour_kpis with p_data_source parameter
-- =============================================

CREATE OR REPLACE FUNCTION public.get_labour_kpis(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL::uuid,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
  FROM generate_series(date_from, date_to, '1 day'::interval) dr(d)
  LEFT JOIN sales_daily_unified p
    ON p.date = dr.d::date
    AND p.data_source = p_data_source
    AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
    AND p.location_id IN (SELECT get_accessible_location_ids())
  LEFT JOIN forecast_daily_metrics f
    ON f.date = dr.d::date
    AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
    AND f.location_id IN (SELECT get_accessible_location_ids());

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


-- =============================================
-- 6) UPDATE get_labour_locations_table with p_data_source
-- =============================================

CREATE OR REPLACE FUNCTION public.get_labour_locations_table(
  date_from date, date_to date,
  selected_location_id uuid DEFAULT NULL::uuid,
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE(
  location_id uuid, location_name text, sales_actual numeric, sales_projected numeric,
  sales_delta_pct numeric, col_actual_pct numeric, col_projected_pct numeric,
  col_delta_pct numeric, splh_actual numeric, splh_projected numeric,
  splh_delta_pct numeric, oplh_actual numeric, oplh_projected numeric,
  oplh_delta_pct numeric, labor_cost_actual numeric, labor_cost_projected numeric,
  hours_actual numeric, hours_projected numeric, is_summary boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_group_id uuid;
BEGIN
  v_group_id := get_user_group_id();

  RETURN QUERY
  WITH accessible AS (
    SELECT loc.id, loc.name
    FROM locations loc
    WHERE loc.group_id = v_group_id
      AND loc.active
      AND loc.id IN (SELECT get_accessible_location_ids())
      AND (selected_location_id IS NULL OR loc.id = selected_location_id)
  ),
  loc_agg AS (
    SELECT
      a.id AS lid,
      a.name AS lname,
      COALESCE(SUM(p.net_sales), 0) AS a_sales,
      COALESCE(SUM(f.forecast_sales), 0) AS p_sales,
      COALESCE(SUM(p.labor_cost), 0) AS a_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) AS p_cost,
      COALESCE(SUM(p.labor_hours), 0) AS a_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) AS p_hours,
      COALESCE(SUM(p.orders_count), 0) AS a_orders,
      COALESCE(SUM(f.forecast_orders), 0) AS p_orders
    FROM accessible a
    CROSS JOIN generate_series(date_from, date_to, '1 day'::interval) dr(d)
    LEFT JOIN sales_daily_unified p
      ON p.date = dr.d::date AND p.location_id = a.id AND p.data_source = p_data_source
    LEFT JOIN forecast_daily_metrics f
      ON f.date = dr.d::date AND f.location_id = a.id
    GROUP BY a.id, a.name
  )
  -- Per-location rows
  SELECT
    lid, lname,
    ROUND(a_sales::numeric, 2), ROUND(p_sales::numeric, 2),
    CASE WHEN p_sales > 0 THEN ROUND(((a_sales - p_sales) / p_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN a_sales > 0 THEN ROUND((a_cost / a_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN p_sales > 0 THEN ROUND((p_cost / p_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN p_sales > 0 AND a_sales > 0 AND p_cost > 0 THEN
      ROUND((((a_cost / a_sales) - (p_cost / p_sales)) / (p_cost / p_sales) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN a_hours > 0 THEN ROUND((a_sales / a_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN p_hours > 0 THEN ROUND((p_sales / p_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN p_hours > 0 AND a_hours > 0 AND p_sales > 0 THEN
      ROUND((((a_sales / a_hours) - (p_sales / p_hours)) / (p_sales / p_hours) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN a_hours > 0 THEN ROUND((a_orders / a_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN p_hours > 0 THEN ROUND((p_orders / p_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN p_hours > 0 AND a_hours > 0 AND p_orders > 0 THEN
      ROUND((((a_orders / a_hours) - (p_orders / p_hours)) / (p_orders / p_hours) * 100)::numeric, 2) ELSE 0 END,
    ROUND(a_cost::numeric, 2), ROUND(p_cost::numeric, 2),
    ROUND(a_hours::numeric, 1), ROUND(p_hours::numeric, 1),
    false
  FROM loc_agg

  UNION ALL

  -- Summary row (totals)
  SELECT
    NULL, 'Total',
    ROUND(SUM(a_sales)::numeric, 2), ROUND(SUM(p_sales)::numeric, 2),
    CASE WHEN SUM(p_sales) > 0 THEN ROUND(((SUM(a_sales) - SUM(p_sales)) / SUM(p_sales) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(a_sales) > 0 THEN ROUND((SUM(a_cost) / SUM(a_sales) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_sales) > 0 THEN ROUND((SUM(p_cost) / SUM(p_sales) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_sales) > 0 AND SUM(a_sales) > 0 AND SUM(p_cost) > 0 THEN
      ROUND((((SUM(a_cost) / SUM(a_sales)) - (SUM(p_cost) / SUM(p_sales))) / (SUM(p_cost) / SUM(p_sales)) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(a_hours) > 0 THEN ROUND((SUM(a_sales) / SUM(a_hours))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_hours) > 0 THEN ROUND((SUM(p_sales) / SUM(p_hours))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_hours) > 0 AND SUM(a_hours) > 0 AND SUM(p_sales) > 0 THEN
      ROUND((((SUM(a_sales) / SUM(a_hours)) - (SUM(p_sales) / SUM(p_hours))) / (SUM(p_sales) / SUM(p_hours)) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(a_hours) > 0 THEN ROUND((SUM(a_orders) / SUM(a_hours))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_hours) > 0 THEN ROUND((SUM(p_orders) / SUM(p_hours))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(p_hours) > 0 AND SUM(a_hours) > 0 AND SUM(p_orders) > 0 THEN
      ROUND((((SUM(a_orders) / SUM(a_hours)) - (SUM(p_orders) / SUM(p_hours))) / (SUM(p_orders) / SUM(p_hours)) * 100)::numeric, 2) ELSE 0 END,
    ROUND(SUM(a_cost)::numeric, 2), ROUND(SUM(p_cost)::numeric, 2),
    ROUND(SUM(a_hours)::numeric, 1), ROUND(SUM(p_hours)::numeric, 1),
    true
  FROM loc_agg;
END;
$function$;


-- =============================================
-- 7) UPDATE menu_engineering_summary with p_data_source
-- =============================================

CREATE OR REPLACE FUNCTION public.menu_engineering_summary(
  p_date_from date, p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE(
  product_id uuid, name text, category text, units numeric, sales numeric,
  cogs numeric, profit_eur numeric, margin_pct numeric, profit_per_sale numeric,
  popularity_share numeric, sales_share numeric, classification text,
  action_tag text, badges text[], total_units_period numeric,
  total_sales_period numeric, pop_threshold numeric, margin_threshold numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
  v_total_units numeric;
  v_total_sales numeric;
  v_pop_threshold numeric;
  v_margin_threshold numeric;
BEGIN
  v_group_id := get_user_group_id();

  -- Get totals
  SELECT COALESCE(SUM(psd.units_sold), 0), COALESCE(SUM(psd.net_sales), 0)
  INTO v_total_units, v_total_sales
  FROM product_sales_daily psd
  JOIN locations l ON l.id = psd.location_id
  WHERE l.group_id = v_group_id
    AND psd.date >= p_date_from AND psd.date <= p_date_to
    AND psd.data_source = p_data_source
    AND (p_location_id IS NULL OR psd.location_id = p_location_id)
    AND psd.location_id IN (SELECT get_accessible_location_ids());

  IF v_total_units = 0 THEN RETURN; END IF;

  -- Calculate thresholds (60th percentile)
  WITH aggregated AS (
    SELECT
      psd.product_id,
      SUM(psd.units_sold) AS agg_units,
      SUM(psd.net_sales) AS agg_sales,
      SUM(psd.cogs) AS agg_cogs
    FROM product_sales_daily psd
    JOIN locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from AND psd.date <= p_date_to
      AND psd.data_source = p_data_source
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
      AND psd.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY psd.product_id
    HAVING SUM(psd.units_sold) > 0
  ),
  with_margin AS (
    SELECT
      agg_units,
      CASE WHEN agg_sales > 0 THEN ((agg_sales - agg_cogs) / agg_sales) * 100 ELSE 0 END AS margin
    FROM aggregated
  )
  SELECT
    percentile_cont(0.6) WITHIN GROUP (ORDER BY agg_units),
    percentile_cont(0.6) WITHIN GROUP (ORDER BY margin)
  INTO v_pop_threshold, v_margin_threshold
  FROM with_margin;

  RETURN QUERY
  WITH aggregated AS (
    SELECT
      psd.product_id AS pid,
      p.name AS pname,
      COALESCE(p.category, 'Other') AS pcategory,
      SUM(psd.units_sold) AS agg_units,
      SUM(psd.net_sales) AS agg_sales,
      SUM(psd.cogs) AS agg_cogs
    FROM product_sales_daily psd
    JOIN products p ON p.id = psd.product_id
    JOIN locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from AND psd.date <= p_date_to
      AND psd.data_source = p_data_source
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
      AND psd.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY psd.product_id, p.name, p.category
    HAVING SUM(psd.units_sold) > 0
  ),
  calculated AS (
    SELECT
      pid, pname, pcategory, agg_units,
      ROUND(agg_sales::numeric, 2) AS agg_sales,
      ROUND(agg_cogs::numeric, 2) AS agg_cogs,
      ROUND((agg_sales - agg_cogs)::numeric, 2) AS profit,
      CASE WHEN agg_sales > 0 THEN ROUND(((agg_sales - agg_cogs) / agg_sales * 100)::numeric, 2) ELSE 0 END AS margin,
      CASE WHEN agg_units > 0 THEN ROUND(((agg_sales - agg_cogs) / agg_units)::numeric, 2) ELSE 0 END AS profit_per,
      CASE WHEN v_total_units > 0 THEN ROUND((agg_units / v_total_units * 100)::numeric, 4) ELSE 0 END AS pop_share,
      CASE WHEN v_total_sales > 0 THEN ROUND((agg_sales / v_total_sales * 100)::numeric, 4) ELSE 0 END AS sales_share_val
    FROM aggregated
  ),
  classified AS (
    SELECT *,
      CASE
        WHEN agg_units >= v_pop_threshold AND margin >= v_margin_threshold THEN 'star'
        WHEN agg_units >= v_pop_threshold AND margin < v_margin_threshold THEN 'plow_horse'
        WHEN agg_units < v_pop_threshold AND margin >= v_margin_threshold THEN 'puzzle'
        ELSE 'dog'
      END AS class,
      CASE
        WHEN agg_units >= v_pop_threshold AND margin >= v_margin_threshold THEN 'Mantener'
        WHEN agg_units >= v_pop_threshold AND margin < v_margin_threshold THEN 'Subir precio'
        WHEN agg_units < v_pop_threshold AND margin >= v_margin_threshold THEN 'Promocionar'
        ELSE 'Revisar'
      END AS action,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN sales_share_val > 5 AND margin < v_margin_threshold THEN 'Vende mucho pero deja poco' END,
        CASE WHEN margin > v_margin_threshold AND sales_share_val < 1 THEN 'Joya oculta' END,
        CASE WHEN profit < 0 THEN 'Pérdidas' END
      ], NULL) AS badge_arr
    FROM calculated
  )
  SELECT
    pid, pname, pcategory, agg_units, agg_sales, agg_cogs,
    profit, margin, profit_per, pop_share, sales_share_val,
    class, action, badge_arr,
    v_total_units, v_total_sales,
    ROUND(v_pop_threshold::numeric, 2),
    ROUND(v_margin_threshold::numeric, 2)
  FROM classified
  ORDER BY agg_sales DESC;
END;
$$;


-- =============================================
-- 8) UPDATE get_top_products with p_data_source
-- =============================================

CREATE OR REPLACE FUNCTION public.get_top_products(
  p_location_id uuid DEFAULT NULL,
  p_date_from date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_date_to date DEFAULT CURRENT_DATE,
  p_order_by text DEFAULT 'share',
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE (
  product_id uuid, product_name text, category text,
  units numeric, sales numeric, sales_share_pct numeric,
  cogs numeric, gp numeric, gp_pct numeric, badge_label text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_sales numeric;
  v_group_id uuid;
BEGIN
  v_group_id := get_user_group_id();

  SELECT COALESCE(SUM(psd.net_sales), 0)
  INTO v_total_sales
  FROM public.product_sales_daily psd
  JOIN public.locations l ON l.id = psd.location_id
  WHERE l.group_id = v_group_id
    AND psd.date >= p_date_from AND psd.date <= p_date_to
    AND psd.data_source = p_data_source
    AND (p_location_id IS NULL OR psd.location_id = p_location_id);

  IF v_total_sales = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH aggregated AS (
    SELECT p.id AS product_id, p.name AS product_name, p.category,
      SUM(psd.units_sold) AS units, SUM(psd.net_sales) AS sales, SUM(psd.cogs) AS cogs
    FROM public.product_sales_daily psd
    JOIN public.products p ON p.id = psd.product_id
    JOIN public.locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from AND psd.date <= p_date_to
      AND psd.data_source = p_data_source
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
    GROUP BY p.id, p.name, p.category
  ),
  calculated AS (
    SELECT a.product_id, a.product_name, a.category, a.units, a.sales,
      CASE WHEN v_total_sales > 0 THEN ROUND((a.sales / v_total_sales) * 100, 2) ELSE 0 END AS sales_share_pct,
      a.cogs, ROUND(a.sales - a.cogs, 2) AS gp,
      CASE WHEN a.sales > 0 THEN ROUND(((a.sales - a.cogs) / a.sales) * 100, 1) ELSE 0 END AS gp_pct
    FROM aggregated a
  )
  SELECT c.product_id, c.product_name, c.category, c.units, c.sales, c.sales_share_pct,
    c.cogs, c.gp, c.gp_pct,
    CASE WHEN c.gp_pct < 50 THEN 'Low margin' ELSE NULL END AS badge_label
  FROM calculated c
  ORDER BY
    CASE p_order_by
      WHEN 'share' THEN c.sales_share_pct
      WHEN 'gp_eur' THEN c.gp
      WHEN 'gp_pct' THEN c.gp_pct
      ELSE c.sales_share_pct
    END DESC
  LIMIT 10;
END;
$$;
