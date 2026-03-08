-- ============================================================
-- Add pin_code column to employees for Kiosk Mode
-- Used for 6-digit PIN authentication at clock-in kiosks
-- ============================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pin_code text;

-- Index for fast PIN lookup (kiosk login)
CREATE INDEX IF NOT EXISTS idx_employees_pin_location
  ON employees(pin_code, location_id)
  WHERE pin_code IS NOT NULL AND active = true;

COMMENT ON COLUMN employees.pin_code IS '6-digit PIN for kiosk clock-in/out authentication';

-- Seed PINs for demo employees
UPDATE employees SET pin_code = '100001' WHERE full_name ILIKE '%Carlos%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100002' WHERE full_name ILIKE '%Maria%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100003' WHERE full_name ILIKE '%Ana%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100004' WHERE full_name ILIKE '%Luis%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100005' WHERE full_name ILIKE '%Sofia%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100006' WHERE full_name ILIKE '%Pedro%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100007' WHERE full_name ILIKE '%Elena%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100008' WHERE full_name ILIKE '%Javier%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100009' WHERE full_name ILIKE '%Laura%' AND pin_code IS NULL;
UPDATE employees SET pin_code = '100010' WHERE full_name ILIKE '%Pablo%' AND pin_code IS NULL;

-- Create storage bucket for kiosk clock photos (if not exists)
-- Note: This needs to be done via Supabase dashboard or management API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('clock-photos', 'clock-photos', false)
-- ON CONFLICT (id) DO NOTHING;
