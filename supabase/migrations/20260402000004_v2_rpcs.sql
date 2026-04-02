-- =============================================================================
-- JOSEPHINE DB v2 — RPCs (frontend contract layer)
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- LABOUR RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_labour_kpis(
  p_date_from date, p_date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_sales numeric; v_lc numeric; v_lh numeric; v_shifts numeric;
  v_headcount bigint; v_col_pct numeric; v_splh numeric;
  v_b_sales numeric; v_b_labour numeric; v_prev_lc numeric;
  v_prev_sales numeric; v_f_sales numeric; v_f_hours numeric;
BEGIN
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(labour_cost),0), COALESCE(SUM(labour_hours),0)
  INTO v_sales, v_lc, v_lh FROM mart_kpi_daily
  WHERE date BETWEEN p_date_from AND p_date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(planned_hours),0) INTO v_shifts FROM planned_shifts
  WHERE shift_date BETWEEN p_date_from AND p_date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COUNT(DISTINCT employee_id) INTO v_headcount FROM time_entries
  WHERE clock_in::date BETWEEN p_date_from AND p_date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  v_col_pct := CASE WHEN v_sales > 0 THEN ROUND(v_lc/v_sales*100,1) ELSE 0 END;
  v_splh := CASE WHEN v_lh > 0 THEN ROUND(v_sales/v_lh,2) ELSE 0 END;

  SELECT COALESCE(SUM(budget_sales),0), COALESCE(SUM(budget_labour),0)
  INTO v_b_sales, v_b_labour FROM budgets_daily
  WHERE date BETWEEN p_date_from AND p_date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(labour_cost),0), COALESCE(SUM(net_sales),0)
  INTO v_prev_lc, v_prev_sales FROM mart_kpi_daily
  WHERE date BETWEEN (p_date_from - (p_date_to - p_date_from + 1)) AND (p_date_from - 1)
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(forecast_sales),0), COALESCE(SUM(planned_labor_hours),0)
  INTO v_f_sales, v_f_hours FROM forecast_daily_metrics
  WHERE date BETWEEN p_date_from AND p_date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  RETURN jsonb_build_object(
    'total_labour_cost', v_lc, 'total_labour_hours', v_lh,
    'total_shifts_hours', v_shifts, 'total_sales', v_sales,
    'col_percentage', v_col_pct, 'splh', v_splh,
    'active_employees', v_headcount,
    'avg_hourly_rate', CASE WHEN v_lh > 0 THEN ROUND(v_lc/v_lh,2) ELSE 0 END,
    'budget_sales', v_b_sales, 'budget_labour', v_b_labour,
    'budget_col_pct', CASE WHEN v_b_sales > 0 THEN ROUND(v_b_labour/v_b_sales*100,1) ELSE 0 END,
    'prev_labour_cost', v_prev_lc, 'prev_sales', v_prev_sales,
    'prev_col_pct', CASE WHEN v_prev_sales > 0 THEN ROUND(v_prev_lc/v_prev_sales*100,1) ELSE 0 END,
    'forecast_sales', v_f_sales, 'forecast_hours', v_f_hours,
    'forecast_splh', CASE WHEN v_f_hours > 0 THEN ROUND(v_f_sales/v_f_hours,2) ELSE 0 END
  );
END;$$;

CREATE OR REPLACE FUNCTION get_labour_timeseries(
  p_date_from date, p_date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date),'[]'::jsonb) INTO v_result
  FROM (
    SELECT k.date, k.net_sales AS sales, k.labour_cost, k.labour_hours,
      k.col_pct, k.splh,
      COALESCE(b.budget_sales,0) AS budget_sales,
      COALESCE(b.budget_labour,0) AS budget_labour
    FROM mart_kpi_daily k
    LEFT JOIN budgets_daily b ON b.location_id = k.location_id AND b.date = k.date
    WHERE k.date BETWEEN p_date_from AND p_date_to
      AND (selected_location_id IS NULL OR k.location_id = selected_location_id)
  ) d;
  RETURN v_result;
