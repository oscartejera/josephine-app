-- ═══════════════════════════════════════════════════════════════════════════
-- V2 MISSING RPCs — Port 9 functions from _archive to v2 schema
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. setup_new_owner ──────────────────────────────────────────────────
-- Creates org group, location, and owner role for new user onboarding
CREATE OR REPLACE FUNCTION setup_new_owner(
  p_user_id uuid,
  p_group_name text,
  p_location_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_location_id uuid;
  v_org_id uuid;
BEGIN
  -- Check if user already has a group
  SELECT group_id INTO v_group_id FROM profiles WHERE id = p_user_id;
  IF v_group_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_setup', 'group_id', v_group_id);
  END IF;

  -- Create organisation / group
  INSERT INTO groups (name) VALUES (p_group_name) RETURNING id INTO v_group_id;

  -- Create default location
  INSERT INTO locations (org_id, name) VALUES (v_group_id, p_location_name) RETURNING id INTO v_location_id;

  -- Update profile with group
  UPDATE profiles SET group_id = v_group_id WHERE id = p_user_id;

  -- Add owner role
  INSERT INTO user_roles (user_id, group_id, role, scope)
  VALUES (p_user_id, v_group_id, 'owner', 'global')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'created',
    'group_id', v_group_id,
    'location_id', v_location_id
  );
END;
$$;

-- ─── 2. get_setup_completeness ───────────────────────────────────────────
-- Returns setup progress metrics for the onboarding checklist
CREATE OR REPLACE FUNCTION get_setup_completeness(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv_count integer;
  v_recipe_count integer;
  v_recipe_with_ing integer;
  v_menu_count integer;
  v_menu_with_recipe integer;
  v_has_pos boolean;
  v_pct numeric;
  v_missing text[];
BEGIN
  SELECT COUNT(*) INTO v_inv_count FROM inventory_items WHERE group_id = p_org_id;
  SELECT COUNT(*) INTO v_recipe_count FROM recipes WHERE group_id = p_org_id;
  SELECT COUNT(DISTINCT ri.menu_item_id) INTO v_recipe_with_ing
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.menu_item_id
    WHERE r.group_id = p_org_id;
  SELECT COUNT(*) INTO v_menu_count FROM menu_items WHERE group_id = p_org_id;
  SELECT COUNT(*) INTO v_menu_with_recipe
    FROM menu_items mi
    WHERE mi.group_id = p_org_id
    AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = mi.id);

  SELECT EXISTS(
    SELECT 1 FROM daily_sales WHERE location_id IN (SELECT id FROM locations WHERE org_id = p_org_id) LIMIT 1
  ) INTO v_has_pos;

  -- Calculate completeness
  v_missing := ARRAY[]::text[];
  IF v_inv_count = 0 THEN v_missing := array_append(v_missing, 'inventory_items'); END IF;
  IF v_recipe_count = 0 THEN v_missing := array_append(v_missing, 'recipes'); END IF;
  IF v_recipe_with_ing = 0 THEN v_missing := array_append(v_missing, 'recipe_ingredients'); END IF;
  IF NOT v_has_pos THEN v_missing := array_append(v_missing, 'pos_data'); END IF;

  v_pct := CASE
    WHEN 4 - array_length(v_missing, 1) IS NULL THEN 100
    ELSE ROUND((4.0 - COALESCE(array_length(v_missing, 1), 0)) / 4.0 * 100, 0)
  END;

  RETURN jsonb_build_object(
    'inventory_items_count', v_inv_count,
    'recipes_count', v_recipe_count,
    'recipes_with_ingredients_count', v_recipe_with_ing,
    'menu_items_count', v_menu_count,
    'menu_items_with_recipe', v_menu_with_recipe,
    'has_pos_data', v_has_pos,
    'completeness_pct', v_pct,
    'missing_steps', to_jsonb(v_missing)
  );
END;
$$;

