-- =============================================================================
-- JOSEPHINE DB v2 — MERGE-READY FIXES
-- 1. Unify time_entries ↔ employee_clock_records via trigger sync
-- 2. Implement rpc_data_health (real)
-- 3. Implement get_food_cost_variance (real)
-- 4. Fix labour_daily view to include employee_clock_records
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. UNIFY time_entries ↔ employee_clock_records
--    Strategy: trigger on employee_clock_records → mirror to time_entries
--    This ensures RPCs reading time_entries always have complete data
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to sync clock records to time_entries
CREATE OR REPLACE FUNCTION sync_clock_to_time_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Look up org_id from the employee's location
  SELECT l.group_id INTO v_org_id
  FROM locations l WHERE l.id = NEW.location_id LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Fallback: look up from the employee record
    SELECT e.group_id INTO v_org_id
    FROM employees e WHERE e.id = NEW.employee_id LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source, notes, created_at)
    VALUES (NEW.id, COALESCE(v_org_id, 'a0000000-0000-0000-0000-000000000001'::uuid),
            NEW.location_id, NEW.employee_id, NEW.clock_in, NEW.clock_out, NEW.source, NEW.notes, NEW.created_at)
    ON CONFLICT (id) DO UPDATE SET
      clock_in = EXCLUDED.clock_in,
      clock_out = EXCLUDED.clock_out,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE time_entries SET
      clock_in = NEW.clock_in,
      clock_out = NEW.clock_out,
      source = NEW.source,
      notes = NEW.notes
    WHERE id = NEW.id;
    -- If no row was updated, insert it
    IF NOT FOUND THEN
      INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source, notes, created_at)
      VALUES (NEW.id, COALESCE(v_org_id, 'a0000000-0000-0000-0000-000000000001'::uuid),
              NEW.location_id, NEW.employee_id, NEW.clock_in, NEW.clock_out, NEW.source, NEW.notes, NEW.created_at)
      ON CONFLICT (id) DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        clock_out = EXCLUDED.clock_out;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM time_entries WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_clock_to_time_entries ON employee_clock_records;
CREATE TRIGGER trg_sync_clock_to_time_entries
  AFTER INSERT OR UPDATE OR DELETE ON employee_clock_records
  FOR EACH ROW EXECUTE FUNCTION sync_clock_to_time_entries();

-- Backfill: copy existing employee_clock_records → time_entries
DO $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source, notes, created_at)
  SELECT ecr.id,
    COALESCE(l.group_id, 'a0000000-0000-0000-0000-000000000001'::uuid),
    ecr.location_id, ecr.employee_id, ecr.clock_in, ecr.clock_out, ecr.source, ecr.notes, ecr.created_at
  FROM employee_clock_records ecr
  LEFT JOIN locations l ON l.id = ecr.location_id
  ON CONFLICT (id) DO UPDATE SET
    clock_in = EXCLUDED.clock_in,
    clock_out = EXCLUDED.clock_out,
    source = EXCLUDED.source;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Synced % clock records to time_entries', v_count;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RECREATE labour_daily VIEW to include BOTH sources
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW labour_daily AS
SELECT
  te.location_id,
  te.clock_in::date AS date,
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. REAL rpc_data_health
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rpc_data_health(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_mv_status text := 'unknown';
  v_mv_finished timestamptz;
  v_mv_duration int;
  v_mv_views text[];
  v_mv_trigger text;
  v_mv_error text;
  v_last_order timestamptz;
  v_orders_7d bigint := 0;
  v_kpi_days bigint := 0;
  v_kpi_locs bigint := 0;
  v_inv_total bigint := 0;
  v_inv_recipes bigint := 0;
  v_inv_par bigint := 0;
  v_inv_cost bigint := 0;
  v_sc_total bigint := 0;
  v_sc_30d bigint := 0;
  v_sc_locs bigint := 0;
BEGIN
  -- 1. Last MV refresh from jobs table
  BEGIN
    SELECT
      COALESCE(j.status, 'never'),
      j.finished_at,
      CASE WHEN j.finished_at IS NOT NULL AND j.locked_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (j.finished_at - j.locked_at))::int * 1000
        ELSE NULL END,
      CASE WHEN j.payload ? 'result' AND (j.payload->'result') ? 'refreshed'
        THEN ARRAY(SELECT jsonb_array_elements_text(j.payload->'result'->'refreshed'))
        ELSE NULL END,
      j.payload->>'triggered_by',
      j.last_error
    INTO v_mv_status, v_mv_finished, v_mv_duration, v_mv_views, v_mv_trigger, v_mv_error
    FROM jobs j
    WHERE j.org_id = p_org_id AND j.job_type = 'refresh_mvs'
    ORDER BY j.created_at DESC LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    v_mv_status := 'no_jobs_table';
  END;

  -- 2. Last POS order
  BEGIN
    SELECT MAX(closed_at), COUNT(*) FILTER (WHERE closed_at >= now() - interval '7 days')
    INTO v_last_order, v_orders_7d
    FROM cdm_orders WHERE org_id = p_org_id AND closed_at IS NOT NULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 3. KPI coverage (location-days in last 30d)
  BEGIN
    SELECT COUNT(*), COUNT(DISTINCT location_id)
    INTO v_kpi_days, v_kpi_locs
    FROM daily_sales
    WHERE org_id = p_org_id AND day >= CURRENT_DATE - 30;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 4. Inventory health
  BEGIN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM recipe_lines rl WHERE rl.recipe_id IN (SELECT r.id FROM recipes r WHERE r.menu_item_id = ii.id))),
      COUNT(*) FILTER (WHERE par_level IS NOT NULL AND par_level > 0),
      COUNT(*) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0)
    INTO v_inv_total, v_inv_recipes, v_inv_par, v_inv_cost
    FROM inventory_items ii
    WHERE ii.group_id = p_org_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 5. Stock counts
  BEGIN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days'),
      COUNT(DISTINCT location_id)
    INTO v_sc_total, v_sc_30d, v_sc_locs
    FROM stock_counts
    WHERE org_id = p_org_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'last_mv_refresh', jsonb_build_object(
      'status', v_mv_status,
      'finished_at', v_mv_finished,
      'duration_ms', v_mv_duration,
      'views_refreshed', to_jsonb(v_mv_views),
      'triggered_by', v_mv_trigger,
      'error_message', v_mv_error
    ),
    'last_pos_order', jsonb_build_object(
      'last_closed_at', v_last_order,
      'orders_7d', v_orders_7d
    ),
    'kpi_coverage', jsonb_build_object(
      'location_days_30d', v_kpi_days,
      'distinct_locations', v_kpi_locs
    ),
    'inventory', jsonb_build_object(
      'total_items', v_inv_total,
      'with_recipes', v_inv_recipes,
      'with_par_level', v_inv_par,
      'with_cost', v_inv_cost
    ),
    'stock_counts', jsonb_build_object(
      'total', v_sc_total,
      'last_30d', v_sc_30d,
      'distinct_locations', v_sc_locs
    )
  );