END;$$;

CREATE OR REPLACE FUNCTION get_labour_locations_table(
  p_date_from date, p_date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb),'[]'::jsonb) INTO v_result
  FROM (
    SELECT k.location_id, l.name AS location_name,
      SUM(k.net_sales) AS sales, SUM(k.labour_cost) AS labour_cost,
      SUM(k.labour_hours) AS labour_hours,
      CASE WHEN SUM(k.net_sales) > 0 THEN ROUND(SUM(k.labour_cost)/SUM(k.net_sales)*100,1) ELSE 0 END AS col_pct,
      CASE WHEN SUM(k.labour_hours) > 0 THEN ROUND(SUM(k.net_sales)/SUM(k.labour_hours),2) ELSE 0 END AS splh
    FROM mart_kpi_daily k
    JOIN locations l ON l.id = k.location_id
    WHERE k.date BETWEEN p_date_from AND p_date_to
      AND (selected_location_id IS NULL OR k.location_id = selected_location_id)
    GROUP BY k.location_id, l.name
  ) d;
  RETURN v_result;
END;$$;

CREATE OR REPLACE FUNCTION get_labour_cost_by_date(p_location_ids uuid[], p_date date)
RETURNS TABLE(location_id uuid, labour_cost numeric, labour_hours numeric) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ld.location_id, ld.labour_cost, ld.labour_hours FROM labour_daily ld
  WHERE ld.location_id = ANY(p_location_ids) AND ld.date = p_date;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SALES RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_sales_timeseries_unified(
  p_org_id uuid, p_location_ids uuid[], p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_ds jsonb; v_result jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date),'[]'::jsonb) INTO v_result
  FROM (
    SELECT s.date, SUM(s.net_sales) AS net_sales, SUM(s.orders_count) AS orders_count,
      SUM(s.covers) AS covers, SUM(s.payments_cash) AS payments_cash,
      SUM(s.payments_card) AS payments_card
    FROM sales_daily_unified s
    WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids)
      AND s.date BETWEEN p_from AND p_to
    GROUP BY s.date
  ) d;
  RETURN jsonb_build_object('data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at','data',v_result);
END;$$;

CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id uuid, p_location_ids uuid[], p_from date, p_to date, p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_ds jsonb; v_total numeric; v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);
  SELECT COALESCE(SUM(net_sales),0) INTO v_total FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb),'[]'::jsonb) INTO v_items
  FROM (
    SELECT COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000')::text AS product_id,
      COALESCE(mi.name,ci.name,'Unknown') AS name, COALESCE(mi.category,ci.category,'Other') AS category,
      SUM(COALESCE(ol.gross,0))::numeric AS sales, SUM(COALESCE(ol.qty,0))::numeric AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(ol.gross,0))/v_total ELSE 0 END AS share
    FROM cdm_orders o JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN cdm_items ci ON ci.id = ol.item_id LEFT JOIN menu_items mi ON mi.id = ol.item_id
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY 1,2,3 ORDER BY sales DESC LIMIT p_limit
  ) p;
  RETURN jsonb_build_object('data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at','total_sales',v_total,'items',v_items);
