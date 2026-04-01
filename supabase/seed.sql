-- =============================================================================
-- JOSEPHINE DB v2 — SEED DATA
-- Reproducible demo data for development & testing
-- Run via: supabase db reset (auto-runs migrations + seed.sql)
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- §1  CORE: Org, Locations, Settings
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO groups (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Josephine Demo Group', 'josephine-demo')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, org_id, name, address, timezone) VALUES
  ('57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'a0000000-0000-0000-0000-000000000001', 'Madrid Centro', 'Calle Gran Vía 42, Madrid', 'Europe/Madrid'),
  ('9c501324-66e4-40e8-bfcb-7cc855f3754e', 'a0000000-0000-0000-0000-000000000001', 'Barcelona Eixample', 'Passeig de Gràcia 55, Barcelona', 'Europe/Madrid'),
  ('9469ef7a-c1b1-4314-8349-d0ea253ba483', 'a0000000-0000-0000-0000-000000000001', 'Valencia Marina', 'Paseo Marítimo 12, Valencia', 'Europe/Madrid'),
  ('fe0717f7-6fa7-4e5e-8467-6c9585b03022', 'a0000000-0000-0000-0000-000000000001', 'Sevilla Triana', 'Calle Betis 28, Sevilla', 'Europe/Madrid')
ON CONFLICT DO NOTHING;

INSERT INTO location_settings (location_id, target_col_percent, splh_goal)
SELECT l.id, 30, 50 FROM locations l WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO org_settings (org_id, data_source_mode) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'auto')
ON CONFLICT DO NOTHING;

INSERT INTO legal_entities (id, org_id, name, cif) VALUES
  ('ee000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Josephine Restauración SL', 'B12345678')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2  WORKFORCE: Employees
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO employees (id, org_id, location_id, full_name, email, role_name, hourly_cost, status) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Carlos Garcia', 'carlos.garcia@josephine.app', 'Head Chef', 22.00, 'active'),
  ('e0000001-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Maria Lopez', 'maria.lopez@josephine.app', 'Sous Chef', 18.00, 'active'),
  ('e0000001-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Pedro Martinez', 'pedro.martinez@josephine.app', 'Line Cook', 14.50, 'active'),
  ('e0000001-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Ana Rodriguez', 'ana.rodriguez@josephine.app', 'Line Cook', 14.50, 'active'),
  ('e0000001-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Luis Fernandez', 'luis.fernandez@josephine.app', 'Waiter', 13.00, 'active'),
  ('e0000001-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Carmen Sanchez', 'carmen.sanchez@josephine.app', 'Waiter', 13.00, 'active'),
  ('e0000001-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Javier Ruiz', 'javier.ruiz@josephine.app', 'Waiter', 12.50, 'active'),
  ('e0000001-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', 'Elena Torres', 'elena.torres@josephine.app', 'Host', 12.00, 'active')
ON CONFLICT (id) DO UPDATE SET hourly_cost = EXCLUDED.hourly_cost, role_name = EXCLUDED.role_name, location_id = EXCLUDED.location_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3  MENU: Items & CDM catalog
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO menu_items (id, org_id, name, category, is_active) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Jamon Iberico', 'Entrantes', true),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Croquetas de Jamon', 'Entrantes', true),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Pimientos de Padron', 'Entrantes', true),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Tortilla Espanola', 'Entrantes', true),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Gazpacho', 'Entrantes', true),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Paella Valenciana', 'Principales', true),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Chuleton de Buey', 'Principales', true),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Bacalao al Pil-Pil', 'Principales', true),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Pulpo a la Gallega', 'Principales', true),
  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Cochinillo Asado', 'Principales', true),
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Cerveza Estrella Galicia', 'Bebidas', true),
  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Tinto de Verano', 'Bebidas', true),
  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Ribera del Duero', 'Vinos', true),
  ('d0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Tarta de Queso', 'Postres', true),
  ('d0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Crema Catalana', 'Postres', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

-- Mirror to CDM items
INSERT INTO cdm_items (id, org_id, name, category, external_id, is_active, metadata)
SELECT id, org_id, name, category, 'demo-item-' || row_number() OVER (), true, '{}'::jsonb
FROM menu_items WHERE org_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;


-- ═══════════════════════════════════════════════════════════════════════════
-- §4  INVENTORY: Items & Stock
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO inventory_items (id, org_id, name, category_name, unit, par_level, last_cost) VALUES
  (md5('demo-inv-Jamón Ibérico')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Jamón Ibérico', 'Proteínas', 'kg', 5.0, 42.00),
  (md5('demo-inv-Chuletón de Buey')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Chuletón de Buey', 'Proteínas', 'kg', 8.0, 32.00),
  (md5('demo-inv-Bacalao')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Bacalao', 'Proteínas', 'kg', 6.0, 18.00),
  (md5('demo-inv-Pulpo')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Pulpo', 'Proteínas', 'kg', 4.0, 22.00),
  (md5('demo-inv-Cerveza Estrella Galicia')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Cerveza Estrella Galicia', 'Bebidas', 'unidad', 120.0, 0.85),
  (md5('demo-inv-Ribera del Duero')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Ribera del Duero', 'Vinos', 'botella', 24.0, 8.50),
  (md5('demo-inv-Tomates')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Tomates', 'Frescos', 'kg', 10.0, 2.50),
  (md5('demo-inv-Aceite de Oliva Virgen')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Aceite de Oliva Virgen', 'Despensa', 'litro', 15.0, 4.50),
  (md5('demo-inv-Patatas')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Patatas', 'Frescos', 'kg', 25.0, 1.20),
  (md5('demo-inv-Lechuga')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Lechuga', 'Frescos', 'kg', 8.0, 2.00),
  (md5('demo-inv-Queso Manchego')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Queso Manchego', 'Lácteos', 'kg', 4.0, 14.00),
  (md5('demo-inv-Nata')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Nata', 'Lácteos', 'litro', 6.0, 3.20),
  (md5('demo-inv-Chocolate Valrhona')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Chocolate Valrhona', 'Pastelería', 'kg', 3.0, 24.00),
  (md5('demo-inv-Tarta de Queso (base)')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Tarta de Queso (base)', 'Pastelería', 'unidad', 10.0, 4.50)
ON CONFLICT DO NOTHING;

-- Per-location stock levels
INSERT INTO inventory_item_location (id, item_id, location_id, on_hand, reorder_point, safety_stock)
SELECT md5(ii.id::text || '-' || l.id::text)::uuid, ii.id, l.id,
  ROUND(ii.par_level * (0.6 + (EXTRACT(DOY FROM CURRENT_DATE)::int * 7 % 60)::numeric / 100.0), 1),
  ROUND(ii.par_level * 0.4, 1), ROUND(ii.par_level * 0.2, 1)
FROM inventory_items ii CROSS JOIN locations l
WHERE l.active = true AND ii.org_id = l.org_id
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- §5  OPERATIONAL DATA (generated via PL/pgSQL)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_loc record; v_day date; v_dow int;
  v_lm numeric; v_ns numeric; v_gs numeric; v_oc integer;
  v_lh numeric; v_lc numeric; v_cg numeric; v_hr numeric; v_nm numeric;
  v_pc numeric; v_pk numeric; v_fs numeric; v_fo integer;
  v_sb numeric; v_sr numeric;
  v_emp_ids uuid[] := ARRAY[
    'e0000001-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000002',
    'e0000001-0000-0000-0000-000000000003','e0000001-0000-0000-0000-000000000004',
    'e0000001-0000-0000-0000-000000000005','e0000001-0000-0000-0000-000000000006',
    'e0000001-0000-0000-0000-000000000007','e0000001-0000-0000-0000-000000000008'
  ];
  v_mi_names text[] := ARRAY['Jamon Iberico','Croquetas de Jamon','Pimientos de Padron','Tortilla Espanola','Gazpacho',
    'Paella Valenciana','Chuleton de Buey','Bacalao al Pil-Pil','Pulpo a la Gallega','Cochinillo Asado',
    'Cerveza Estrella Galicia','Tinto de Verano','Ribera del Duero','Tarta de Queso','Crema Catalana'];
  v_mi_prices numeric[] := ARRAY[18.50,9.50,8.00,10.00,7.50,22.00,32.00,24.00,19.50,28.00,3.50,4.00,6.50,8.50,7.50];
  v_order_id uuid; v_order_time timestamptz;
  v_max_orders int; v_item_count int; v_chosen int;
  v_schedule_id uuid; v_shift_id uuid;
  v_week_start date; v_emp_idx int;
  v_is_future boolean;
BEGIN
  FOR v_loc IN
    SELECT id, (CASE id
      WHEN '57f62bae-4d5b-44b0-8055-fdde12ee5a96' THEN 1.15
      WHEN '9c501324-66e4-40e8-bfcb-7cc855f3754e' THEN 1.00
      WHEN '9469ef7a-c1b1-4314-8349-d0ea253ba483' THEN 0.90
      WHEN 'fe0717f7-6fa7-4e5e-8467-6c9585b03022' THEN 0.85
      ELSE 1.0 END)::numeric AS lm
    FROM locations WHERE active = true
  LOOP
    -- ─── Daily operational data (90 days back + 30 forward) ───
    FOR v_day IN SELECT generate_series((CURRENT_DATE - 90)::date, (CURRENT_DATE + 30)::date, '1 day')::date
    LOOP
      v_is_future := (v_day > CURRENT_DATE);
      v_dow := EXTRACT(DOW FROM v_day)::int;
      v_nm := 1.0 + (random()::numeric - 0.5) * 0.24;
      v_hr := 13.5 + random()::numeric * 3.0;

      -- Base sales by day of week
      IF v_dow = 0 THEN v_sb:=1100; v_sr:=400;
      ELSIF v_dow = 1 THEN v_sb:=1200; v_sr:=300;
      ELSIF v_dow = 2 THEN v_sb:=1350; v_sr:=350;
      ELSIF v_dow = 3 THEN v_sb:=1450; v_sr:=350;
      ELSIF v_dow = 4 THEN v_sb:=1650; v_sr:=400;
      ELSIF v_dow = 5 THEN v_sb:=2400; v_sr:=600;
      ELSIF v_dow = 6 THEN v_sb:=2800; v_sr:=700;
      END IF;

      v_ns := ROUND((v_sb + random()::numeric * v_sr) * v_loc.lm * v_nm, 2);
      v_oc := GREATEST(1, FLOOR(v_ns / 25))::integer;
      v_gs := ROUND(v_ns * 1.05, 2);
      v_pc := ROUND(v_ns * 0.25, 2);
      v_pk := ROUND(v_ns * 0.70, 2);
      v_lh := ROUND((18 + random()::numeric * 10) * v_loc.lm * v_nm, 2);
      v_lc := ROUND(v_lh * v_hr, 2);
      v_cg := ROUND(v_ns * (0.26 + random()::numeric * 0.04), 2);
      v_fs := ROUND(v_ns * (0.88 + random()::numeric * 0.24), 2);
      v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random()::numeric * 0.20)))::integer;

      IF NOT v_is_future THEN
        -- Daily sales
        INSERT INTO daily_sales (org_id, location_id, day, net_sales, gross_sales, orders_count,
          payments_total, payments_cash, payments_card, refunds, discounts, comps, voids, data_source)
        VALUES (v_org_id, v_loc.id, v_day, v_ns, v_gs, v_oc, v_ns, v_pc, v_pk,
          ROUND(v_ns*0.005,2), ROUND(v_ns*0.03,2), ROUND(v_ns*0.01,2), ROUND(v_ns*0.002,2), 'demo')
        ON CONFLICT (org_id, location_id, day) DO NOTHING;

        -- POS daily finance (legacy)
        INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
          payments_cash, payments_card, data_source)
        VALUES (v_day, v_loc.id, v_ns, v_gs, v_oc, v_pc, v_pk, 'demo')
        ON CONFLICT (date, location_id, data_source) DO NOTHING;

        -- Labour daily
        INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
        VALUES (v_day, v_loc.id, v_lc, v_lh)
        ON CONFLICT (date, location_id) DO UPDATE SET labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

        -- COGS daily
        INSERT INTO cogs_daily (location_id, date, cogs_amount)
        VALUES (v_loc.id, v_day, v_cg) ON CONFLICT DO NOTHING;

        -- Budget daily
        INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
        VALUES (v_day, v_loc.id, ROUND(v_sb*v_loc.lm*1.05,2), ROUND(v_sb*v_loc.lm*0.22,2), ROUND(v_sb*v_loc.lm*0.28,2))
        ON CONFLICT DO NOTHING;

        -- Time entries (8 employees, simplified)
        FOR v_emp_idx IN 1..8 LOOP
          INSERT INTO time_entries (org_id, location_id, employee_id, clock_in, clock_out, source)
          VALUES (v_org_id, v_loc.id, v_emp_ids[v_emp_idx],
            (v_day::text || CASE WHEN v_emp_idx <= 3 THEN ' 08:00+01' WHEN v_emp_idx <= 7 THEN ' 16:00+01' ELSE ' 11:00+01' END)::timestamptz,
            (v_day::text || CASE WHEN v_emp_idx <= 3 THEN ' 16:00+01' WHEN v_emp_idx <= 7 THEN ' 23:50+01' ELSE ' 23:00+01' END)::timestamptz,
            'app')
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- CDM Orders (for menu engineering)
        v_max_orders := CASE WHEN v_dow IN (5,6) THEN 8 ELSE 5 END;
        FOR v_emp_idx IN 1..v_max_orders LOOP
          v_order_id := gen_random_uuid();
          v_order_time := (v_day::text || ' ' || lpad((12 + v_emp_idx % 10)::text,2,'0') || ':00:00+01')::timestamptz;
          INSERT INTO cdm_orders (id, org_id, location_id, opened_at, closed_at, net_sales, gross_sales, external_id, metadata)
          VALUES (v_order_id, v_org_id, v_loc.id, v_order_time, v_order_time + interval '45 min',
            v_ns/v_max_orders, v_gs/v_max_orders, 'demo-'||v_day||'-'||v_emp_idx, '{}'::jsonb)
          ON CONFLICT DO NOTHING;

          v_item_count := 2 + (v_emp_idx % 3);
          FOR v_chosen IN 1..v_item_count LOOP
            INSERT INTO cdm_order_lines (org_id, order_id, item_id, name, qty, gross, net, metadata)
            VALUES (v_org_id, v_order_id,
              ('d0000000-0000-0000-0000-' || lpad(((v_emp_idx+v_chosen) % 15 + 1)::text,12,'0'))::uuid,
              v_mi_names[((v_emp_idx+v_chosen) % 15) + 1],
              1 + (v_chosen % 3),
              v_mi_prices[((v_emp_idx+v_chosen) % 15) + 1] * (1 + (v_chosen % 3)),
              v_mi_prices[((v_emp_idx+v_chosen) % 15) + 1] * (1 + (v_chosen % 3)) * 0.95,
              '{}'::jsonb)
            ON CONFLICT DO NOTHING;
          END LOOP;
        END LOOP;
      END IF;

      -- Forecast (both past & future)
      INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost)
      VALUES (v_day, v_loc.id, v_fs, v_fo, ROUND(v_lh*0.95,2), ROUND(v_lh*0.95*v_hr,2))
      ON CONFLICT DO NOTHING;

    END LOOP; -- days
  END LOOP; -- locations

  RAISE NOTICE 'Seed complete: 120 days × 4 locations';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §6  EVENTS, WASTE, CASH COUNTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO event_calendar (org_id, event_date, name, event_type, impact_multiplier, recurrence, city, source)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '2025-01-01', 'Año Nuevo', 'holiday', 0.60, 'yearly', NULL, 'system'),
  ('a0000000-0000-0000-0000-000000000001', '2025-01-06', 'Reyes Magos', 'holiday', 0.70, 'yearly', NULL, 'system'),
  ('a0000000-0000-0000-0000-000000000001', '2025-05-15', 'San Isidro', 'festival', 1.25, 'yearly', 'Madrid', 'system'),
  ('a0000000-0000-0000-0000-000000000001', '2025-12-24', 'Nochebuena', 'holiday', 1.40, 'yearly', NULL, 'system'),
  ('a0000000-0000-0000-0000-000000000001', '2025-12-31', 'Nochevieja', 'holiday', 1.50, 'yearly', NULL, 'system')
ON CONFLICT DO NOTHING;

-- Waste events
INSERT INTO waste_events (org_id, location_id, inventory_item_id, quantity, waste_value, reason, created_at)
SELECT l.org_id, l.id,
  md5('demo-inv-' || (ARRAY['Lechuga','Tomates','Nata','Bacalao','Patatas'])[1 + (seq + EXTRACT(DOY FROM d)::int) % 5])::uuid,
  (1 + (seq * 7 + EXTRACT(DOY FROM d)::int) % 5)::numeric * 0.5,
  (3 + (seq * 13 + EXTRACT(DOY FROM d)::int * 3) % 22)::numeric,
  CASE WHEN seq <= 2 THEN 'end_of_day' WHEN seq = 3 THEN 'expired' ELSE 'other' END,
  d + seq * interval '1 hour'
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval) AS d
CROSS JOIN generate_series(1, 4) AS seq
WHERE l.active = true
ON CONFLICT DO NOTHING;

-- Cash counts
INSERT INTO cash_counts_daily (org_id, location_id, date, cash_expected, cash_counted, variance)
SELECT l.org_id, l.id, d::date,
  CASE WHEN EXTRACT(DOW FROM d) IN (5,6) THEN 850 WHEN EXTRACT(DOW FROM d) = 0 THEN 700 ELSE 550 END,
  CASE WHEN EXTRACT(DOW FROM d) IN (5,6) THEN 850 + (EXTRACT(DOY FROM d)::int % 20 - 10)
       WHEN EXTRACT(DOW FROM d) = 0 THEN 700 + (EXTRACT(DOY FROM d)::int % 16 - 8)
       ELSE 550 + (EXTRACT(DOY FROM d)::int % 12 - 6) END,
  CASE WHEN EXTRACT(DOW FROM d) IN (5,6) THEN (EXTRACT(DOY FROM d)::int % 20 - 10)
       WHEN EXTRACT(DOW FROM d) = 0 THEN (EXTRACT(DOY FROM d)::int % 16 - 8)
       ELSE (EXTRACT(DOY FROM d)::int % 12 - 6) END
FROM locations l CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT (location_id, date) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- §7  REFRESH MVs
-- ═══════════════════════════════════════════════════════════════════════════

REFRESH MATERIALIZED VIEW product_sales_daily_unified_mv;
REFRESH MATERIALIZED VIEW sales_hourly_unified_mv;
REFRESH MATERIALIZED VIEW mart_kpi_daily_mv;
REFRESH MATERIALIZED VIEW mart_sales_category_daily_mv;
REFRESH MATERIALIZED VIEW product_sales_daily_unified_mv_v2;
REFRESH MATERIALIZED VIEW sales_hourly_unified_mv_v2;