END;$$;

GRANT EXECUTE ON FUNCTION rpc_data_health(uuid) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. REAL get_food_cost_variance
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old stub (different signature)
DROP FUNCTION IF EXISTS get_food_cost_variance(uuid, uuid[], date, date);

CREATE OR REPLACE FUNCTION get_food_cost_variance(
  _location_id uuid DEFAULT NULL,
  _from date DEFAULT (CURRENT_DATE - 30),
  _to date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_total_cogs numeric := 0;
  v_total_revenue numeric := 0;
  v_budget_cogs numeric := 0;
  v_actual_pct numeric;
  v_budget_pct numeric;
  v_variance numeric;
  v_variance_pct numeric;
  v_items jsonb;
BEGIN
  -- Actual COGS from cogs_daily
  SELECT COALESCE(SUM(cogs_amount), 0) INTO v_total_cogs
  FROM cogs_daily
  WHERE (_location_id IS NULL OR location_id = _location_id) AND date BETWEEN _from AND _to;

  -- Revenue from daily_sales
  SELECT COALESCE(SUM(net_sales), 0) INTO v_total_revenue
  FROM daily_sales
  WHERE (_location_id IS NULL OR location_id = _location_id) AND day BETWEEN _from AND _to;

  -- Budget COGS
  BEGIN
    SELECT COALESCE(SUM(budget_cogs), 0) INTO v_budget_cogs
    FROM budget_daily_unified
    WHERE (_location_id IS NULL OR location_id = _location_id) AND day BETWEEN _from AND _to;
  EXCEPTION WHEN undefined_column THEN
    SELECT COALESCE(SUM(budget_cogs), 0) INTO v_budget_cogs
    FROM budget_daily_unified
    WHERE (_location_id IS NULL OR location_id = _location_id) AND date BETWEEN _from AND _to;
  END;

  -- Calculate percentages
  v_actual_pct := CASE WHEN v_total_revenue > 0 THEN ROUND(v_total_cogs / v_total_revenue * 100, 1) ELSE 0 END;
  v_budget_pct := CASE WHEN v_total_revenue > 0 THEN ROUND(v_budget_cogs / v_total_revenue * 100, 1) ELSE 0 END;
  v_variance := v_total_cogs - v_budget_cogs;
  v_variance_pct := CASE WHEN v_budget_cogs > 0 THEN ROUND(v_variance / v_budget_cogs * 100, 1) ELSE 0 END;

  -- Top variance items by category from stock_movements
  BEGIN
    WITH category_costs AS (
      SELECT
        COALESCE(ii.category, 'Sin categoría') AS category,
        SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_cost, 0)) AS actual_cost
      FROM stock_movements sm
      LEFT JOIN inventory_items ii ON ii.id = sm.item_id
      WHERE sm.movement_type = 'purchase'
        AND (_location_id IS NULL OR sm.location_id = _location_id)
        AND sm.created_at::date BETWEEN _from AND _to
      GROUP BY ii.category
      ORDER BY actual_cost DESC
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category', category,
      'actual_cost', ROUND(actual_cost, 0),
      'pct_of_total', CASE WHEN v_total_cogs > 0 THEN ROUND(actual_cost / v_total_cogs * 100, 1) ELSE 0 END
    )), '[]'::jsonb) INTO v_items
    FROM category_costs;
  EXCEPTION WHEN OTHERS THEN
    v_items := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'total_cogs', ROUND(v_total_cogs, 0),
    'total_revenue', ROUND(v_total_revenue, 0),
    'budget_cogs', ROUND(v_budget_cogs, 0),
    'actual_pct', v_actual_pct,
    'budget_pct', v_budget_pct,
    'variance', ROUND(v_variance, 0),
    'variance_pct', v_variance_pct,
    'items', v_items
  );
