-- ============================================
-- FASE 2: Restricción legal 8h por turno (España)
-- ============================================

-- 1. Add check constraint for 8h shifts
-- Note: We use a trigger instead of CHECK for more flexibility and better error messages

-- 2. Create validation trigger for planned_hours = 8
CREATE OR REPLACE FUNCTION validate_planned_shift_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Spanish labor law: standard shifts must be exactly 8 hours
  IF NEW.planned_hours != 8 THEN
    RAISE EXCEPTION 'Los turnos deben ser exactamente 8 horas según la legislación laboral española. Recibido: % horas', NEW.planned_hours;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_validate_shift_hours ON planned_shifts;

-- Create trigger
CREATE TRIGGER trg_validate_shift_hours
  BEFORE INSERT OR UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_planned_shift_hours();

-- 3. Add default_hourly_cost to location_settings if not exists
ALTER TABLE location_settings 
ADD COLUMN IF NOT EXISTS default_hourly_cost numeric DEFAULT 15.00;

-- 4. Ensure target_col_percent exists with proper default
ALTER TABLE location_settings 
ADD COLUMN IF NOT EXISTS target_col_percent numeric DEFAULT 22.00;

-- 5. Update planned_cost calculation trigger to use location default when employee hourly_cost is null
CREATE OR REPLACE FUNCTION set_planned_shift_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly_cost numeric;
  v_default_cost numeric;
BEGIN
  -- Get employee hourly cost
  SELECT hourly_cost INTO v_hourly_cost
  FROM employees 
  WHERE id = NEW.employee_id;
  
  -- If employee hourly_cost is null, use location default
  IF v_hourly_cost IS NULL THEN
    SELECT default_hourly_cost INTO v_default_cost
    FROM location_settings
    WHERE location_id = NEW.location_id;
    
    v_hourly_cost := COALESCE(v_default_cost, 15.00);
  END IF;
  
  -- Calculate planned cost
  NEW.planned_cost := ROUND(NEW.planned_hours * v_hourly_cost, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS tr_set_planned_shift_cost ON planned_shifts;
CREATE TRIGGER tr_set_planned_shift_cost
  BEFORE INSERT OR UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION set_planned_shift_cost();

-- 6. Add forecast model metadata columns
ALTER TABLE forecast_daily_metrics 
ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'v1.0';

ALTER TABLE forecast_daily_metrics 
ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();

ALTER TABLE forecast_daily_metrics 
ADD COLUMN IF NOT EXISTS mse numeric;

ALTER TABLE forecast_daily_metrics 
ADD COLUMN IF NOT EXISTS mape numeric;

ALTER TABLE forecast_daily_metrics 
ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.5;

-- 7. Create index for faster forecast queries
CREATE INDEX IF NOT EXISTS idx_forecast_daily_location_date 
ON forecast_daily_metrics(location_id, date);

-- 8. Update existing location_settings with defaults if needed
UPDATE location_settings 
SET 
  default_hourly_cost = COALESCE(default_hourly_cost, 15.00),
  target_col_percent = COALESCE(target_col_percent, 22.00)
WHERE default_hourly_cost IS NULL OR target_col_percent IS NULL;