-- ─── 3. get_recipe_food_cost (recursive) ─────────────────────────────────
-- Calculates total food cost for a recipe including sub-recipes
CREATE OR REPLACE FUNCTION get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total numeric := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      ri.inventory_item_id,
      ri.sub_recipe_id,
      ri.qty_gross,
      COALESCE(ii.last_cost, 0) AS unit_cost,
      sr.yield_qty AS sub_yield_qty
    FROM recipe_ingredients ri
    LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
    LEFT JOIN recipes sr ON sr.id = ri.sub_recipe_id
    WHERE ri.menu_item_id = p_recipe_id
  LOOP
    IF v_row.sub_recipe_id IS NOT NULL THEN
      v_total := v_total + (
        v_row.qty_gross / GREATEST(COALESCE(v_row.sub_yield_qty, 1), 0.001)
        * get_recipe_food_cost(v_row.sub_recipe_id)
      );
    ELSE
      v_total := v_total + (v_row.qty_gross * v_row.unit_cost);
    END IF;
  END LOOP;
  RETURN ROUND(v_total, 4);
END;
$$;

-- ─── 4. get_recipe_ingredient_count ──────────────────────────────────────
CREATE OR REPLACE FUNCTION get_recipe_ingredient_count(p_recipe_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer FROM recipe_ingredients WHERE menu_item_id = p_recipe_id;
$$;

-- ─── 5. get_menu_item_id_for_recipe ──────────────────────────────────────
-- Resolves recipe.id → menu_items.id (they share the same ID)
CREATE OR REPLACE FUNCTION get_menu_item_id_for_recipe(p_recipe_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT mi.id FROM menu_items mi WHERE mi.id = p_recipe_id),
    p_recipe_id
  );
$$;

