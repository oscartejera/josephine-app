-- ====================================================================
-- SEED 18 MESES - EJECUTAR DIRECTAMENTE EN SQL EDITOR
-- Copia este código completo y pégalo en Supabase SQL Editor
-- ====================================================================

DO $$
DECLARE
  v_group_id UUID;
  v_loc_centro UUID;
  v_loc_chamberi UUID;
  v_loc_malasana UUID;
  v_current_date DATE;
  v_day_of_week INT;
  v_base_sales NUMERIC;
  v_sales_15m NUMERIC;
  v_hour INT;
  v_minute INT;
  v_ts TIMESTAMPTZ;
  v_growth_mult NUMERIC;
  v_seasonal_mult NUMERIC;
  v_month INT;
  v_is_actual BOOLEAN;
  v_total_sales_day NUMERIC;
  v_target_col NUMERIC;
  v_actual_col NUMERIC;
  v_labor_cost NUMERIC;
  v_labor_hours NUMERIC;
  v_scheduled_hours NUMERIC;
  v_sales_count INT := 0;
  v_labour_count INT := 0;
BEGIN
  RAISE NOTICE '🌱 Iniciando seed de 18 meses...';
  
  -- ========== PASO 1: Obtener o crear grupo ==========
  SELECT id INTO v_group_id FROM groups LIMIT 1;
  
  IF v_group_id IS NULL THEN
    INSERT INTO groups (name, created_at) 
    VALUES ('Josephine Restaurant Group', NOW())
    RETURNING id INTO v_group_id;
    RAISE NOTICE '✅ Grupo creado';
  ELSE
    RAISE NOTICE '✅ Grupo encontrado: %', v_group_id;
  END IF;

  -- ========== PASO 2: Limpiar datos demo previos ==========
  RAISE NOTICE '🧹 Limpiando datos demo anteriores...';
  
  DELETE FROM facts_item_mix_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  );
  DELETE FROM facts_labor_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  );
  DELETE FROM facts_sales_15m WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  );
  DELETE FROM employees WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  );
  DELETE FROM cdm_items WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  );
  DELETE FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña');

  RAISE NOTICE '✅ Datos anteriores limpiados';

  -- ========== PASO 3: Crear 3 locations ==========
  INSERT INTO locations (id, group_id, name, city, timezone, currency, created_at)
  VALUES 
    (gen_random_uuid(), v_group_id, 'La Taberna Centro', 'Salamanca', 'Europe/Madrid', 'EUR', NOW()),
    (gen_random_uuid(), v_group_id, 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR', NOW()),
    (gen_random_uuid(), v_group_id, 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR', NOW());

  SELECT id INTO v_loc_centro FROM locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_loc_chamberi FROM locations WHERE name = 'Chamberí';
  SELECT id INTO v_loc_malasana FROM locations WHERE name = 'Malasaña';

  RAISE NOTICE '✅ Locations creadas: %, %, %', v_loc_centro, v_loc_chamberi, v_loc_malasana;

  -- ========== PASO 4: Crear empleados ==========
  -- La Taberna Centro - 30 employees
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active, created_at)
  SELECT v_loc_centro, 'Chef ' || i, 'Chef', 18.00, true, NOW() FROM generate_series(1, 8) i
  UNION ALL
  SELECT v_loc_centro, 'Server ' || i, 'Server', 12.00, true, NOW() FROM generate_series(1, 12) i
  UNION ALL
  SELECT v_loc_centro, 'Bartender ' || i, 'Bartender', 14.00, true, NOW() FROM generate_series(1, 5) i
  UNION ALL
  SELECT v_loc_centro, 'Host ' || i, 'Host', 11.00, true, NOW() FROM generate_series(1, 3) i
  UNION ALL
  SELECT v_loc_centro, 'Manager ' || i, 'Manager', 25.00, true, NOW() FROM generate_series(1, 2) i;

  -- Chamberí y Malasaña (20 cada una)
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_chamberi, 'Chef CH' || i, 'Chef', 18.00, true FROM generate_series(1, 5) i
  UNION ALL
  SELECT v_loc_chamberi, 'Server CH' || i, 'Server', 12.00, true FROM generate_series(1, 10) i
  UNION ALL
  SELECT v_loc_chamberi, 'Bartender CH' || i, 'Bartender', 14.00, true FROM generate_series(1, 3) i
  UNION ALL
  SELECT v_loc_chamberi, 'Manager CH' || i, 'Manager', 25.00, true FROM generate_series(1, 2) i;

  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_malasana, 'Chef ML' || i, 'Chef', 18.00, true FROM generate_series(1, 5) i
  UNION ALL
  SELECT v_loc_malasana, 'Server ML' || i, 'Server', 12.00, true FROM generate_series(1, 10) i
  UNION ALL
  SELECT v_loc_malasana, 'Bartender ML' || i, 'Bartender', 14.00, true FROM generate_series(1, 3) i
  UNION ALL
  SELECT v_loc_malasana, 'Manager ML' || i, 'Manager', 25.00, true FROM generate_series(1, 2) i;

  RAISE NOTICE '✅ Empleados creados: 70 totales';

  -- ========== PASO 5: Generar facts_sales_15m (18 meses) ==========
  RAISE NOTICE '📊 Generando sales data (18 meses)...';
  
  -- Loop por cada día desde 2025-01-01 hasta 2026-06-30
  FOR v_current_date IN 
    SELECT generate_series('2025-01-01'::DATE, '2026-06-30'::DATE, '1 day'::INTERVAL)::DATE
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    v_month := EXTRACT(MONTH FROM v_current_date);
    v_is_actual := v_current_date <= '2026-02-04'::DATE;

    -- Crecimiento YoY: 2025=1.0, 2026=1.15
    v_growth_mult := CASE 
      WHEN EXTRACT(YEAR FROM v_current_date) = 2025 THEN 1.0
      ELSE 1.15
    END;

    -- Estacionalidad mensual
    v_seasonal_mult := CASE v_month
      WHEN 6, 7, 8 THEN 1.20  -- Verano alto
      WHEN 3, 4, 5 THEN 1.10  -- Primavera medio-alto
      WHEN 12, 1, 2 THEN 0.90 -- Invierno bajo
      ELSE 1.0
    END;

    -- Base por día de semana
    v_base_sales := CASE
      WHEN v_day_of_week IN (5, 6) THEN 18000 -- Viernes-Sábado
      WHEN v_day_of_week = 0 THEN 16000       -- Domingo
      WHEN v_day_of_week IN (2, 3) THEN 10000 -- Martes-Miércoles (dip)
      ELSE 13000                              -- Lunes-Jueves
    END * v_growth_mult * v_seasonal_mult;

    -- Generar slots cada 15 min (10:00-23:00)
    FOR v_hour IN 10..23 LOOP
      FOR v_minute IN 0..45 BY 15 LOOP
        v_ts := v_current_date + (v_hour || ' hours')::INTERVAL + (v_minute || ' minutes')::INTERVAL;
        
        -- Peso por hora del día
        v_sales_15m := v_base_sales * CASE
          WHEN v_hour BETWEEN 12 AND 14 THEN 0.08  -- Lunch peak
          WHEN v_hour BETWEEN 19 AND 21 THEN 0.09  -- Dinner peak
          WHEN v_hour IN (10, 11) THEN 0.02
          WHEN v_hour = 22 THEN 0.03
          WHEN v_hour = 23 THEN 0.01
          ELSE 0.05
        END;

        -- Variación random solo en actuals
        IF v_is_actual THEN
          v_sales_15m := v_sales_15m * (0.9 + random() * 0.2);
        END IF;

        -- Insertar para las 3 locations
        -- La Taberna Centro (35%)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_loc_centro,
          v_ts,
          ROUND(v_sales_15m * 0.35, 2),
          ROUND(v_sales_15m * 0.35 * 0.95, 2),
          GREATEST(1, FLOOR(v_sales_15m * 0.35 / 24)),
          GREATEST(1, FLOOR(v_sales_15m * 0.35 / 20)),
          NOW()
        );

        -- Chamberí (33%)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_loc_chamberi,
          v_ts,
          ROUND(v_sales_15m * 0.33, 2),
          ROUND(v_sales_15m * 0.33 * 0.95, 2),
          GREATEST(1, FLOOR(v_sales_15m * 0.33 / 24)),
          GREATEST(1, FLOOR(v_sales_15m * 0.33 / 20)),
          NOW()
        );

        -- Malasaña (32%)
        INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers, created_at)
        VALUES (
          v_loc_malasana,
          v_ts,
          ROUND(v_sales_15m * 0.32, 2),
          ROUND(v_sales_15m * 0.32 * 0.95, 2),
          GREATEST(1, FLOOR(v_sales_15m * 0.32 / 24)),
          GREATEST(1, FLOOR(v_sales_15m * 0.32 / 20)),
          NOW()
        );

        v_sales_count := v_sales_count + 3;
      END LOOP;
    END LOOP;

    -- Progress log cada 30 días
    IF v_sales_count % 4680 = 0 THEN
      RAISE NOTICE '📈 Sales: % registros generados...', v_sales_count;
    END IF;

    -- ========== GENERAR LABOUR DIARIO ==========
    -- Calcular labour basado en sales del día
    FOR v_loc_centro IN 
      SELECT location_id, SUM(sales_net) as daily_sales
      FROM facts_sales_15m
      WHERE DATE(ts_bucket) = v_current_date
        AND location_id IN (
          (SELECT id FROM locations WHERE name = 'La Taberna Centro'),
          (SELECT id FROM locations WHERE name = 'Chamberí'),
          (SELECT id FROM locations WHERE name = 'Malasaña')
        )
      GROUP BY location_id
    LOOP
      SELECT SUM(sales_net) INTO v_total_sales_day
      FROM facts_sales_15m
      WHERE DATE(ts_bucket) = v_current_date AND location_id = v_loc_centro;

      IF v_total_sales_day > 0 THEN
        v_target_col := 0.28;
        
        -- Variación en actuals, target exacto en forecast
        IF v_is_actual THEN
          v_actual_col := 0.28 + (random() - 0.5) * 0.06; -- 25-31%
        ELSE
          v_actual_col := 0.28; -- Forecast exacto al target
        END IF;

        v_labor_cost := v_total_sales_day * v_actual_col;
        v_labor_hours := v_labor_cost / 14.5; -- €14.5 promedio por hora
        v_scheduled_hours := v_labor_hours * 0.95;

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
          v_loc_centro,
          v_current_date,
          ROUND(v_scheduled_hours, 1),
          ROUND(v_labor_hours, 1),
          ROUND(v_labor_cost, 2),
          GREATEST(0, ROUND(v_labor_hours - v_scheduled_hours, 1)),
          NOW()
        );

        v_labour_count := v_labour_count + 1;
      END IF;
    END LOOP;

  END LOOP; -- Fin loop días

  RAISE NOTICE '✅ COMPLETADO!';
  RAISE NOTICE '📊 Sales records: %', v_sales_count;
  RAISE NOTICE '👷 Labour records: %', v_labour_count;
  RAISE NOTICE '📅 Periodo: 2025-01-01 a 2026-06-30 (18 meses)';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Ahora ve a /sales o /insights/labour para ver los datos!';
  
END $$;

-- Verificar que funcionó
SELECT 
  (SELECT COUNT(*) FROM facts_sales_15m) as sales_records,
  (SELECT COUNT(*) FROM facts_labor_daily) as labour_records,
  (SELECT COUNT(*) FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')) as locations,
  (SELECT COUNT(*) FROM employees) as employees;
