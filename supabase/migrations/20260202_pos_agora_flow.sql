-- POS Ágora-Style Flow Implementation
-- Adds seats, marchar/fire logic, staff profiles, and operational fields

-- 1) POS Staff Profiles
CREATE TABLE IF NOT EXISTS pos_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'server',
  photo_url TEXT DEFAULT NULL,
  pin TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_location ON pos_staff_profiles(location_id, is_active);

-- Seed 5 staff members for each location
INSERT INTO pos_staff_profiles (location_id, name, role, photo_url, is_active)
SELECT 
  id as location_id,
  unnest(ARRAY['María García', 'Carlos López', 'Ana Rodríguez', 'Pedro Sánchez', 'Laura Martín']),
  'server',
  unnest(ARRAY[
    'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=ana',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=pedro',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=laura'
  ]),
  true
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM pos_staff_profiles 
  WHERE pos_staff_profiles.location_id = locations.id
)
ON CONFLICT DO NOTHING;

-- 2) Add seats and marchar fields to ticket_lines
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS seat_number INTEGER DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS seat_label TEXT DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS is_fired BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS fired_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS fire_batch_id UUID DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS added_batch_id UUID NOT NULL DEFAULT gen_random_uuid();

-- 3) Add discount and price override fields
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT NULL CHECK (discount_type IN ('percent', 'amount', 'none'));
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS price_overridden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS original_unit_price NUMERIC DEFAULT NULL;

-- 4) Add operational fields
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS created_by_staff_id UUID DEFAULT NULL REFERENCES pos_staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE ticket_lines ADD COLUMN IF NOT EXISTS void_reason TEXT DEFAULT NULL;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_by_staff_id UUID DEFAULT NULL REFERENCES pos_staff_profiles(id) ON DELETE SET NULL;

-- 5) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_lines_fired ON ticket_lines(ticket_id, is_fired, course);
CREATE INDEX IF NOT EXISTS idx_ticket_lines_fire_batch ON ticket_lines(fire_batch_id) WHERE fire_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_lines_seat ON ticket_lines(ticket_id, seat_number);

-- 6) Function to auto-fire drinks (course 0)
CREATE OR REPLACE FUNCTION auto_fire_drinks()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-fire drinks (course 0) when inserted
  IF NEW.course = 0 AND NEW.sent_at IS NOT NULL THEN
    NEW.is_fired := true;
    NEW.fired_at := NEW.sent_at;
    NEW.fire_batch_id := gen_random_uuid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_fire_drinks
  BEFORE INSERT ON ticket_lines
  FOR EACH ROW
  EXECUTE FUNCTION auto_fire_drinks();

-- 7) Function to fire lines (marchar)
CREATE OR REPLACE FUNCTION fire_lines(
  p_line_ids UUID[],
  p_staff_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_fire_batch_id UUID;
BEGIN
  v_fire_batch_id := gen_random_uuid();
  
  UPDATE ticket_lines
  SET 
    is_fired = true,
    fired_at = NOW(),
    fire_batch_id = v_fire_batch_id
  WHERE id = ANY(p_line_ids)
    AND is_fired = false;
    
  -- Log to kds_events if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kds_events') THEN
    INSERT INTO kds_events (location_id, ticket_id, ticket_line_id, event_type, user_id, payload)
    SELECT 
      t.location_id,
      tl.ticket_id,
      tl.id,
      'march',
      p_staff_id,
      jsonb_build_object(
        'course', tl.course,
        'fire_batch_id', v_fire_batch_id,
        'item_name', tl.item_name
      )
    FROM ticket_lines tl
    INNER JOIN tickets t ON t.id = tl.ticket_id
    WHERE tl.id = ANY(p_line_ids);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pos_staff_profiles IS 'Perfiles de personal del POS (camareros, hosts)';
COMMENT ON COLUMN ticket_lines.seat_number IS 'Número de asiento (1..covers)';
COMMENT ON COLUMN ticket_lines.is_fired IS 'Si el item ha sido "marchado" para cocina';
COMMENT ON COLUMN ticket_lines.fire_batch_id IS 'Agrupa items marchados juntos';
COMMENT ON COLUMN ticket_lines.added_batch_id IS 'Agrupa items añadidos juntos (para separador visual)';