-- ─── 6. get_recipe_ingredients ───────────────────────────────────────────
-- Returns enriched ingredient list for recipe detail page
CREATE OR REPLACE FUNCTION get_recipe_ingredients(p_recipe_id uuid)
RETURNS TABLE(
  menu_item_id uuid,
  inventory_item_id uuid,
  sub_recipe_id uuid,
  qty_base_units numeric,
  qty_gross numeric,
  qty_net numeric,
  unit text,
  yield_pct numeric,
  sort_order integer,
  item_name text,
  item_unit text,
  last_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    ri.menu_item_id,
    ri.inventory_item_id,
    ri.sub_recipe_id,
    ri.qty_base_units,
    COALESCE(ri.qty_gross, ri.qty_base_units) AS qty_gross,
    COALESCE(ri.qty_net, ri.qty_base_units) AS qty_net,
    COALESCE(ri.unit, 'kg') AS unit,
    COALESCE(ri.yield_pct, 100) AS yield_pct,
    COALESCE(ri.sort_order, 0) AS sort_order,
    COALESCE(ii.name, 'Unknown') AS item_name,
    COALESCE(ii.unit, '') AS item_unit,
    COALESCE(ii.last_cost, 0) AS last_cost
  FROM recipe_ingredients ri
  LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = p_recipe_id
  ORDER BY ri.sort_order, ii.name;
$$;

-- ─── 7. receive_purchase_order ───────────────────────────────────────────
-- Marks PO as delivered and updates inventory levels
CREATE OR REPLACE FUNCTION receive_purchase_order(_po_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po record;
  v_line record;
BEGIN
  SELECT id, status, supplier_id,
    (SELECT org_id FROM locations WHERE id = po.location_id) AS org_id,
    location_id
  INTO v_po FROM purchase_orders po WHERE po.id = _po_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status = 'delivered' THEN RAISE EXCEPTION 'Already delivered'; END IF;

  -- Update PO status
  UPDATE purchase_orders SET status = 'delivered', delivery_date = CURRENT_DATE WHERE id = _po_id;

  -- Update inventory levels for each line
  FOR v_line IN
    SELECT item_id, qty_packs, pack_price FROM purchase_order_lines WHERE purchase_order_id = _po_id
  LOOP
    -- Update or insert inventory_item_location
    INSERT INTO inventory_item_location (item_id, location_id, on_hand, par_level)
    VALUES (v_line.item_id, v_po.location_id, v_line.qty_packs, 0)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET on_hand = inventory_item_location.on_hand + EXCLUDED.on_hand;

    -- Record stock movement
    INSERT INTO stock_movements (
      org_id, location_id, inventory_item_id,
      movement_type, qty_delta, unit_cost, notes
    ) VALUES (
      v_po.org_id, v_po.location_id, v_line.item_id,
      'purchase', v_line.qty_packs, COALESCE(v_line.pack_price, 0),
      'PO delivery: ' || _po_id::text
    );

    -- Update last_cost on item
    IF v_line.pack_price IS NOT NULL AND v_line.pack_price > 0 THEN
      UPDATE inventory_items SET last_cost = v_line.pack_price WHERE id = v_line.item_id;
    END IF;
  END LOOP;
END;
$$;

-- ─── 8. add_loyalty_points ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_member_id uuid,
  p_points integer,
  p_reason text DEFAULT 'purchase'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  UPDATE loyalty_members
  SET points_balance = points_balance + p_points,
      points_earned = points_earned + p_points,
      updated_at = now()
  WHERE id = p_member_id
  RETURNING points_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loyalty member not found: %', p_member_id;
  END IF;

  -- Log transaction
  INSERT INTO loyalty_transactions (member_id, points, type, description)
  VALUES (p_member_id, p_points, 'earn', p_reason);

  RETURN jsonb_build_object(
    'ok', true,
    'points_added', p_points,
    'new_balance', v_new_balance
  );
END;
$$;

-- ─── 9. pricing_omnes_summary ────────────────────────────────────────────
-- Calculates Omnes pricing analysis by category
CREATE OR REPLACE FUNCTION pricing_omnes_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'auto',
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_cat record;
BEGIN
  FOR v_cat IN
    SELECT DISTINCT COALESCE(mi.category, 'Other') AS cat
    FROM menu_items mi
    WHERE (p_category IS NULL OR COALESCE(mi.category, 'Other') = p_category)
    ORDER BY cat
  LOOP
    DECLARE
      v_items jsonb;
      v_min numeric; v_max numeric; v_count integer;
      v_range numeric; v_band_width numeric;
      v_lower_max numeric; v_middle_max numeric;
      v_lower_ct integer; v_middle_ct integer; v_upper_ct integer;
      v_avg_price numeric; v_avg_check numeric;
    BEGIN
      -- Get items in this category with sales data
      SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
          'name', sub.name,
          'category', sub.category,
          'listed_price', sub.selling_price,
          'units_sold', sub.units_sold,
          'item_revenue', sub.revenue,
          'band', CASE
            WHEN sub.selling_price <= sub.lower_band THEN 'lower'
            WHEN sub.selling_price <= sub.middle_band THEN 'middle'
            ELSE 'upper'
          END,
          'is_promotion_candidate', sub.selling_price > sub.middle_band
        ) ORDER BY sub.selling_price), '[]'::jsonb),
        MIN(sub.selling_price), MAX(sub.selling_price), COUNT(*)::integer,
        AVG(sub.selling_price), AVG(NULLIF(sub.avg_ticket, 0))
      INTO v_items, v_min, v_max, v_count, v_avg_price, v_avg_check
      FROM (
        SELECT
          mi.id, mi.name, mi.category,
          COALESCE(mi.selling_price, 0) AS selling_price,
          COALESCE(s.qty, 0) AS units_sold,
          COALESCE(s.rev, 0) AS revenue,
          COALESCE(s.avg_ticket, 0) AS avg_ticket,
          MIN(COALESCE(mi.selling_price, 0)) OVER () +
            (MAX(COALESCE(mi.selling_price, 0)) OVER () - MIN(COALESCE(mi.selling_price, 0)) OVER ()) / 3.0 AS lower_band,
          MIN(COALESCE(mi.selling_price, 0)) OVER () +
            2.0 * (MAX(COALESCE(mi.selling_price, 0)) OVER () - MIN(COALESCE(mi.selling_price, 0)) OVER ()) / 3.0 AS middle_band
        FROM menu_items mi
        LEFT JOIN LATERAL (
          SELECT
            SUM(ps.quantity_sold) AS qty,
            SUM(ps.total_revenue) AS rev,
            AVG(ps.avg_ticket) AS avg_ticket
          FROM product_sales ps
          WHERE ps.product_name = mi.name
            AND ps.sale_date BETWEEN p_date_from AND p_date_to
            AND (p_location_id IS NULL OR ps.location_id = p_location_id)
        ) s ON true
        WHERE COALESCE(mi.category, 'Other') = v_cat.cat
          AND COALESCE(mi.selling_price, 0) > 0
      ) sub;

      IF v_count < 2 THEN CONTINUE; END IF;

      v_range := v_max - v_min;
      v_band_width := v_range / 3.0;
      v_lower_max := v_min + v_band_width;
      v_middle_max := v_min + 2 * v_band_width;

      SELECT COUNT(*) INTO v_lower_ct FROM menu_items
        WHERE COALESCE(category, 'Other') = v_cat.cat AND COALESCE(selling_price, 0) BETWEEN v_min AND v_lower_max;
      SELECT COUNT(*) INTO v_middle_ct FROM menu_items
        WHERE COALESCE(category, 'Other') = v_cat.cat AND COALESCE(selling_price, 0) > v_lower_max AND selling_price <= v_middle_max;
      SELECT COUNT(*) INTO v_upper_ct FROM menu_items
        WHERE COALESCE(category, 'Other') = v_cat.cat AND COALESCE(selling_price, 0) > v_middle_max;

      v_result := v_result || jsonb_build_object(
        'category', v_cat.cat,
        'item_count', v_count,
        'min_price', ROUND(v_min, 2),
        'max_price', ROUND(v_max, 2),
        'price_range_ratio', CASE WHEN v_min > 0 THEN ROUND(v_max / v_min, 2) ELSE 0 END,
        'price_range_state', CASE
          WHEN v_range < 2 THEN 'too_narrow'
          WHEN v_max / GREATEST(v_min, 0.01) > 3 THEN 'too_wide'
          ELSE 'optimal' END,
        'range_length', ROUND(v_range, 2),
        'band_width', ROUND(v_band_width, 2),
        'lower_band_max', ROUND(v_lower_max, 2),
        'middle_band_max', ROUND(v_middle_max, 2),
        'lower_band_count', v_lower_ct,
        'middle_band_count', v_middle_ct,
        'upper_band_count', v_upper_ct,
        'lower_band_pct', ROUND(v_lower_ct::numeric / GREATEST(v_count, 1) * 100, 1),
        'middle_band_pct', ROUND(v_middle_ct::numeric / GREATEST(v_count, 1) * 100, 1),
        'upper_band_pct', ROUND(v_upper_ct::numeric / GREATEST(v_count, 1) * 100, 1),
        'band_distribution_state', CASE
          WHEN v_middle_ct::numeric / GREATEST(v_count, 1) > 0.5 THEN 'balanced'
          WHEN v_lower_ct > v_upper_ct * 2 THEN 'bottom_heavy'
          WHEN v_upper_ct > v_lower_ct * 2 THEN 'top_heavy'
          ELSE 'balanced' END,
        'average_check_per_plate', ROUND(COALESCE(v_avg_check, v_avg_price), 2),
        'average_menu_price', ROUND(COALESCE(v_avg_price, 0), 2),
        'category_ratio', CASE WHEN v_avg_price > 0 THEN ROUND(COALESCE(v_avg_check, v_avg_price) / v_avg_price, 2) ELSE 1 END,
        'pricing_health_state', CASE
          WHEN v_range < 2 THEN 'needs_attention'
          WHEN v_middle_ct::numeric / GREATEST(v_count, 1) >= 0.4 THEN 'healthy'
          ELSE 'review' END,
        'promotion_zone', CASE
          WHEN v_upper_ct > v_count * 0.4 THEN 'upper'
          WHEN v_lower_ct > v_count * 0.4 THEN 'lower'
          ELSE 'none' END,
        'items', v_items
      );
    END;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── 10. audit_data_coherence ────────────────────────────────────────────
