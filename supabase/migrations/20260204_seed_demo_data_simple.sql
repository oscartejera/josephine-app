-- ====================================================================
-- SEED DEMO DATA - Josephine Restaurant Group (Simplified)
-- Datos coherentes para demos - 30 días
-- ====================================================================

-- Esta migración puede ejecutarse múltiples veces (idempotente)
-- Limpia y regenera datos demo

-- Función helper para generar datos
CREATE OR REPLACE FUNCTION seed_josephine_demo_data()
RETURNS TABLE (
  locations_created INT,
  employees_created INT,
  items_created INT,
  sales_records INT,
  labour_records INT
) AS $$
DECLARE
  v_group_id UUID;
  v_loc_centro UUID;
  v_loc_chamberi UUID;
  v_loc_malasana UUID;
  v_org_id UUID;
  v_locations_count INT := 0;
  v_employees_count INT := 0;
  v_items_count INT := 0;
  v_sales_count INT := 0;
  v_labour_count INT := 0;
BEGIN
  -- Obtener o crear grupo
  SELECT id INTO v_group_id FROM groups LIMIT 1;
  IF v_group_id IS NULL THEN
    INSERT INTO groups (name) VALUES ('Josephine Demo') RETURNING id INTO v_group_id;
  END IF;
  v_org_id := v_group_id;

  -- Limpiar datos demo previos (solo locations específicas)
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

  -- Crear 3 locations
  INSERT INTO locations (group_id, name, city, timezone, currency) VALUES
    (v_group_id, 'La Taberna Centro', 'Salamanca', 'Europe/Madrid', 'EUR'),
    (v_group_id, 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR'),
    (v_group_id, 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR');
  
  SELECT id INTO v_loc_centro FROM locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_loc_chamberi FROM locations WHERE name = 'Chamberí';
  SELECT id INTO v_loc_malasana FROM locations WHERE name = 'Malasaña';
  v_locations_count := 3;

  -- Crear productos (7 items por location)
  INSERT INTO cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active) VALUES
    (v_org_id, v_loc_centro, 'Paella Valenciana', 'Food', 24.50, 8.20, true),
    (v_org_id, v_loc_centro, 'Jamón Ibérico', 'Food', 18.90, 11.40, true),
    (v_org_id, v_loc_centro, 'Chuletón de Buey', 'Food', 38.50, 19.20, true),
    (v_org_id, v_loc_centro, 'Pulpo a la Gallega', 'Food', 22.80, 9.10, true),
    (v_org_id, v_loc_centro, 'Bacalao Pil-Pil', 'Food', 26.50, 10.60, true),
    (v_org_id, v_loc_centro, 'Rioja Reserva', 'Beverage', 28.00, 9.50, true),
    (v_org_id, v_loc_centro, 'Cerveza Alhambra', 'Beverage', 4.50, 1.20, true);
  
  -- Replicar para otras locations
  INSERT INTO cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_org_id, v_loc_chamberi, name, category_name, unit_price * 0.95, cost_price * 0.95, active
  FROM cdm_items WHERE location_id = v_loc_centro;

  INSERT INTO cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_org_id, v_loc_malasana, name, category_name, unit_price * 0.90, cost_price * 0.90, active
  FROM cdm_items WHERE location_id = v_loc_centro;
  
  GET DIAGNOSTICS v_items_count = ROW_COUNT;
  v_items_count := v_items_count + 7;

  -- Crear empleados (30 por location)
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active) VALUES
    -- Chefs (€18/h)
    (v_loc_centro, 'Carlos García', 'Chef', 18.00, true),
    (v_loc_centro, 'María López', 'Chef', 18.00, true),
    (v_loc_centro, 'Juan Martínez', 'Chef', 18.00, true),
    (v_loc_centro, 'Ana Torres', 'Chef', 18.00, true),
    (v_loc_centro, 'Pedro Sánchez', 'Chef', 18.00, true),
    (v_loc_centro, 'Laura Fernández', 'Chef', 18.00, true),
    (v_loc_centro, 'Miguel Ruiz', 'Chef', 18.00, true),
    (v_loc_centro, 'Carmen Díaz', 'Chef', 18.00, true),
    -- Servers (€12/h)
    (v_loc_centro, 'David Rodríguez', 'Server', 12.00, true),
    (v_loc_centro, 'Sara Gómez', 'Server', 12.00, true),
    (v_loc_centro, 'Pablo Jiménez', 'Server', 12.00, true),
    (v_loc_centro, 'Elena Moreno', 'Server', 12.00, true),
    (v_loc_centro, 'Jorge Álvarez', 'Server', 12.00, true),
    (v_loc_centro, 'Lucía Romero', 'Server', 12.00, true),
    (v_loc_centro, 'Alberto Navarro', 'Server', 12.00, true),
    (v_loc_centro, 'Isabel Gil', 'Server', 12.00, true),
    (v_loc_centro, 'Francisco Serrano', 'Server', 12.00, true),
    (v_loc_centro, 'Patricia Molina', 'Server', 12.00, true),
    (v_loc_centro, 'Antonio Castro', 'Server', 12.00, true),
    (v_loc_centro, 'Rosa Ortiz', 'Server', 12.00, true),
    -- Bartenders (€14/h)
    (v_loc_centro, 'Manuel Rubio', 'Bartender', 14.00, true),
    (v_loc_centro, 'Teresa Vega', 'Bartender', 14.00, true),
    (v_loc_centro, 'Luis Ramos', 'Bartender', 14.00, true),
    (v_loc_centro, 'Cristina Herrera', 'Bartender', 14.00, true),
    (v_loc_centro, 'Javier Mendoza', 'Bartender', 14.00, true),
    -- Hosts (€11/h)
    (v_loc_centro, 'Beatriz Cruz', 'Host', 11.00, true),
    (v_loc_centro, 'Raúl Delgado', 'Host', 11.00, true),
    (v_loc_centro, 'Sofía Vargas', 'Host', 11.00, true),
    -- Managers (€25/h)
    (v_loc_centro, 'Fernando Iglesias', 'Manager', 25.00, true),
    (v_loc_centro, 'Marta Cortés', 'Manager', 25.00, true);

  -- Replicar empleados para otras locations
  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_chamberi, full_name || ' (CH)', role_name, hourly_cost, active
  FROM employees WHERE location_id = v_loc_centro;

  INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_malasana, full_name || ' (ML)', role_name, hourly_cost, active
  FROM employees WHERE location_id = v_loc_centro;

  GET DIAGNOSTICS v_employees_count = ROW_COUNT;
  v_employees_count := v_employees_count + 30;

  -- Generar sales y labour usando generate_series
  INSERT INTO facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers)
  SELECT 
    loc.id as location_id,
    ts,
    -- Base sales con patrones
    (CASE 
      WHEN EXTRACT(DOW FROM ts) IN (5, 6) THEN 350 -- Weekend
      WHEN EXTRACT(DOW FROM ts) IN (2, 3) THEN 190 -- Mid-week
      ELSE 270 -- Regular
    END * 
    -- Peak hours
    CASE 
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 14 THEN 1.5
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 19 AND 21 THEN 1.6
      WHEN EXTRACT(HOUR FROM ts) IN (10, 11, 22, 23) THEN 0.4
      ELSE 0.8
    END *
    -- Location multiplier
    CASE loc.name
      WHEN 'La Taberna Centro' THEN 1.1
      WHEN 'Chamberí' THEN 1.0
      WHEN 'Malasaña' THEN 0.9
    END *
    -- Random variation
    (0.9 + random() * 0.2)) as sales_gross,
    
    (CASE 
      WHEN EXTRACT(DOW FROM ts) IN (5, 6) THEN 350
      WHEN EXTRACT(DOW FROM ts) IN (2, 3) THEN 190
      ELSE 270
    END * 
    CASE 
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 14 THEN 1.5
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 19 AND 21 THEN 1.6
      WHEN EXTRACT(HOUR FROM ts) IN (10, 11, 22, 23) THEN 0.4
      ELSE 0.8
    END *
    CASE loc.name
      WHEN 'La Taberna Centro' THEN 1.1
      WHEN 'Chamberí' THEN 1.0
      WHEN 'Malasaña' THEN 0.9
    END *
    (0.9 + random() * 0.2) * 0.95) as sales_net,
    
    FLOOR(random() * 3 + 1) as tickets,
    FLOOR(random() * 4 + 1) as covers
  FROM 
    generate_series(
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE - INTERVAL '1 day',
      INTERVAL '15 minutes'
    ) ts,
    (SELECT id, name FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')) loc
  WHERE EXTRACT(HOUR FROM ts) BETWEEN 10 AND 23;

  GET DIAGNOSTICS v_sales_count = ROW_COUNT;

  -- Generar labour daily basado en sales
  INSERT INTO facts_labor_daily (location_id, day, scheduled_hours, actual_hours, labor_cost_est, overtime_hours)
  SELECT 
    location_id,
    DATE(ts_bucket) as day,
    SUM(sales_net) * 0.028 / 14.5 as scheduled_hours, -- Target 28% COL, €14.5 avg wage
    SUM(sales_net) * 0.030 / 14.5 as actual_hours, -- Actual 30% COL (over target)
    SUM(sales_net) * 0.030 as labor_cost_est,
    GREATEST(0, SUM(sales_net) * 0.030 / 14.5 - SUM(sales_net) * 0.028 / 14.5) as overtime_hours
  FROM facts_sales_15m
  WHERE location_id IN (v_loc_centro, v_loc_chamberi, v_loc_malasana)
  GROUP BY location_id, DATE(ts_bucket);

  GET DIAGNOSTICS v_labour_count = ROW_COUNT;

  -- Return summary
  locations_created := v_locations_count;
  employees_created := v_employees_count;
  items_created := v_items_count;
  sales_records := v_sales_count;
  labour_records := v_labour_count;
  RETURN NEXT;
  
  RAISE NOTICE 'SEED COMPLETADO: % locations, % employees, % sales records, % labour records', 
    v_locations_count, v_employees_count, v_sales_count, v_labour_count;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar seed (comentar si ya se ejecutó)
-- SELECT * FROM seed_josephine_demo_data();