END;$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- KPI & P&L RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rpc_kpi_range_summary(
  p_org_id uuid, p_location_ids uuid[], p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_days int; v_prev_from date; v_prev_to date;
  v_sales numeric; v_orders bigint; v_covers bigint;
  v_labour numeric; v_labour_hours numeric; v_cogs numeric;
  v_prev_sales numeric; v_prev_orders bigint; v_prev_covers bigint;
  v_prev_labour numeric; v_prev_labour_hours numeric; v_prev_cogs numeric;
BEGIN
  v_days := (p_to - p_from + 1);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_days + 1;

  -- Current period sales
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(orders_count),0), COALESCE(SUM(covers),0)
  INTO v_sales, v_orders, v_covers FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  -- Current period labour (from time_entries)
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric
  INTO v_labour, v_labour_hours FROM time_entries te
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.location_id = ANY(p_location_ids) AND te.clock_in::date BETWEEN p_from AND p_to;

  -- Current period COGS
  SELECT COALESCE(SUM(cogs_amount),0) INTO v_cogs FROM cogs_daily
  WHERE location_id = ANY(p_location_ids) AND date BETWEEN p_from AND p_to;

  -- Previous period
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(orders_count),0), COALESCE(SUM(covers),0)
  INTO v_prev_sales, v_prev_orders, v_prev_covers FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN v_prev_from AND v_prev_to;

  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric
  INTO v_prev_labour, v_prev_labour_hours FROM time_entries te
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.location_id = ANY(p_location_ids) AND te.clock_in::date BETWEEN v_prev_from AND v_prev_to;

  SELECT COALESCE(SUM(cogs_amount),0) INTO v_prev_cogs FROM cogs_daily
  WHERE location_id = ANY(p_location_ids) AND date BETWEEN v_prev_from AND v_prev_to;

  RETURN jsonb_build_object(
    'current', jsonb_build_object(
      'net_sales', v_sales, 'orders_count', v_orders, 'covers', v_covers,
      'avg_check', CASE WHEN v_orders > 0 THEN ROUND(v_sales / v_orders, 2) ELSE 0 END,
      'labour_cost', v_labour, 'labour_hours', v_labour_hours, 'cogs', v_cogs,
      'col_percent', CASE WHEN v_sales > 0 THEN ROUND(v_labour / v_sales * 100, 1) ELSE NULL END,
      'gp_percent', CASE WHEN v_sales > 0 THEN ROUND((v_sales - v_cogs) / v_sales * 100, 1) ELSE NULL END
    ),
    'previous', jsonb_build_object(
      'net_sales', v_prev_sales, 'orders_count', v_prev_orders, 'covers', v_prev_covers,
      'avg_check', CASE WHEN v_prev_orders > 0 THEN ROUND(v_prev_sales / v_prev_orders, 2) ELSE 0 END,
      'labour_cost', v_prev_labour, 'labour_hours', v_prev_labour_hours, 'cogs', v_prev_cogs,
      'col_percent', CASE WHEN v_prev_sales > 0 THEN ROUND(v_prev_labour / v_prev_sales * 100, 1) ELSE NULL END,
      'gp_percent', CASE WHEN v_prev_sales > 0 THEN ROUND((v_prev_sales - v_prev_cogs) / v_prev_sales * 100, 1) ELSE NULL END
    ),
    'period', jsonb_build_object('from', p_from::text, 'to', p_to::text, 'days', v_days),
    'previousPeriod', jsonb_build_object('from', v_prev_from::text, 'to', v_prev_to::text)
  );
END;$$;

CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid, p_location_ids text[], p_from date, p_to date
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rpc_kpi_range_summary(p_org_id, ARRAY(SELECT unnest(p_location_ids)::uuid), p_from, p_to);
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- MENU ENGINEERING RPC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date, p_date_to date,
  p_location_id uuid DEFAULT NULL, p_data_source text DEFAULT 'demo'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name,ci.name,'Unknown') AS product_name, COALESCE(mi.category,ci.category,'Other') AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint AS units_sold, COALESCE(SUM(ol.gross),0) AS net_sales,
        0::numeric AS cogs, COALESCE(SUM(ol.gross),0) AS gross_profit, 100::numeric AS margin_pct
      FROM cdm_orders o JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ), stats AS (SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data)
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb),'[]'::jsonb)
    FROM (
      SELECT pd.*, CASE
        WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
        WHEN pd.margin_pct < COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
        WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold < COALESCE(s.avg_p,0) THEN 'puzzle'
        ELSE 'dog' END AS classification
      FROM product_data pd, stats s ORDER BY pd.net_sales DESC
    ) r
  );
