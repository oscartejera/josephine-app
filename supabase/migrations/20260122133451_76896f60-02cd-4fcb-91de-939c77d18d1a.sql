-- =====================================================
-- PART B: Location Settings defaults (target_col_percent = 22%)
-- =====================================================

-- Insert location_settings for any location that doesn't have one
INSERT INTO location_settings (location_id, target_col_percent, default_hourly_cost)
SELECT l.id, 22, 15.00
FROM locations l
WHERE NOT EXISTS (
  SELECT 1 FROM location_settings ls WHERE ls.location_id = l.id
)
ON CONFLICT (location_id) DO NOTHING;

-- Update existing rows where target_col_percent or default_hourly_cost is NULL
UPDATE location_settings 
SET 
  target_col_percent = COALESCE(target_col_percent, 22),
  default_hourly_cost = COALESCE(default_hourly_cost, 15.00)
WHERE target_col_percent IS NULL OR default_hourly_cost IS NULL;

-- =====================================================
-- PART C: 8h shift constraint trigger
-- =====================================================

-- Function to enforce 8h shifts
CREATE OR REPLACE FUNCTION enforce_8h_shift()
RETURNS TRIGGER AS $$
DECLARE
  duration_interval INTERVAL;
  duration_hours NUMERIC;
BEGIN
  -- Calculate duration from start_time and end_time
  -- Handle overnight shifts (end_time < start_time)
  IF NEW.end_time < NEW.start_time THEN
    duration_interval := (NEW.end_time::time + INTERVAL '24 hours') - NEW.start_time::time;
  ELSE
    duration_interval := NEW.end_time::time - NEW.start_time::time;
  END IF;
  
  duration_hours := EXTRACT(EPOCH FROM duration_interval) / 3600;
  
  -- Enforce exactly 8 hours (with small tolerance for rounding)
  IF ABS(duration_hours - 8) > 0.01 THEN
    RAISE EXCEPTION 'Shift duration must be exactly 8 hours. Got % hours (% to %)', 
      ROUND(duration_hours::numeric, 2), NEW.start_time, NEW.end_time;
  END IF;
  
  -- Also enforce planned_hours = 8
  IF NEW.planned_hours != 8 THEN
    -- Auto-correct planned_hours instead of failing
    NEW.planned_hours := 8;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tr_enforce_8h_shift ON planned_shifts;
CREATE TRIGGER tr_enforce_8h_shift
BEFORE INSERT OR UPDATE ON planned_shifts
FOR EACH ROW EXECUTE FUNCTION enforce_8h_shift();

-- =====================================================
-- PART D: Role mapping migration
-- =====================================================

-- Update role_name to new standardized roles
UPDATE employees SET role_name = 'Cocinero/a' WHERE role_name IN ('Jefe de Cocina', 'Jefe de cocina');
UPDATE employees SET role_name = 'Preparación' WHERE role_name = 'Ayudante Cocina';
UPDATE employees SET role_name = 'Barra' WHERE role_name = 'Barman';
UPDATE employees SET role_name = 'Camarero/a' WHERE role_name IN ('Camarero', 'Camarera');
UPDATE employees SET role_name = 'Cocinero/a' WHERE role_name IN ('Cocinero', 'Cocinera');
-- Limpieza stays as Limpieza

-- Create placeholder employees for OPEN SHIFTS (one per role per location)
-- These are used when there aren't enough real employees
INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
SELECT 
  l.id,
  'OPEN - ' || r.role_name,
  r.role_name,
  COALESCE(ls.default_hourly_cost, 15.00),
  true
FROM locations l
CROSS JOIN (
  VALUES 
    ('Cocinero/a'),
    ('Preparación'),
    ('Lavaplatos'),
    ('Gerente'),
    ('Camarero/a'),
    ('Barra'),
    ('Limpieza')
) AS r(role_name)
LEFT JOIN location_settings ls ON ls.location_id = l.id
WHERE NOT EXISTS (
  SELECT 1 FROM employees e 
  WHERE e.location_id = l.id 
    AND e.full_name = 'OPEN - ' || r.role_name
);

-- Create at least 1 Lavaplatos per location if none exists
INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
SELECT 
  l.id,
  'David García (Lavaplatos)',
  'Lavaplatos',
  COALESCE(
    (SELECT AVG(hourly_cost) FROM employees WHERE location_id = l.id AND role_name IN ('Cocinero/a', 'Preparación') AND hourly_cost IS NOT NULL),
    15.00
  ),
  true
FROM locations l
WHERE NOT EXISTS (
  SELECT 1 FROM employees e 
  WHERE e.location_id = l.id 
    AND e.role_name = 'Lavaplatos'
    AND e.full_name NOT LIKE 'OPEN -%'
);

-- Create at least 1 Gerente per location if none exists
INSERT INTO employees (location_id, full_name, role_name, hourly_cost, active)
SELECT 
  l.id,
  'María López (Gerente)',
  'Gerente',
  COALESCE(
    (SELECT MAX(hourly_cost) FROM employees WHERE location_id = l.id AND hourly_cost IS NOT NULL),
    20.00
  ),
  true
FROM locations l
WHERE NOT EXISTS (
  SELECT 1 FROM employees e 
  WHERE e.location_id = l.id 
    AND e.role_name = 'Gerente'
    AND e.full_name NOT LIKE 'OPEN -%'
);