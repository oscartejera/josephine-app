-- ============================================================
-- COMPREHENSIVE SEED MIGRATION — Final v5
-- Populates empty operational tables for Insights pages.
-- Fixes PostgREST function overload ambiguity.
--
-- Tables seeded: employees, schedules, shifts, shift_assignments,
--   time_entries, menu_items, cdm_items, cdm_orders, cdm_order_lines,
--   stock_counts, stock_count_lines
--
-- NOTE: forecast_runs + forecast_points already have Feb 2026 data.
-- ============================================================

-- NOTE: Do NOT drop rpc_kpi_range_summary(text[]) or get_instant_pnl_unified(text[]).
-- The text[] version is the primary overload used by the frontend.
-- A uuid[] overload of get_instant_pnl_unified also exists and is safe.


-- ============================================================
-- MAIN SEED BLOCK
-- ============================================================
DO $$
DECLARE
  v_org_id     uuid;
  v_loc_ids    uuid[];
  v_loc_id     uuid;
  v_loc_name   text;
  v_loc_idx    int;
  v_day        date;
  v_day_of_week int;
  v_is_weekend boolean;
  v_daily_sales numeric;

  v_emp_ids    uuid[] := ARRAY[
    'e0000001-0000-0000-0000-000000000001'::uuid,
    'e0000001-0000-0000-0000-000000000002'::uuid,
    'e0000001-0000-0000-0000-000000000003'::uuid,
    'e0000001-0000-0000-0000-000000000004'::uuid,
    'e0000001-0000-0000-0000-000000000005'::uuid,
    'e0000001-0000-0000-0000-000000000006'::uuid,
    'e0000001-0000-0000-0000-000000000007'::uuid,
    'e0000001-0000-0000-0000-000000000008'::uuid
  ];
  v_emp_names  text[] := ARRAY[
    'Carlos Garcia', 'Maria Lopez', 'Pedro Martinez', 'Ana Rodriguez',
    'Luis Fernandez', 'Carmen Sanchez', 'Javier Ruiz', 'Elena Torres'
  ];
  v_emp_roles  text[] := ARRAY[
    'Head Chef', 'Sous Chef', 'Line Cook', 'Line Cook',
    'Waiter', 'Waiter', 'Waiter', 'Host'
  ];
  v_emp_costs  numeric[] := ARRAY[22.00, 18.00, 14.50, 14.50, 13.00, 13.00, 12.50, 12.00];
  v_emp_idx    int;

  v_schedule_id uuid;
  v_shift_id    uuid;
  v_shift_start timestamptz;
  v_shift_end   timestamptz;
  v_clock_in    timestamptz;
  v_clock_out   timestamptz;
  v_sc_id       uuid;

  v_mi_names    text[] := ARRAY[
    'Jamon Iberico','Croquetas de Jamon','Pimientos de Padron','Tortilla Espanola',
    'Gazpacho','Paella Valenciana','Chuleton de Buey','Bacalao al Pil-Pil',
    'Pulpo a la Gallega','Cochinillo Asado','Cerveza Estrella Galicia',
    'Tinto de Verano','Ribera del Duero','Tarta de Queso','Crema Catalana'
  ];
  v_mi_cats     text[] := ARRAY[
    'Entrantes','Entrantes','Entrantes','Entrantes','Entrantes',
    'Principales','Principales','Principales','Principales','Principales',
    'Bebidas','Bebidas','Vinos','Postres','Postres'
  ];
  v_mi_prices   numeric[] := ARRAY[18.50,9.50,8.00,10.00,7.50,22.00,32.00,24.00,19.50,28.00,3.50,4.00,6.50,8.50,7.50];
  v_mi_id       uuid;
  v_mi_idx      int;

  v_order_id    uuid;
  v_order_time  timestamptz;
  v_order_idx   int;
  v_item_idx    int;
  v_chosen_item int;
  v_max_orders  int;
  v_item_count  int;
  v_week_start  date;