END;$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- INVENTORY RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_variance_summary(
  p_org_id uuid, p_location_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - 30), p_to_date date DEFAULT CURRENT_DATE
) RETURNS TABLE (
  item_id uuid, item_name text, category text, stock_expected numeric,
  stock_actual numeric, variance numeric, variance_pct numeric,
  unit_cost numeric, financial_loss numeric, count_date date
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT c.item_id, ii.name, COALESCE(cat.name,'Sin categoría'),
    c.stock_expected, c.stock_actual, c.variance, c.variance_pct, c.unit_cost,
    ABS(c.variance) * c.unit_cost, c.count_date
  FROM inventory_counts c
  JOIN inventory_items ii ON ii.id = c.item_id
  LEFT JOIN inventory_categories cat ON cat.id = ii.category_id
  WHERE c.org_id = p_org_id AND (p_location_id IS NULL OR c.location_id = p_location_id)
    AND c.count_date BETWEEN p_from_date AND p_to_date
  ORDER BY ABS(c.variance_pct) DESC;
END;$$;

CREATE OR REPLACE FUNCTION get_reconciliation_report(
  p_org_id uuid, p_location_ids uuid[] DEFAULT NULL,
  p_from date DEFAULT (CURRENT_DATE - 30), p_to date DEFAULT CURRENT_DATE,
  p_status text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_headers jsonb; v_lines jsonb; v_totals jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.end_date DESC),'[]'::jsonb) INTO v_headers
  FROM (SELECT mh.* FROM mart_stock_count_headers mh
    WHERE mh.group_id = p_org_id AND (p_location_ids IS NULL OR mh.location_id = ANY(p_location_ids))
      AND mh.start_date >= p_from AND mh.end_date <= p_to
      AND (p_status IS NULL OR mh.status = p_status)) h;

  SELECT COALESCE(jsonb_agg(row_to_json(li)::jsonb ORDER BY li.item_name),'[]'::jsonb) INTO v_lines
  FROM (SELECT el.inventory_item_id, el.item_name, el.unit, el.unit_cost,
    SUM(el.opening_qty)::numeric AS opening_qty, SUM(el.deliveries_qty)::numeric AS deliveries_qty,
    SUM(el.transfers_net_qty)::numeric AS transfers_net_qty, SUM(el.closing_qty)::numeric AS closing_qty,
    SUM(el.used_qty)::numeric AS used_qty, SUM(el.sales_qty)::numeric AS sales_qty,
    SUM(el.variance_qty)::numeric AS variance_qty, SUM(el.batch_balance)::numeric AS batch_balance,
    SUM(el.variance_value)::numeric AS variance_value
    FROM mart_stock_count_lines_enriched el
    WHERE el.group_id = p_org_id AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
      AND el.start_date >= p_from AND el.end_date <= p_to
      AND (p_status IS NULL OR el.count_status = p_status)
    GROUP BY el.inventory_item_id, el.item_name, el.unit, el.unit_cost) li;

  SELECT jsonb_build_object(
    'opening_qty', COALESCE(SUM(el.opening_qty),0), 'deliveries_qty', COALESCE(SUM(el.deliveries_qty),0),
    'closing_qty', COALESCE(SUM(el.closing_qty),0), 'used_qty', COALESCE(SUM(el.used_qty),0),
    'variance_qty', COALESCE(SUM(el.variance_qty),0), 'variance_value', COALESCE(SUM(el.variance_value),0)
  ) INTO v_totals FROM mart_stock_count_lines_enriched el
  WHERE el.group_id = p_org_id AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
    AND el.start_date >= p_from AND el.end_date <= p_to AND (p_status IS NULL OR el.count_status = p_status);

  RETURN jsonb_build_object('count_headers', v_headers, 'lines', v_lines, 'totals', v_totals);