-- Runs data quality checks for the debug page
CREATE OR REPLACE FUNCTION audit_data_coherence(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_orphan_count integer;
  v_dup_count integer;
BEGIN
  -- Check 1: Orphan employees (no location)
  SELECT COUNT(*) INTO v_orphan_count
  FROM employees e WHERE e.group_id = p_org_id AND e.location_id IS NULL;
  v_checks := v_checks || jsonb_build_object(
    'check', 'employees_have_location',
    'pass', v_orphan_count = 0,
    'detail', format('%s employees without location', v_orphan_count)
  );

  -- Check 2: Recipes with zero ingredients
  SELECT COUNT(*) INTO v_orphan_count
  FROM recipes r WHERE r.group_id = p_org_id
  AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = r.id);
  v_checks := v_checks || jsonb_build_object(
    'check', 'recipes_have_ingredients',
    'pass', v_orphan_count = 0,
    'detail', format('%s recipes without ingredients', v_orphan_count)
  );

  -- Check 3: Daily sales coverage (last 7 days)
  SELECT COUNT(DISTINCT date) INTO v_orphan_count
  FROM daily_sales
  WHERE location_id IN (SELECT id FROM locations WHERE org_id = p_org_id)
  AND date >= CURRENT_DATE - 7;
  v_checks := v_checks || jsonb_build_object(
    'check', 'daily_sales_coverage_7d',
    'pass', v_orphan_count >= 5,
    'detail', format('%s of 7 days with sales data', v_orphan_count)
  );

  -- Check 4: Time entries vs clock records sync
  SELECT COUNT(*) INTO v_orphan_count
  FROM employee_clock_records ecr
  WHERE ecr.org_id = p_org_id
  AND NOT EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te.employee_id = ecr.employee_id AND te.date = ecr.clock_in::date
  );
  v_checks := v_checks || jsonb_build_object(
    'check', 'clock_records_synced',
    'pass', v_orphan_count = 0,
    'detail', format('%s unsynced clock records', v_orphan_count)
  );

  -- Check 5: COGS daily coverage
  SELECT COUNT(DISTINCT date) INTO v_orphan_count
  FROM cogs_daily
  WHERE location_id IN (SELECT id FROM locations WHERE org_id = p_org_id)
  AND date >= CURRENT_DATE - 7;
  v_checks := v_checks || jsonb_build_object(
    'check', 'cogs_daily_coverage_7d',
    'pass', v_orphan_count >= 5,
    'detail', format('%s of 7 days with COGS data', v_orphan_count)
  );

  -- Check 6: Duplicate time entries
  SELECT COUNT(*) INTO v_dup_count FROM (
    SELECT employee_id, date, COUNT(*) AS cnt
    FROM time_entries
    WHERE org_id = p_org_id
    GROUP BY employee_id, date
    HAVING COUNT(*) > 1
  ) dups;
  v_checks := v_checks || jsonb_build_object(
    'check', 'no_duplicate_time_entries',
    'pass', v_dup_count = 0,
    'detail', format('%s duplicate time entry rows', v_dup_count)
  );

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'checked_at', now(),
    'checks', v_checks,
    'all_pass', NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_checks) c WHERE (c->>'pass')::boolean IS FALSE
    )
  );
