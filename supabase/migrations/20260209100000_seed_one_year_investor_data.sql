-- ====================================================================
-- SEED 1 YEAR OF REALISTIC DATA FOR INVESTOR DEMO
-- This populates: products, product_sales_daily, inventory_items,
-- waste_events, and calls seed_demo_labour_data(365) for all 7 daily
-- tables (pos_daily_finance, pos_daily_metrics, labour_daily,
-- forecast_daily_metrics, budgets_daily, cogs_daily, cash_counts_daily).
-- ====================================================================

DO $$
DECLARE
  v_group_id uuid;
  v_loc RECORD;
  v_product RECORD;
  v_inv_item RECORD;
  v_day date;
  v_dow int;
  v_product_ids uuid[];
  v_inv_item_ids uuid[];
  v_base_units numeric;
  v_units numeric;
  v_price numeric;
  v_cost_ratio numeric;
  v_net_sales numeric;
  v_cogs numeric;
  v_waste_qty numeric;
  v_waste_value numeric;
  v_reason text;
  v_reasons text[] := ARRAY['End of day','End of day','End of day','End of day','Expired','Expired','Broken','Broken','Other','Theft'];
  v_products_created int := 0;
  v_inv_items_created int := 0;
  v_psd_rows int := 0;
  v_waste_rows int := 0;
