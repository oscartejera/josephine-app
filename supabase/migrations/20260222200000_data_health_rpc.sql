-- ============================================================
-- Data Health RPC
-- Returns a JSON overview of system health for admin panel
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_data_health(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_last_refresh jsonb;
  v_last_pos_order jsonb;
  v_kpi_coverage jsonb;
  v_inventory jsonb;
  v_stock_counts jsonb;
BEGIN
  -- 1. Last MV refresh from ops.mv_refresh_log
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'status', rl.status,
      'finished_at', rl.finished_at,
      'duration_ms', rl.duration_ms,
      'views_refreshed', rl.views_refreshed,
      'triggered_by', rl.triggered_by,
      'error_message', rl.error_message
    )
    FROM ops.mv_refresh_log rl
    ORDER BY rl.id DESC
    LIMIT 1),
    jsonb_build_object('status', 'never', 'finished_at', null)
  ) INTO v_last_refresh;

  -- 2. Last POS order (from cdm_orders)
  SELECT jsonb_build_object(
    'last_closed_at', MAX(o.closed_at),
    'orders_7d', COUNT(*) FILTER (WHERE o.closed_at >= now() - interval '7 days')
  ) INTO v_last_pos_order
  FROM cdm_orders o
  WHERE o.org_id = p_org_id AND o.closed_at IS NOT NULL;

  -- 3. KPI coverage: location-days with data in last 30d
  SELECT jsonb_build_object(
    'location_days_30d', COUNT(*),
    'distinct_locations', COUNT(DISTINCT s.location_id)
  ) INTO v_kpi_coverage
  FROM sales_daily_unified s
  WHERE s.org_id = p_org_id
    AND s.date >= (current_date - 30);

  -- 4. Inventory health
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'with_recipes', COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM recipes r WHERE r.menu_item_name = ii.name AND r.group_id = p_org_id
    )),
    'with_par_level', COUNT(*) FILTER (WHERE ii.par_level IS NOT NULL AND ii.par_level > 0),
    'with_cost', COUNT(*) FILTER (WHERE ii.last_cost IS NOT NULL AND ii.last_cost > 0)
  ) INTO v_inventory
  FROM inventory_items ii
  WHERE ii.group_id = p_org_id;

  -- 5. Stock counts
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'last_30d', COUNT(*) FILTER (WHERE sc.start_date >= (current_date - 30)),
    'distinct_locations', COUNT(DISTINCT sc.location_id)
  ) INTO v_stock_counts
  FROM stock_counts sc
  WHERE sc.group_id = p_org_id;

  RETURN jsonb_build_object(
    'last_mv_refresh', v_last_refresh,
    'last_pos_order', v_last_pos_order,
    'kpi_coverage', v_kpi_coverage,
    'inventory', v_inventory,
    'stock_counts', v_stock_counts
  );
END;
$$;