END;
$$;

-- ─── 11. rpc_reconciliation_summary ──────────────────────────────────────
-- Aggregated stock reconciliation data
CREATE OR REPLACE VIEW mart_stock_count_headers AS
SELECT
  sc.id, sc.group_id, sc.location_id,
  l.name AS location_name,
  sc.start_date, sc.end_date, sc.status,
  sc.created_at, sc.updated_at,
  COUNT(scl.id)::integer AS line_count,
  COALESCE(SUM(scl.variance_qty), 0)::numeric AS total_variance_qty
FROM stock_counts sc
JOIN locations l ON l.id = sc.location_id
LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
GROUP BY sc.id, sc.group_id, sc.location_id, l.name,
         sc.start_date, sc.end_date, sc.status,
         sc.created_at, sc.updated_at;

CREATE OR REPLACE VIEW mart_stock_count_lines_enriched AS
SELECT
  scl.id, scl.stock_count_id,
  sc.group_id, sc.location_id,
  sc.start_date, sc.end_date,
  sc.status AS count_status,
  scl.inventory_item_id,
  ii.name AS item_name, ii.unit,
  COALESCE(ii.last_cost, 0)::numeric AS unit_cost,
  COALESCE(scl.opening_qty, 0)::numeric AS opening_qty,
  COALESCE(scl.deliveries_qty, 0)::numeric AS deliveries_qty,
  COALESCE(scl.transfers_net_qty, 0)::numeric AS transfers_net_qty,
  COALESCE(scl.closing_qty, 0)::numeric AS closing_qty,
  COALESCE(scl.used_qty, 0)::numeric AS used_qty,
  COALESCE(scl.sales_qty, 0)::numeric AS sales_qty,
  COALESCE(scl.variance_qty, 0)::numeric AS variance_qty,
  COALESCE(scl.batch_balance, 0)::numeric AS batch_balance,
  (COALESCE(scl.variance_qty, 0) * COALESCE(ii.last_cost, 0))::numeric AS variance_value
FROM stock_count_lines scl
JOIN stock_counts sc ON sc.id = scl.stock_count_id
JOIN inventory_items ii ON ii.id = scl.inventory_item_id;