BEGIN
  -- 1. Get group_id from the first user's profile
  SELECT p.group_id INTO v_group_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at ASC LIMIT 1;

  IF v_group_id IS NULL THEN
    RAISE NOTICE 'ERROR: No group_id found. Run the access fix migration first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Group ID: %', v_group_id;

  -- ================================================================
  -- 2. CREATE PRODUCTS (if not enough exist)
  -- ================================================================
  IF (SELECT COUNT(*) FROM products WHERE group_id = v_group_id) < 20 THEN
    RAISE NOTICE 'Creating products...';

    INSERT INTO products (group_id, name, category, is_active) VALUES
      -- Food
      (v_group_id, 'Hamburguesa Clasica', 'Food', true),
      (v_group_id, 'Hamburguesa Gourmet', 'Food', true),
      (v_group_id, 'Pizza Margherita', 'Food', true),
      (v_group_id, 'Pizza Pepperoni', 'Food', true),
      (v_group_id, 'Ensalada Caesar', 'Food', true),
      (v_group_id, 'Ensalada Mediterranea', 'Food', true),
      (v_group_id, 'Pasta Carbonara', 'Food', true),
      (v_group_id, 'Pasta Bolognesa', 'Food', true),
      (v_group_id, 'Salmon a la Plancha', 'Food', true),
      (v_group_id, 'Pollo al Horno', 'Food', true),
      (v_group_id, 'Tacos de Ternera', 'Food', true),
      (v_group_id, 'Nachos con Guacamole', 'Food', true),
      (v_group_id, 'Wrap de Pollo', 'Food', true),
      (v_group_id, 'Bowl de Poke', 'Food', true),
      (v_group_id, 'Patatas Bravas', 'Food', true),
      (v_group_id, 'Croquetas Jamon', 'Food', true),
      -- Beverages
      (v_group_id, 'Coca-Cola', 'Beverage', true),
      (v_group_id, 'Agua Mineral', 'Beverage', true),
      (v_group_id, 'Cerveza Artesana', 'Beverage', true),
      (v_group_id, 'Vino Tinto Copa', 'Beverage', true),
      (v_group_id, 'Limonada Natural', 'Beverage', true),
      (v_group_id, 'Cafe Espresso', 'Beverage', true),
      (v_group_id, 'Zumo de Naranja', 'Beverage', true),
      -- Desserts
      (v_group_id, 'Tarta de Queso', 'Dessert', true),
      (v_group_id, 'Brownie con Helado', 'Dessert', true),
      (v_group_id, 'Helado Artesano', 'Dessert', true)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_products_created = ROW_COUNT;
    RAISE NOTICE 'Products created: %', v_products_created;
  ELSE
    RAISE NOTICE 'Products already exist (% found)', (SELECT COUNT(*) FROM products WHERE group_id = v_group_id);
  END IF;

  -- Collect product IDs
  SELECT array_agg(id) INTO v_product_ids FROM products WHERE group_id = v_group_id AND is_active = true;
  RAISE NOTICE 'Active products: %', array_length(v_product_ids, 1);

  -- ================================================================
  -- 3. CREATE INVENTORY ITEMS (if not enough exist)
  -- ================================================================
  -- Check which column exists: group_id or org_id
  IF (SELECT COUNT(*) FROM inventory_items WHERE
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='group_id')
      THEN group_id = v_group_id
      ELSE org_id = v_group_id
    END
  ) < 15 THEN
    RAISE NOTICE 'Creating inventory items...';

    -- Use dynamic SQL to handle both group_id and org_id column names
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_items' AND column_name='group_id') THEN
      INSERT INTO inventory_items (group_id, name, unit, par_level, current_stock, last_cost) VALUES
        (v_group_id, 'Carne de Ternera (kg)', 'kg', 25, 18, 12.50),
        (v_group_id, 'Pechuga de Pollo (kg)', 'kg', 20, 14, 7.80),
        (v_group_id, 'Salmon Fresco (kg)', 'kg', 8, 5, 22.00),
        (v_group_id, 'Queso Mozzarella (kg)', 'kg', 10, 7, 8.50),
        (v_group_id, 'Lechuga Romana (ud)', 'ud', 30, 22, 1.20),
        (v_group_id, 'Tomate (kg)', 'kg', 15, 10, 2.80),
        (v_group_id, 'Patatas (kg)', 'kg', 40, 28, 1.50),
        (v_group_id, 'Cebolla (kg)', 'kg', 10, 7, 1.80),
        (v_group_id, 'Pasta Seca (kg)', 'kg', 15, 12, 2.20),
        (v_group_id, 'Harina (kg)', 'kg', 20, 15, 1.10),
        (v_group_id, 'Aceite de Oliva (ltr)', 'ltr', 10, 6, 6.50),
        (v_group_id, 'Leche Entera (ltr)', 'ltr', 20, 14, 0.95),
        (v_group_id, 'Huevos (docena)', 'docena', 10, 7, 3.20),
        (v_group_id, 'Pan de Hamburguesa (ud)', 'ud', 50, 35, 0.45),
        (v_group_id, 'Nata para Cocinar (ltr)', 'ltr', 8, 5, 2.80),
        (v_group_id, 'Mantequilla (kg)', 'kg', 5, 3, 8.00),
        (v_group_id, 'Cerveza Artesana (barril)', 'barril', 3, 2, 85.00),
        (v_group_id, 'Vino Tinto (botella)', 'botella', 12, 8, 6.50)
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO inventory_items (org_id, name, type, category_name, price, is_active) VALUES
        (v_group_id, 'Carne de Ternera (kg)', 'food', 'Fresh', 12.50, true),
        (v_group_id, 'Pechuga de Pollo (kg)', 'food', 'Fresh', 7.80, true),
        (v_group_id, 'Salmon Fresco (kg)', 'food', 'Fresh', 22.00, true),
        (v_group_id, 'Queso Mozzarella (kg)', 'food', 'Dairy', 8.50, true),
        (v_group_id, 'Lechuga Romana (ud)', 'food', 'Fresh', 1.20, true),
        (v_group_id, 'Tomate (kg)', 'food', 'Fresh', 2.80, true),
        (v_group_id, 'Patatas (kg)', 'food', 'Fresh', 1.50, true),
        (v_group_id, 'Cebolla (kg)', 'food', 'Fresh', 1.80, true),
        (v_group_id, 'Pasta Seca (kg)', 'food', 'Dry goods', 2.20, true),
        (v_group_id, 'Harina (kg)', 'food', 'Dry goods', 1.10, true),
        (v_group_id, 'Aceite de Oliva (ltr)', 'food', 'Dry goods', 6.50, true),
        (v_group_id, 'Leche Entera (ltr)', 'food', 'Dairy', 0.95, true),
        (v_group_id, 'Huevos (docena)', 'food', 'Fresh', 3.20, true),
        (v_group_id, 'Pan de Hamburguesa (ud)', 'food', 'Fresh', 0.45, true),
        (v_group_id, 'Nata para Cocinar (ltr)', 'food', 'Dairy', 2.80, true),
        (v_group_id, 'Mantequilla (kg)', 'food', 'Dairy', 8.00, true),
        (v_group_id, 'Cerveza Artesana (barril)', 'beverage', 'Beverage', 85.00, true),
        (v_group_id, 'Vino Tinto (botella)', 'beverage', 'Beverage', 6.50, true)
      ON CONFLICT DO NOTHING;
    END IF;

    GET DIAGNOSTICS v_inv_items_created = ROW_COUNT;
    RAISE NOTICE 'Inventory items created: %', v_inv_items_created;
  ELSE
    RAISE NOTICE 'Inventory items already exist';
  END IF;

  -- Collect inventory item IDs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_items' AND column_name='group_id') THEN
    SELECT array_agg(id) INTO v_inv_item_ids FROM inventory_items WHERE group_id = v_group_id;
  ELSE
    SELECT array_agg(id) INTO v_inv_item_ids FROM inventory_items WHERE org_id = v_group_id;
  END IF;

  RAISE NOTICE 'Inventory items: %', COALESCE(array_length(v_inv_item_ids, 1), 0);

  -- ================================================================
  -- 4. GENERATE 365 DAYS OF product_sales_daily
  -- ================================================================
  RAISE NOTICE 'Generating product_sales_daily (365 days)...';

  -- Delete existing product_sales_daily for this group's locations
  DELETE FROM product_sales_daily
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);

  FOR v_loc IN SELECT id, name FROM locations WHERE group_id = v_group_id AND active = true LOOP
    FOR v_day IN SELECT generate_series(
      CURRENT_DATE - interval '365 days',
      CURRENT_DATE - interval '1 day',
      '1 day'
    )::date LOOP
      v_dow := EXTRACT(DOW FROM v_day);

      FOR i IN 1..array_length(v_product_ids, 1) LOOP
        -- Base units vary by product rank (top sellers sell more)
        v_base_units := GREATEST(5, 50 - (i * 1.5) + random() * 10);

        -- Day-of-week multiplier
        v_base_units := v_base_units * CASE v_dow
          WHEN 5 THEN 1.35 + random() * 0.15  -- Friday
          WHEN 6 THEN 1.45 + random() * 0.20  -- Saturday
          WHEN 0 THEN 1.10 + random() * 0.15  -- Sunday
          WHEN 1 THEN 0.75 + random() * 0.10  -- Monday
          ELSE 0.90 + random() * 0.15          -- Tue-Thu
        END;

        -- Seasonal variation (±15%)
        v_base_units := v_base_units * (1.0 + 0.15 * SIN(EXTRACT(DOY FROM v_day) * 2 * PI() / 365));

        v_units := ROUND(v_base_units * (0.80 + random() * 0.40));

        -- Price based on product category (index-based approximation)
        v_price := CASE
          WHEN i <= 2 THEN 12.50 + random() * 3   -- Burgers
          WHEN i <= 4 THEN 11.00 + random() * 3   -- Pizza
          WHEN i <= 6 THEN 9.50 + random() * 2    -- Salads
          WHEN i <= 8 THEN 10.50 + random() * 2   -- Pasta
          WHEN i <= 10 THEN 14.00 + random() * 4  -- Fish/Chicken
          WHEN i <= 14 THEN 8.50 + random() * 3   -- Tacos/Wraps/Bowls
          WHEN i <= 16 THEN 5.50 + random() * 2   -- Tapas
          WHEN i <= 23 THEN 3.00 + random() * 2   -- Beverages
          ELSE 5.50 + random() * 2                 -- Desserts
        END;

        v_cost_ratio := CASE
          WHEN i <= 16 THEN 0.28 + random() * 0.08  -- Food ~28-36%
          WHEN i <= 23 THEN 0.18 + random() * 0.10  -- Beverages ~18-28%
          ELSE 0.25 + random() * 0.08                -- Desserts ~25-33%
        END;

        v_net_sales := ROUND((v_units * v_price)::numeric, 2);
        v_cogs := ROUND((v_net_sales * v_cost_ratio)::numeric, 2);

        IF v_units > 0 THEN
          INSERT INTO product_sales_daily (date, location_id, product_id, units_sold, net_sales, cogs)
          VALUES (v_day, v_loc.id, v_product_ids[i], v_units, v_net_sales, v_cogs);
          v_psd_rows := v_psd_rows + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'product_sales_daily rows inserted: %', v_psd_rows;

  -- ================================================================
  -- 5. GENERATE 365 DAYS OF waste_events
  -- ================================================================
  IF v_inv_item_ids IS NOT NULL AND array_length(v_inv_item_ids, 1) > 0 THEN
    RAISE NOTICE 'Generating waste_events (365 days)...';

    -- Delete existing waste events for this group's locations
    DELETE FROM waste_events
    WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);

    FOR v_loc IN SELECT id, name FROM locations WHERE group_id = v_group_id AND active = true LOOP
      FOR v_day IN SELECT generate_series(
        CURRENT_DATE - interval '365 days',
        CURRENT_DATE - interval '1 day',
        '1 day'
      )::date LOOP
        -- 3-8 waste events per location per day
        FOR i IN 1..FLOOR(3 + random() * 5)::int LOOP
          v_waste_qty := ROUND((0.2 + random() * 4)::numeric, 2);
          v_waste_value := ROUND((v_waste_qty * (2 + random() * 15))::numeric, 2);
          v_reason := v_reasons[1 + FLOOR(random() * array_length(v_reasons, 1))::int];

          INSERT INTO waste_events (
            location_id, inventory_item_id, quantity, reason, waste_value, created_at
          ) VALUES (
            v_loc.id,
            v_inv_item_ids[1 + FLOOR(random() * array_length(v_inv_item_ids, 1))::int],
            v_waste_qty,
            v_reason,
            v_waste_value,
            (v_day + (interval '8 hours' + random() * interval '12 hours'))::timestamptz
          );
          v_waste_rows := v_waste_rows + 1;
        END LOOP;
      END LOOP;
    END LOOP;

    RAISE NOTICE 'waste_events rows inserted: %', v_waste_rows;
  ELSE
    RAISE NOTICE 'WARNING: No inventory items found, skipping waste_events';
  END IF;

  -- ================================================================
  -- 6. POPULATE ALL 7 DAILY TABLES (365 days)
  -- Uses seed_demo_labour_data RPC which handles:
  -- pos_daily_finance, pos_daily_metrics, labour_daily,
  -- forecast_daily_metrics, budgets_daily, cogs_daily, cash_counts_daily
  -- ================================================================
  RAISE NOTICE 'Calling seed_demo_labour_data(365) for all 7 daily tables...';

  PERFORM seed_demo_labour_data(365, 10);

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED COMPLETE';
  RAISE NOTICE 'Products: %', COALESCE(array_length(v_product_ids, 1), 0);
  RAISE NOTICE 'Inventory items: %', COALESCE(array_length(v_inv_item_ids, 1), 0);
  RAISE NOTICE 'Product sales daily rows: %', v_psd_rows;
  RAISE NOTICE 'Waste events: %', v_waste_rows;
  RAISE NOTICE '7 daily tables: 365 days seeded via RPC';
  RAISE NOTICE '========================================';
END;
$$;