BEGIN
  SELECT id INTO v_org_id FROM groups LIMIT 1;
  IF v_org_id IS NULL THEN RAISE NOTICE 'No org.'; RETURN; END IF;

  SELECT array_agg(id ORDER BY name) INTO v_loc_ids
  FROM locations WHERE org_id = v_org_id AND active = true;
  IF v_loc_ids IS NULL OR array_length(v_loc_ids, 1) = 0 THEN RAISE NOTICE 'No locations.'; RETURN; END IF;

  RAISE NOTICE 'Seeding: org=%, locs=%', v_org_id, array_length(v_loc_ids, 1);

  -- 1. EMPLOYEES
  FOR v_emp_idx IN 1..8 LOOP
    INSERT INTO employees (id, org_id, full_name, email, role_name, hourly_cost, status)
    VALUES (
      v_emp_ids[v_emp_idx], v_org_id,
      v_emp_names[v_emp_idx],
      lower(replace(v_emp_names[v_emp_idx], ' ', '.')) || '@josephine.app',
      v_emp_roles[v_emp_idx], v_emp_costs[v_emp_idx], 'active'
    )
    ON CONFLICT (id) DO UPDATE SET hourly_cost = EXCLUDED.hourly_cost, role_name = EXCLUDED.role_name;
  END LOOP;
  RAISE NOTICE 'OK: 8 employees';

  -- 2. MENU ITEMS + CDM ITEMS
  FOR v_mi_idx IN 1..15 LOOP
    v_mi_id := ('d0000000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid;

    INSERT INTO menu_items (id, org_id, name, category, is_active)
    VALUES (v_mi_id, v_org_id, v_mi_names[v_mi_idx], v_mi_cats[v_mi_idx], true)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category;

    INSERT INTO cdm_items (id, org_id, name, category, is_active, external_id, metadata)
    VALUES (v_mi_id, v_org_id, v_mi_names[v_mi_idx], v_mi_cats[v_mi_idx],
            true, 'demo-item-' || v_mi_idx, '{}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category;
  END LOOP;
  RAISE NOTICE 'OK: 15 menu + cdm items';

  -- 3. PER-LOCATION DATA
  FOR v_loc_idx IN 1..array_length(v_loc_ids, 1) LOOP
    v_loc_id := v_loc_ids[v_loc_idx];
    SELECT name INTO v_loc_name FROM locations WHERE id = v_loc_id;

    -- Stock count
    v_sc_id := ('c0000000-0000-0000-0000-' || lpad(v_loc_idx::text, 12, '0'))::uuid;
    INSERT INTO stock_counts (id, group_id, location_id, start_date, end_date, status)
    VALUES (v_sc_id, v_org_id, v_loc_id, '2026-03-01', '2026-03-31', 'completed')
    ON CONFLICT (id) DO NOTHING;

    -- Stock count lines
    FOR v_mi_idx IN 1..15 LOOP
      v_mi_id := ('d0000000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid;
      INSERT INTO stock_count_lines (id, stock_count_id, inventory_item_id,
        opening_qty, deliveries_qty, transfers_net_qty, closing_qty, used_qty, sales_qty, variance_qty)
      VALUES (
        ('b00' || lpad(v_loc_idx::text, 2, '0') || '000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid,
        v_sc_id, v_mi_id,
        50+v_mi_idx*3, 30+v_mi_idx*2, 0, 25+v_mi_idx*2,
        (50+v_mi_idx*3+30+v_mi_idx*2)-(25+v_mi_idx*2),
        (50+v_mi_idx*3+30+v_mi_idx*2)-(25+v_mi_idx*2)-2, 2)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- WEEKLY SCHEDULES (Mon to Mon)
    v_week_start := '2026-03-02'::date;
    WHILE v_week_start <= '2026-03-30'::date LOOP
      v_schedule_id := gen_random_uuid();
      INSERT INTO schedules (id, org_id, location_id, week_start, status)
      VALUES (v_schedule_id, v_org_id, v_loc_id, v_week_start, 'published')
      ON CONFLICT DO NOTHING;

      -- DAILY LOOP
      v_day := v_week_start;
      WHILE v_day < v_week_start + 7 AND v_day <= LEAST('2026-03-31'::date, CURRENT_DATE) LOOP
        v_day_of_week := EXTRACT(DOW FROM v_day)::int;
        v_is_weekend := v_day_of_week IN (0, 5, 6);
        v_daily_sales := CASE WHEN v_is_weekend
          THEN 3200 + v_loc_idx * 200 + (random() * 400 - 200)
          ELSE 2200 + v_loc_idx * 150 + (random() * 300 - 150)
        END;

        -- Morning shift (kitchen 08-16)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 08:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 16:00:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 3)
        ON CONFLICT (id) DO NOTHING;
        FOR v_emp_idx IN 1..3 LOOP
          INSERT INTO shift_assignments (shift_id, employee_id)
          VALUES (v_shift_id, v_emp_ids[v_emp_idx])
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Evening shift (floor 16-00)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 16:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 23:59:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 4)
        ON CONFLICT (id) DO NOTHING;
        FOR v_emp_idx IN 4..7 LOOP
          INSERT INTO shift_assignments (shift_id, employee_id)
          VALUES (v_shift_id, v_emp_ids[v_emp_idx])
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Host shift (11-23)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 11:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 23:00:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 1)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO shift_assignments (shift_id, employee_id)
        VALUES (v_shift_id, v_emp_ids[8])
        ON CONFLICT DO NOTHING;

        -- Time entries: kitchen (08-16)
        FOR v_emp_idx IN 1..3 LOOP
          v_clock_in  := (v_day::text || ' 07:45:00+01')::timestamptz + make_interval(mins => (random()*20)::int);
          v_clock_out := (v_day::text || ' 16:00:00+01')::timestamptz + make_interval(mins => (random()*30-10)::int);
          INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
          VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[v_emp_idx], v_clock_in, v_clock_out, 'app')
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Time entries: floor (16-00)
        FOR v_emp_idx IN 4..7 LOOP
          v_clock_in  := (v_day::text || ' 15:50:00+01')::timestamptz + make_interval(mins => (random()*15)::int);
          v_clock_out := (v_day::text || ' 23:50:00+01')::timestamptz + make_interval(mins => (random()*20)::int);
          INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
          VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[v_emp_idx], v_clock_in, v_clock_out, 'app')
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Time entry: host (11-23)
        v_clock_in  := (v_day::text || ' 10:55:00+01')::timestamptz + make_interval(mins => (random()*10)::int);
        v_clock_out := (v_day::text || ' 22:55:00+01')::timestamptz + make_interval(mins => (random()*15)::int);
        INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
        VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[8], v_clock_in, v_clock_out, 'app')
        ON CONFLICT DO NOTHING;

        -- CDM Orders + Lines (Menu Engineering)
        v_max_orders := CASE WHEN v_is_weekend THEN 8 ELSE 5 END;
        FOR v_order_idx IN 1..v_max_orders LOOP
          v_order_id := gen_random_uuid();
          v_order_time := (v_day::text || ' ' || lpad((12 + v_order_idx % 10)::text, 2, '0') || ':' || lpad((v_order_idx * 7 % 60)::text, 2, '0') || ':00+01')::timestamptz;

          INSERT INTO cdm_orders (id, org_id, location_id, opened_at, closed_at, net_sales, gross_sales, discounts, external_id, metadata)
          VALUES (v_order_id, v_org_id, v_loc_id, v_order_time, v_order_time + interval '45 minutes',
                  v_daily_sales / v_max_orders, v_daily_sales / v_max_orders * 1.05,
                  v_daily_sales / v_max_orders * 0.05,
                  'demo-ord-' || v_loc_idx || '-' || v_day || '-' || v_order_idx, '{}'::jsonb)
          ON CONFLICT DO NOTHING;

          v_item_count := 2 + (v_order_idx % 3);
          FOR v_item_idx IN 1..v_item_count LOOP
            v_chosen_item := ((v_order_idx + v_item_idx + v_loc_idx) % 15) + 1;
            INSERT INTO cdm_order_lines (id, org_id, order_id, item_id, name, qty, gross, net, metadata)
            VALUES (gen_random_uuid(), v_org_id, v_order_id,
                    ('d0000000-0000-0000-0000-' || lpad(v_chosen_item::text, 12, '0'))::uuid,
                    v_mi_names[v_chosen_item],
                    1 + (v_item_idx % 3),
                    v_mi_prices[v_chosen_item] * (1 + (v_item_idx % 3)),
                    v_mi_prices[v_chosen_item] * (1 + (v_item_idx % 3)) * 0.95,
                    '{}'::jsonb)
            ON CONFLICT DO NOTHING;
          END LOOP;
        END LOOP;

        v_day := v_day + 1;
      END LOOP; -- daily

      v_week_start := v_week_start + 7;
    END LOOP; -- weekly

    RAISE NOTICE 'OK: Location %: %', v_loc_idx, v_loc_name;
  END LOOP; -- locations

  RAISE NOTICE 'All seed data inserted';
END $$;


-- Refresh materialized views to capture new CDM data
REFRESH MATERIALIZED VIEW product_sales_daily_unified_mv;
REFRESH MATERIALIZED VIEW sales_hourly_unified_mv;
REFRESH MATERIALIZED VIEW mart_kpi_daily_mv;
REFRESH MATERIALIZED VIEW mart_sales_category_daily_mv;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