END;$$;

-- Grant with both signatures (old org-based and new location-based)
GRANT EXECUTE ON FUNCTION get_food_cost_variance(uuid, date, date) TO anon, authenticated;

-- Also create org-level overload for compatibility
CREATE OR REPLACE FUNCTION get_food_cost_variance(
  p_org_id uuid, p_location_ids uuid[] DEFAULT NULL,
  p_from date DEFAULT (CURRENT_DATE - 30), p_to date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    RETURN get_food_cost_variance(p_location_ids[1], p_from, p_to);
  ELSE
    RETURN get_food_cost_variance(NULL::uuid, p_from, p_to);
  END IF;
END;$$;

GRANT EXECUTE ON FUNCTION get_food_cost_variance(uuid, uuid[], date, date) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REAL generate_pos_daily_data (generates daily_sales from cdm_orders)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_pos_daily_data(p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO daily_sales (org_id, location_id, day, net_sales, gross_sales, orders_count, covers, avg_check, data_source)
  SELECT
    o.org_id, o.location_id, p_date,
    COALESCE(SUM(o.net_total), 0),
    COALESCE(SUM(o.gross_total), 0),
    COUNT(DISTINCT o.id),
    COUNT(DISTINCT o.id), -- covers approximation
    CASE WHEN COUNT(DISTINCT o.id) > 0
      THEN ROUND(SUM(o.net_total) / COUNT(DISTINCT o.id), 2)
      ELSE 0 END,
    'pos'
  FROM cdm_orders o
  WHERE o.closed_at::date = p_date AND o.status = 'closed'
  GROUP BY o.org_id, o.location_id
  ON CONFLICT (location_id, day) DO UPDATE SET
    net_sales = EXCLUDED.net_sales,
    gross_sales = EXCLUDED.gross_sales,
    orders_count = EXCLUDED.orders_count,
    covers = EXCLUDED.covers,
    avg_check = EXCLUDED.avg_check,
    data_source = 'pos';
END;$$;

GRANT EXECUTE ON FUNCTION generate_pos_daily_data(date) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. REAL redeem_loyalty_reward
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_member_id uuid, p_reward_id uuid, p_location_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member record;
  v_reward record;
  v_cost int;
BEGIN
  -- Check member exists and has enough points
  BEGIN
    SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', false, 'error', 'loyalty_not_configured');
  END;

  -- Check reward exists
  BEGIN
    SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reward_not_found');
    END IF;
    v_cost := COALESCE(v_reward.points_cost, 0);
  EXCEPTION WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rewards_not_configured');
  END;

  -- Check sufficient points
  IF COALESCE(v_member.points_balance, 0) < v_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_points',
      'required', v_cost, 'available', v_member.points_balance
    );
  END IF;

  -- Deduct points
  UPDATE loyalty_members SET points_balance = points_balance - v_cost WHERE id = p_member_id;

  -- Record redemption
  BEGIN
    INSERT INTO loyalty_redemptions (member_id, reward_id, location_id, points_spent)
    VALUES (p_member_id, p_reward_id, p_location_id, v_cost);
  EXCEPTION WHEN undefined_table THEN
    -- No redemptions table yet, still OK
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'reward_name', v_reward.name,
    'points_spent', v_cost,
    'remaining_points', COALESCE(v_member.points_balance, 0) - v_cost
  );
END;$$;

GRANT EXECUTE ON FUNCTION redeem_loyalty_reward(uuid, uuid, uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Reload PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
