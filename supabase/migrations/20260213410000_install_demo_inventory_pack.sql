-- install_demo_inventory_pack(p_location_id uuid)
--
-- Idempotent RPC that seeds a small set of demo inventory items and
-- stock_movements for a given location so the Low Stock widget has
-- something to display on day-1.
--
-- * Checks the caller's org via auth.uid() → profiles → groups → locations.
-- * Only inserts items if the org has < 2 inventory_items already.
-- * Only inserts movements if the location has 0 stock_movements.
-- * Returns { installed: bool, items_created: int, movements_created: int }.

CREATE OR REPLACE FUNCTION install_demo_inventory_pack(
  p_location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       uuid;
  v_items_before int;
  v_movements_before int;
  v_items_created int := 0;
  v_movements_created int := 0;
  v_supplier_id  uuid;
  v_item_ids     uuid[];
BEGIN
  -- -----------------------------------------------------------------------
  -- 1. Resolve org from location
  -- -----------------------------------------------------------------------
  SELECT l.group_id INTO v_org_id
  FROM locations l
  WHERE l.id = p_location_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'installed', false,
      'items_created', 0,
      'movements_created', 0,
      'error', 'location_not_found'
    );
  END IF;

  -- -----------------------------------------------------------------------
  -- 2. Guard: skip if org already has inventory items
  -- -----------------------------------------------------------------------
  SELECT count(*)::int INTO v_items_before
  FROM inventory_items
  WHERE org_id = v_org_id;

  IF v_items_before >= 2 THEN
    RETURN jsonb_build_object(
      'installed', false,
      'items_created', 0,
      'movements_created', 0,
      'error', 'items_already_exist'
    );
  END IF;

  -- -----------------------------------------------------------------------
  -- 3. Guard: skip if location already has stock movements
  -- -----------------------------------------------------------------------
  SELECT count(*)::int INTO v_movements_before
  FROM stock_movements
  WHERE location_id = p_location_id;

  IF v_movements_before > 0 THEN
    RETURN jsonb_build_object(
      'installed', false,
      'items_created', 0,
      'movements_created', 0,
      'error', 'movements_already_exist'
    );
  END IF;

  -- -----------------------------------------------------------------------
  -- 4. Create a demo supplier
  -- -----------------------------------------------------------------------
  INSERT INTO suppliers (id, org_id, name, contact_name, delivery_days, min_order_amount, lead_time_days, is_active)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Demo Proveedor S.L.', 'Demo Contact',
    ARRAY['monday','wednesday','friday'],
    50.00, 2, true
  )
  RETURNING id INTO v_supplier_id;

  -- -----------------------------------------------------------------------
  -- 5. Insert 8 demo inventory items
  -- -----------------------------------------------------------------------
  WITH new_items AS (
    INSERT INTO inventory_items (
      id, org_id, name, sku, type, category_name,
      main_supplier_id, order_unit, order_unit_qty, price,
      par_level, reorder_point, safety_stock,
      unit_of_measure, location_ids
    ) VALUES
      -- LOW STOCK items (will trigger alerts)
      (gen_random_uuid(), v_org_id, 'Aceite de Oliva Virgen Extra', 'AOVE-5L', 'food', 'Aceites',
       v_supplier_id, 'case', 4, 32.00,
       20, 8, 4, 'l', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Sal Maldon', 'SAL-250G', 'food', 'Condimentos',
       v_supplier_id, 'case', 12, 18.00,
       30, 10, 5, 'pack', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Pimentón de la Vera', 'PIM-500G', 'food', 'Especias',
       NULL, 'ea', 1, 6.50,
       15, 5, 2, 'pack', ARRAY[p_location_id]),
      -- NORMAL STOCK items
      (gen_random_uuid(), v_org_id, 'Harina de Trigo 00', 'HAR-25KG', 'food', 'Harinas',
       v_supplier_id, 'case', 1, 14.00,
       10, 4, 2, 'kg', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Tomate Triturado', 'TOM-2.5KG', 'food', 'Conservas',
       v_supplier_id, 'case', 6, 9.60,
       24, 8, 4, 'pack', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Cerveza Artesana Pale Ale', 'CPA-330ML', 'beverage', 'Cervezas',
       v_supplier_id, 'case', 24, 28.80,
       48, 12, 6, 'unit', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Servilletas Papel Kraft', 'SER-500', 'packaging', 'Desechables',
       NULL, 'pack', 500, 8.00,
       2000, 500, 200, 'unit', ARRAY[p_location_id]),
      (gen_random_uuid(), v_org_id, 'Vino Ribera del Duero Crianza', 'VRD-750ML', 'beverage', 'Vinos',
       v_supplier_id, 'case', 6, 42.00,
       18, 6, 3, 'unit', ARRAY[p_location_id])
    RETURNING id
  )
  SELECT array_agg(id) INTO v_item_ids FROM new_items;

  v_items_created := coalesce(array_length(v_item_ids, 1), 0);

  -- -----------------------------------------------------------------------
  -- 6. Insert stock_movements for demo realism
  --    LOW STOCK: small purchase + heavy usage => triggers alerts
  --    NORMAL:    larger purchase + moderate usage => healthy levels
  -- -----------------------------------------------------------------------

  -- Item 1 (AOVE): purchase 16, usage 14 => on_hand = 2 (below reorder 8) → CRITICAL
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[1], 'purchase', 16, 'l', 128.00, 'Demo purchase', now() - interval '20 days'),
    (p_location_id, v_item_ids[1], 'usage', 14, 'l', NULL, 'Demo usage', now() - interval '2 days');

  -- Item 2 (Sal Maldon): purchase 24, usage 18 => on_hand = 6 (below reorder 10) → HIGH
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[2], 'purchase', 24, 'pack', 36.00, 'Demo purchase', now() - interval '15 days'),
    (p_location_id, v_item_ids[2], 'usage', 18, 'pack', NULL, 'Demo usage', now() - interval '1 day');

  -- Item 3 (Pimentón): purchase 10, usage 7 => on_hand = 3 (below reorder 5) → HIGH
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[3], 'purchase', 10, 'pack', 65.00, 'Demo purchase', now() - interval '25 days'),
    (p_location_id, v_item_ids[3], 'usage', 7, 'pack', NULL, 'Demo usage', now() - interval '3 days');

  -- Item 4 (Harina): purchase 8, usage 2 => on_hand = 6 (above reorder 4) → OK
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[4], 'purchase', 8, 'kg', 112.00, 'Demo purchase', now() - interval '10 days'),
    (p_location_id, v_item_ids[4], 'usage', 2, 'kg', NULL, 'Demo usage', now() - interval '1 day');

  -- Item 5 (Tomate): purchase 18, usage 5 => on_hand = 13 (above reorder 8) → OK
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[5], 'purchase', 18, 'pack', 28.80, 'Demo purchase', now() - interval '12 days'),
    (p_location_id, v_item_ids[5], 'usage', 5, 'pack', NULL, 'Demo usage', now() - interval '2 days');

  -- Item 6 (Cerveza): purchase 48, usage 20 => on_hand = 28 (above reorder 12) → OK
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[6], 'purchase', 48, 'unit', 57.60, 'Demo purchase', now() - interval '8 days'),
    (p_location_id, v_item_ids[6], 'usage', 20, 'unit', NULL, 'Demo usage', now() - interval '1 day');

  -- Item 7 (Servilletas): purchase 2000, usage 800 => on_hand = 1200 (above reorder 500) → OK
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[7], 'purchase', 2000, 'unit', 32.00, 'Demo purchase', now() - interval '14 days'),
    (p_location_id, v_item_ids[7], 'usage', 800, 'unit', NULL, 'Demo usage', now() - interval '1 day');

  -- Item 8 (Vino): purchase 12, usage 9 => on_hand = 3 (below reorder 6) → HIGH
  INSERT INTO stock_movements (location_id, item_id, movement_type, quantity, unit, cost, notes, created_at)
  VALUES
    (p_location_id, v_item_ids[8], 'purchase', 12, 'unit', 84.00, 'Demo purchase', now() - interval '18 days'),
    (p_location_id, v_item_ids[8], 'usage', 9, 'unit', NULL, 'Demo usage', now() - interval '2 days');

  v_movements_created := 16; -- 8 items × 2 movements each

  -- -----------------------------------------------------------------------
  -- 7. Return summary
  -- -----------------------------------------------------------------------
  RETURN jsonb_build_object(
    'installed', true,
    'items_created', v_items_created,
    'movements_created', v_movements_created
  );
END;
$$;