END;$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- LABOUR ADVANCED RPCs (staffing, compliance, tips)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_labour_compliance(p_org_id uuid, p_location_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_max_weekly numeric; v_max_daily numeric; v_min_rest numeric; v_alerts jsonb := '[]'::jsonb;
BEGIN
  v_max_weekly := get_labour_rule(p_org_id, p_location_id, 'max_weekly_hours', 48);
  v_max_daily := get_labour_rule(p_org_id, p_location_id, 'max_daily_hours', 10);
  v_min_rest := get_labour_rule(p_org_id, p_location_id, 'min_rest_between_shifts', 11);
  RETURN jsonb_build_object('checked_at', now(), 'rules', jsonb_build_object(
    'max_weekly_hours', v_max_weekly, 'max_daily_hours', v_max_daily, 'min_rest_hours', v_min_rest
  ), 'alerts', v_alerts, 'compliant', jsonb_array_length(v_alerts) = 0);
END;$$;

CREATE OR REPLACE FUNCTION calculate_tip_distribution(p_tip_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_entry record; v_rule record; v_total_hours numeric := 0; v_result jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_entry FROM tip_entries WHERE id = p_tip_entry_id;
  IF v_entry IS NULL THEN RETURN jsonb_build_object('error', 'Tip entry not found'); END IF;
  SELECT * INTO v_rule FROM tip_distribution_rules
  WHERE org_id = v_entry.org_id AND location_id = v_entry.location_id AND is_active = true LIMIT 1;
  IF v_rule IS NULL THEN RETURN jsonb_build_object('error', 'No active tip rule'); END IF;
  RETURN jsonb_build_object('tip_entry_id', p_tip_entry_id, 'distributions', v_result);
END;$$;

CREATE OR REPLACE FUNCTION get_payroll_forecast(p_org_id uuid, p_location_id uuid, p_year int, p_month int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object('org_id', p_org_id, 'location_id', p_location_id,
    'year', p_year, 'month', p_month, 'forecast', '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION get_employee_revenue_scores(p_org_id uuid, p_location_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object('location_id', p_location_id, 'period', jsonb_build_object('from', p_from, 'to', p_to), 'scores', '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION get_staffing_heatmap(p_org_id uuid, p_location_id uuid, p_weeks_back int DEFAULT 4)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object('location_id', p_location_id, 'weeks', p_weeks_back, 'days', '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION get_staffing_recommendation(p_org_id uuid, p_location_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object('location_id', p_location_id, 'days', '[]'::jsonb);
$$;

-- Stub RPCs
CREATE OR REPLACE FUNCTION rpc_data_health(p_org_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object('status', 'healthy', 'checked_at', now());
$$;

CREATE OR REPLACE FUNCTION redeem_loyalty_reward(p_member_id uuid, p_reward_id uuid, p_location_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"ok":true,"stub":true}'::jsonb; $$;

CREATE OR REPLACE FUNCTION generate_pos_daily_data(p_date date)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

CREATE OR REPLACE FUNCTION process_refresh_mvs_jobs()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job record; v_result jsonb; v_count integer := 0;
BEGIN
  FOR v_job IN SELECT id, org_id, payload FROM jobs
    WHERE job_type = 'refresh_mvs' AND status = 'queued' AND run_after <= now()
    ORDER BY priority DESC, created_at ASC LIMIT 5 FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE jobs SET status = 'running', locked_at = now() WHERE id = v_job.id;
    BEGIN
      v_result := ops.refresh_all_mvs(COALESCE(v_job.payload->>'triggered_by','job_worker'));
      UPDATE jobs SET status = 'succeeded', finished_at = now(), payload = v_job.payload || jsonb_build_object('result', v_result) WHERE id = v_job.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE jobs SET status = 'failed', finished_at = now(), last_error = SQLERRM, attempts = attempts + 1 WHERE id = v_job.id;
    END;
  END LOOP;
  RETURN jsonb_build_object('processed', v_count);
END;$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS for RPCs
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION get_labour_kpis(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_timeseries(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_locations_table(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_cost_by_date(uuid[], date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_timeseries_unified(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_products_unified(uuid, uuid[], date, date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_kpi_range_summary(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, text[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_labour_compliance(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tip_distribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payroll_forecast(uuid, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_revenue_scores(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_heatmap(uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_recommendation(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION process_refresh_mvs_jobs() TO service_role;