CREATE OR REPLACE FUNCTION rpc_reconciliation_summary(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_lines jsonb;
  v_totals jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.start_date DESC), '[]'::jsonb)
  INTO v_headers
  FROM (
    SELECT mh.id, mh.location_id, mh.location_name,
           mh.start_date, mh.end_date, mh.status,
           mh.line_count, mh.total_variance_qty, mh.created_at
    FROM mart_stock_count_headers mh
    WHERE mh.group_id = p_org_id
      AND (p_location_ids IS NULL OR mh.location_id = ANY(p_location_ids))
      AND mh.start_date >= p_from AND mh.end_date <= p_to
      AND (p_status IS NULL OR mh.status = p_status)
  ) h;

  SELECT COALESCE(jsonb_agg(row_to_json(li)::jsonb ORDER BY li.item_name), '[]'::jsonb)
  INTO v_lines
  FROM (
    SELECT
      el.inventory_item_id, el.item_name, el.unit, el.unit_cost,
      SUM(el.opening_qty)::numeric AS opening_qty,
      SUM(el.deliveries_qty)::numeric AS deliveries_qty,
      SUM(el.transfers_net_qty)::numeric AS transfers_net_qty,
      SUM(el.closing_qty)::numeric AS closing_qty,
      SUM(el.used_qty)::numeric AS used_qty,
      SUM(el.sales_qty)::numeric AS sales_qty,
      SUM(el.variance_qty)::numeric AS variance_qty,
      SUM(el.batch_balance)::numeric AS batch_balance,
      SUM(el.variance_value)::numeric AS variance_value
    FROM mart_stock_count_lines_enriched el
    WHERE el.group_id = p_org_id
      AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
      AND el.start_date >= p_from AND el.end_date <= p_to
      AND (p_status IS NULL OR el.count_status = p_status)
    GROUP BY el.inventory_item_id, el.item_name, el.unit, el.unit_cost
  ) li;

  SELECT jsonb_build_object(
    'opening_qty', COALESCE(SUM(el.opening_qty), 0),
    'deliveries_qty', COALESCE(SUM(el.deliveries_qty), 0),
    'transfers_net_qty', COALESCE(SUM(el.transfers_net_qty), 0),
    'closing_qty', COALESCE(SUM(el.closing_qty), 0),
    'used_qty', COALESCE(SUM(el.used_qty), 0),
    'sales_qty', COALESCE(SUM(el.sales_qty), 0),
    'variance_qty', COALESCE(SUM(el.variance_qty), 0),
    'batch_balance', COALESCE(SUM(el.batch_balance), 0),
    'variance_value', COALESCE(SUM(el.variance_value), 0)
  ) INTO v_totals
  FROM mart_stock_count_lines_enriched el
  WHERE el.group_id = p_org_id
    AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
    AND el.start_date >= p_from AND el.end_date <= p_to
    AND (p_status IS NULL OR el.count_status = p_status);

  RETURN jsonb_build_object(
    'count_headers', v_headers,
    'lines', v_lines,
    'totals', v_totals
  );
END;
$$;

-- ─── Recipe summary view ─────────────────────────────────────────────────
DROP VIEW IF EXISTS recipe_summary;
CREATE VIEW recipe_summary AS
SELECT
  r.id, r.group_id, r.menu_item_name, r.selling_price,
  r.category, r.yield_qty, r.yield_unit, r.is_sub_recipe, r.created_at,
  COALESCE(ic.cnt, 0)::integer AS ingredient_count,
  get_recipe_food_cost(r.id) AS food_cost,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(get_recipe_food_cost(r.id) / r.selling_price * 100, 1)
    ELSE 0 END AS food_cost_pct
FROM recipes r
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS cnt
  FROM recipe_ingredients ri2
  WHERE ri2.menu_item_id = r.id
) ic ON true;

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION setup_new_owner(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_setup_completeness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recipe_food_cost(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recipe_ingredient_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_menu_item_id_for_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recipe_ingredients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION receive_purchase_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_loyalty_points(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION pricing_omnes_summary(date, date, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION audit_data_coherence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_reconciliation_summary(uuid, uuid[], date, date, text) TO authenticated;
GRANT SELECT ON recipe_summary TO anon, authenticated;
GRANT SELECT ON mart_stock_count_headers TO anon, authenticated;
GRANT SELECT ON mart_stock_count_lines_enriched TO anon, authenticated;
