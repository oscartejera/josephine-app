-- ====================================================================
-- SEED DEMO DATA - Josephine Restaurant Group
-- Datos coherentes y realistas para demos e inversores
-- 60 días de operación con patrones realistas
-- ====================================================================

-- ============== PASO 1: LIMPIAR DATOS DEMO EXISTENTES ==============
-- Solo limpia si existe una marca de "demo data"
DELETE FROM facts_item_mix_daily WHERE location_id IN (
  SELECT id FROM locations WHERE name LIKE '%Demo%' OR name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM facts_labor_daily WHERE location_id IN (
  SELECT id FROM locations WHERE name LIKE '%Demo%' OR name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM facts_sales_15m WHERE location_id IN (
  SELECT id FROM locations WHERE name LIKE '%Demo%' OR name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM employees WHERE location_id IN (
  SELECT id FROM locations WHERE name LIKE '%Demo%' OR name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM cdm_items WHERE location_id IN (
  SELECT id FROM locations WHERE name LIKE '%Demo%' OR name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña');

-- ============== PASO 2: CREAR GRUPO Y LOCATIONS ==============
-- Insertar o obtener el grupo demo
DO $$
DECLARE
  v_group_id UUID;
  v_location_centro UUID;
  v_location_chamberi UUID;
  v_location_malasana UUID;
  v_org_id UUID;
  v_day_offset INT;
  v_current_date DATE;
  v_hour INT;
  v_minute INT;
  v_ts TIMESTAMPTZ;
  v_day_of_week INT;
  v_base_sales NUMERIC;
  v_sales_15m NUMERIC;
  v_tickets INT;
  v_covers INT;
  v_chef_id UUID;
  v_server_id UUID;
  v_bartender_id UUID;
  v_paella_id UUID;
  v_jamon_id UUID;
BEGIN
  -- Obtener el primer grupo existente (o crear uno demo)
  SELECT id INTO v_group_id FROM groups LIMIT 1;
  
  IF v_group_id IS NULL THEN
    INSERT INTO groups (name, created_at) 
    VALUES ('Josephine Restaurant Group', NOW())
    RETURNING id INTO v_group_id;
  END IF;

  -- Obtener org_id para cdm_items
  SELECT id INTO v_org_id FROM groups LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := v_group_id;
  END IF;

  -- Crear 3 locations
  INSERT INTO locations (id, group_id, name, city, timezone, currency, created_at)
  VALUES 
    (gen_random_uuid(), v_group_id, 'La Taberna Centro', 'Salamanca', 'Europe/Madrid', 'EUR', NOW()),
    (gen_random_uuid(), v_group_id, 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR', NOW()),
    (gen_random_uuid(), v_group_id, 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR', NOW())
  RETURNING id INTO v_location_centro;

  -- Obtener IDs de las locations
  SELECT id INTO v_location_centro FROM locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_location_chamberi FROM locations WHERE name = 'Chamberí';
  SELECT id INTO v_location_malasana FROM locations WHERE name = 'Malasaña';

  RAISE NOTICE 'Locations creadas: Centro=%, Chamberí=%, Malasaña=%', v_location_centro, v_location_chamberi, v_location_malasana;

  -- ============== PASO 3: CREAR PRODUCTOS (CDM_ITEMS) ==============
  -- La Taberna Centro - Premium Spanish cuisine
  INSERT INTO cdm_items (id, org_id, location_id, name, category_name, unit_price, cost_price, active, created_at)
  VALUES
    (gen_random_uuid(), v_org_id, v_location_centro, 'Paella Valenciana', 'Food', 24.50, 8.20, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Jamón Ibérico', 'Food', 18.90, 11.40, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Chuletón de Buey', 'Food', 38.50, 19.20, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Pulpo a la Gallega', 'Food', 22.80, 9.10, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Bacalao Pil-Pil', 'Food', 26.50, 10.60, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Rioja Reserva', 'Beverage', 28.00, 9.50, true, NOW()),
    (gen_random_uuid(), v_org_id, v_location_centro, 'Cerveza Alhambra', 'Beverage', 4.50, 1.20, true, NOW())
  RETURNING id INTO v_paella_id;

  -- Similar para otras locations (productos con precios ligeramente diferentes)
  INSERT INTO cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_org_id, v_location_chamberi, name, category_name, unit_price * 0.95, cost_price * 0.95, true
  FROM cdm_items WHERE location_id = v_location_centro;

  INSERT INTO cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_org_id, v_location_malasana, name, category_name, unit_price * 0.90, cost_price * 0.90, true
  FROM cdm_items WHERE location_id = v_location_centro;

  RAISE NOTICE 'Productos creados para 3 locations';

  -- ============== PASO 4: CREAR EMPLEADOS ==============
  -- La Taberna Centro - 8 Chefs, 12 Servers, 5 Bartenders, 3 Hosts, 2 Managers
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active, created_at)
  VALUES
    -- Chefs (€18/hour)
    (v_location_centro, 'Carlos García', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'María López', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Juan Martínez', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Ana Torres', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Pedro Sánchez', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Laura Fernández', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Miguel Ruiz', 'Chef', 18.00, true, NOW()),
    (v_location_centro, 'Carmen Díaz', 'Chef', 18.00, true, NOW()),
    -- Servers (€12/hour)
    (v_location_centro, 'David Rodríguez', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Sara Gómez', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Pablo Jiménez', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Elena Moreno', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Jorge Álvarez', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Lucía Romero', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Alberto Navarro', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Isabel Gil', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Francisco Serrano', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Patricia Molina', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Antonio Castro', 'Server', 12.00, true, NOW()),
    (v_location_centro, 'Rosa Ortiz', 'Server', 12.00, true, NOW()),
    -- Bartenders (€14/hour)
    (v_location_centro, 'Manuel Rubio', 'Bartender', 14.00, true, NOW()),
    (v_location_centro, 'Teresa Vega', 'Bartender', 14.00, true, NOW()),
    (v_location_centro, 'Luis Ramos', 'Bartender', 14.00, true, NOW()),
    (v_location_centro, 'Cristina Herrera', 'Bartender', 14.00, true, NOW()),
    (v_location_centro, 'Javier Mendoza', 'Bartender', 14.00, true, NOW()),
    -- Hosts (€11/hour)
    (v_location_centro, 'Beatriz Cruz', 'Host', 11.00, true, NOW()),
    (v_location_centro, 'Raúl Delgado', 'Host', 11.00, true, NOW()),
    (v_location_centro, 'Sofía Vargas', 'Host', 11.00, true, NOW()),
    -- Managers (€25/hour)
    (v_location_centro, 'Fernando Iglesias', 'Manager', 25.00, true, NOW()),
    (v_location_centro, 'Marta Cortés', 'Manager', 25.00, true, NOW())
  RETURNING id INTO v_chef_id;

  -- Replicar empleados para Chamberí y Malasaña (70% del staff de Centro)
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_location_chamberi, full_name || ' (CH)', role_name, hourly_cost, active
  FROM employees WHERE location_id = v_location_centro AND role_name IN ('Chef', 'Server', 'Bartender')
  LIMIT 18;

  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_location_malasana, full_name || ' (ML)', role_name, hourly_cost, active
  FROM employees WHERE location_id = v_location_centro AND role_name IN ('Chef', 'Server', 'Bartender')
  LIMIT 18;

  RAISE NOTICE 'Empleados creados: ~30 por location';

  -- ============== PASO 5: GENERAR FACTS_SALES_15M (60 días) ==============
  -- Generar ventas cada 15 minutos para las 3 locations
  FOR v_day_offset IN 0..59 LOOP
    v_current_date := CURRENT_DATE - v_day_offset;
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0=Sunday, 6=Saturday

    -- Patrones por día de semana
    v_base_sales := CASE
      WHEN v_day_of_week IN (5, 6) THEN 18000 -- Fri, Sat: €18k
      WHEN v_day_of_week = 0 THEN 16000 -- Sunday: €16k
      WHEN v_day_of_week IN (2, 3) THEN 10000 -- Tue, Wed: €10k (mid-week dip)
      ELSE 13000 -- Mon, Thu: €13k
    END;

    -- Generar slots de 15 min (10:00 - 23:00 = 52 slots)
    FOR v_hour IN 10..22 LOOP
      FOR v_minute IN 0..45 BY 15 LOOP
        v_ts := v_current_date + (v_hour || ' hours')::INTERVAL + (v_minute || ' minutes')::INTERVAL;
        
        -- Peso por hora (lunch peak 12-15, dinner peak 19-22)
        v_sales_15m := v_base_sales * CASE
          WHEN v_hour BETWEEN 12 AND 14 THEN 0.08 -- Lunch peak
          WHEN v_hour BETWEEN 19 AND 21 THEN 0.09 -- Dinner peak
          WHEN v_hour = 15 THEN 0.04
          WHEN v_hour IN (10, 11) THEN 0.02
          WHEN v_hour = 22 THEN 0.03
          ELSE 0.05
        END;

        -- Variación random ±10%
        v_sales_15m := v_sales_15m * (0.9 + random() * 0.2);
        v_tickets := GREATEST(1, FLOOR(v_sales_15m / 24));
        v_covers := GREATEST(1, FLOOR(v_tickets * 1.2));

        -- LA TABERNA CENTRO (35% del total group sales)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_location_centro,
          v_ts,
          v_sales_15m * 0.35,
          v_sales_15m * 0.35 * 0.95, -- 5% descuentos/taxes
          FLOOR(v_tickets * 0.35),
          FLOOR(v_covers * 0.35),
          NOW()
        );

        -- CHAMBERÍ (33% del total)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_location_chamberi,
          v_ts,
          v_sales_15m * 0.33,
          v_sales_15m * 0.33 * 0.95,
          FLOOR(v_tickets * 0.33),
          FLOOR(v_covers * 0.33),
          NOW()
        );

        -- MALASAÑA (32% del total)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_location_malasana,
          v_ts,
          v_sales_15m * 0.32,
          v_sales_15m * 0.32 * 0.95,
          FLOOR(v_tickets * 0.32),
          FLOOR(v_covers * 0.32),
          NOW()
        );

      END LOOP;
    END LOOP;

    -- ============== PASO 6: GENERAR FACTS_LABOR_DAILY ==============
    -- Calcular labour basado en sales del día
    FOR v_location_centro, v_base_sales IN 
      SELECT 
        location_id,
        SUM(sales_net) as daily_sales
      FROM facts_sales_15m
      WHERE DATE(ts_bucket) = v_current_date
        AND location_id IN (v_location_centro, v_location_chamberi, v_location_malasana)
      GROUP BY location_id
    LOOP
      -- COL target 28%, con variación ±3%
      DECLARE
        v_target_col NUMERIC := 0.28 + (random() - 0.5) * 0.06;
        v_labor_cost NUMERIC := v_base_sales * v_target_col;
        v_labor_hours NUMERIC := v_labor_cost / 14.5; -- €14.5 promedio por hora
        v_scheduled_hours NUMERIC := v_labor_hours * 0.95; -- 95% de utilización
      BEGIN
        INSERT INTO facts_labor_daily (
          location_id, 
          day, 
          scheduled_hours, 
          actual_hours, 
          labor_cost_est, 
          overtime_hours,
          created_at
        )
        VALUES (
          v_location_centro,
          v_current_date,
          v_scheduled_hours,
          v_labor_hours,
          v_labor_cost,
          GREATEST(0, v_labor_hours - v_scheduled_hours),
          NOW()
        );
      END;
    END LOOP;

  END LOOP; -- Fin loop de días

  RAISE NOTICE 'Seed completado: 60 días × 3 locations × 52 slots = ~9,360 registros en facts_sales_15m';
  RAISE NOTICE 'Seed completado: 60 días × 3 locations = 180 registros en facts_labor_daily';

END $$;

-- ============== PASO 7: ÍNDICES Y OPTIMIZACIÓN ==============
ANALYZE facts_sales_15m;
ANALYZE facts_labor_daily;
ANALYZE locations;
ANALYZE employees;
ANALYZE cdm_items;

-- Log de confirmación
DO $$
DECLARE
  v_sales_count INT;
  v_labor_count INT;
  v_locations_count INT;
  v_employees_count INT;
BEGIN
  SELECT COUNT(*) INTO v_sales_count FROM facts_sales_15m;
  SELECT COUNT(*) INTO v_labor_count FROM facts_labor_daily;
  SELECT COUNT(*) INTO v_locations_count FROM locations;
  SELECT COUNT(*) INTO v_employees_count FROM employees;
  
  RAISE NOTICE '=== SEED DATA SUMMARY ===';
  RAISE NOTICE 'Locations: %', v_locations_count;
  RAISE NOTICE 'Employees: %', v_employees_count;
  RAISE NOTICE 'Sales records (15min): %', v_sales_count;
  RAISE NOTICE 'Labour records (daily): %', v_labor_count;
  RAISE NOTICE '========================';
END $$;
