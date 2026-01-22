
-- =============================================================
-- MIGRATION: Standardize roles, enforce 8h shifts, set COL% 22%
-- =============================================================

-- 1) Update all location_settings to target_col_percent = 22
UPDATE public.location_settings
SET target_col_percent = 22
WHERE target_col_percent != 22 OR target_col_percent IS NULL;

-- 2) Ensure all locations have location_settings entries
INSERT INTO public.location_settings (location_id, target_col_percent, default_hourly_cost)
SELECT l.id, 22, 15.00
FROM public.locations l
LEFT JOIN public.location_settings ls ON ls.location_id = l.id
WHERE ls.location_id IS NULL;

-- 3) Update employee roles to standardized names
-- Map: Barra -> Personal de barra
-- Map: Limpieza -> Equipo de limpieza
-- Map: Preparación -> Personal de preparación
UPDATE public.employees SET role_name = 'Personal de barra' WHERE role_name = 'Barra';
UPDATE public.employees SET role_name = 'Equipo de limpieza' WHERE role_name = 'Limpieza';
UPDATE public.employees SET role_name = 'Personal de preparación' WHERE role_name = 'Preparación';

-- 4) Create or replace function to enforce 8-hour shifts
CREATE OR REPLACE FUNCTION public.enforce_8h_shift()
RETURNS TRIGGER AS $$
DECLARE
  calculated_hours NUMERIC;
BEGIN
  -- Calculate hours from start_time and end_time
  -- Handle overnight shifts (end_time < start_time)
  IF NEW.end_time >= NEW.start_time THEN
    calculated_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  ELSE
    -- Overnight shift: calculate from start to midnight + midnight to end
    calculated_hours := EXTRACT(EPOCH FROM ('24:00:00'::time - NEW.start_time + NEW.end_time)) / 3600;
  END IF;

  -- Enforce exactly 8 hours
  IF ABS(calculated_hours - 8.0) > 0.01 THEN
    RAISE EXCEPTION 'Shift duration must be exactly 8 hours. Got % hours (start: %, end: %)',
      ROUND(calculated_hours::numeric, 2), NEW.start_time, NEW.end_time;
  END IF;

  -- Ensure planned_hours is set to 8
  NEW.planned_hours := 8.0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Create trigger on planned_shifts (drop if exists first)
DROP TRIGGER IF EXISTS tr_enforce_8h_shift ON public.planned_shifts;
CREATE TRIGGER tr_enforce_8h_shift
  BEFORE INSERT OR UPDATE ON public.planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_8h_shift();

-- 6) Add missing employees with standardized roles for locations with < 14 active employees
-- For each main location, ensure we have at least:
-- 2 Gerente, 3 Camarero/a, 1 Personal de barra, 1 Equipo de limpieza (FOH = 7)
-- 3 Cocinero/a, 2 Lavaplatos, 2 Personal de preparación (BOH = 7)
-- Total = 14 employees per location

DO $$
DECLARE
  loc RECORD;
  role_row RECORD;
  current_count INTEGER;
  needed INTEGER;
  role_config JSONB := '[
    {"role": "Gerente", "min": 2, "cost": 17.00},
    {"role": "Camarero/a", "min": 3, "cost": 15.00},
    {"role": "Personal de barra", "min": 1, "cost": 15.00},
    {"role": "Equipo de limpieza", "min": 1, "cost": 13.00},
    {"role": "Cocinero/a", "min": 3, "cost": 16.00},
    {"role": "Lavaplatos", "min": 2, "cost": 14.00},
    {"role": "Personal de preparación", "min": 2, "cost": 14.00}
  ]';
  role_item JSONB;
  i INTEGER;
BEGIN
  -- Process main 4 locations (excluding legacy "La Taberna" ones)
  FOR loc IN 
    SELECT id, name FROM public.locations 
    WHERE id IN (
      '7b6f18b7-068b-453e-a702-380bcd8ce538',
      '379ebcec-e5ed-4921-b71c-74fb732fe515',
      'b14d11a9-a4b5-4cd0-baf8-0fb5a2efb774',
      '6ceeece9-8be1-42c2-a683-72108da37c54'
    )
  LOOP
    FOR role_item IN SELECT * FROM jsonb_array_elements(role_config)
    LOOP
      SELECT COUNT(*) INTO current_count
      FROM public.employees
      WHERE location_id = loc.id
        AND role_name = role_item->>'role'
        AND active = true;
      
      needed := (role_item->>'min')::integer - current_count;
      
      IF needed > 0 THEN
        FOR i IN 1..needed LOOP
          INSERT INTO public.employees (
            location_id, full_name, role_name, hourly_cost, active, contract_type
          ) VALUES (
            loc.id,
            'Staff ' || (role_item->>'role') || ' #' || i || ' (' || loc.name || ')',
            role_item->>'role',
            (role_item->>'cost')::numeric,
            true,
            'indefinido'
          );
        END LOOP;
        RAISE NOTICE 'Added % % employees to %', needed, role_item->>'role', loc.name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
