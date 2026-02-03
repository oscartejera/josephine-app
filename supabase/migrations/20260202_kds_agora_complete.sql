-- KDS Ágora-Style Complete Implementation
-- Adds monitors, order flags, events, and Scan&Pay integration

-- 1) KDS Monitors Configuration
CREATE TABLE IF NOT EXISTS kds_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fast_food', 'restaurant', 'expeditor', 'customer_display')),
  destinations TEXT[] NOT NULL DEFAULT '{}', -- e.g. '{kitchen,bar,prep}'
  courses INT[] DEFAULT NULL, -- Filter by course numbers, NULL = all
  primary_statuses TEXT[] NOT NULL DEFAULT '{pending,preparing}',
  secondary_statuses TEXT[] NOT NULL DEFAULT '{ready,served}',
  view_mode TEXT NOT NULL DEFAULT 'classic' CHECK (view_mode IN ('rows_interactive', 'classic', 'mixed')),
  rows_count INT DEFAULT 3,
  newest_side TEXT DEFAULT 'right' CHECK (newest_side IN ('right', 'left')),
  auto_serve_on_finish BOOLEAN DEFAULT false,
  history_window_minutes INT DEFAULT 30,
  show_start_btn BOOLEAN DEFAULT true,
  show_finish_btn BOOLEAN DEFAULT true,
  show_serve_btn BOOLEAN DEFAULT false,
  printer_id TEXT DEFAULT NULL,
  print_on_line_complete BOOLEAN DEFAULT false,
  print_on_order_complete BOOLEAN DEFAULT false,
  show_print_button BOOLEAN DEFAULT false,
  styles_rules JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kds_monitors_location ON kds_monitors(location_id);
CREATE INDEX IF NOT EXISTS idx_kds_monitors_active ON kds_monitors(location_id, is_active);

-- 2) Ticket Order Flags (para "marchar" por curso)
CREATE TABLE IF NOT EXISTS ticket_order_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  course INT NOT NULL,
  is_marched BOOLEAN DEFAULT false,
  marched_at TIMESTAMPTZ DEFAULT NULL,
  marched_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, course)
);

CREATE INDEX IF NOT EXISTS idx_order_flags_ticket ON ticket_order_flags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_order_flags_marched ON ticket_order_flags(ticket_id, course, is_marched);

-- 3) KDS Events (Auditoría completa)
CREATE TABLE IF NOT EXISTS kds_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_line_id UUID DEFAULT NULL REFERENCES ticket_lines(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'start', 'finish', 'serve', 'march', 'unmarch', 'add_items', 'print', 'recall')),
  user_id UUID DEFAULT NULL,
  monitor_id UUID DEFAULT NULL REFERENCES kds_monitors(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kds_events_location ON kds_events(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kds_events_ticket ON kds_events(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kds_events_type ON kds_events(event_type, created_at DESC);

-- 4) Scan&Pay Integration (optional but recommended)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scanpay_token TEXT UNIQUE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS origin_device_id TEXT DEFAULT NULL;

-- 5) Insert Default Monitors (Seed)
INSERT INTO kds_monitors (
  location_id,
  name,
  type,
  destinations,
  primary_statuses,
  secondary_statuses,
  view_mode,
  show_start_btn,
  show_finish_btn,
  show_serve_btn
)
SELECT 
  id as location_id,
  'Cocina Principal',
  'restaurant',
  ARRAY['kitchen']::TEXT[],
  ARRAY['pending', 'preparing']::TEXT[],
  ARRAY['ready']::TEXT[],
  'classic',
  true,
  true,
  false
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM kds_monitors 
  WHERE kds_monitors.location_id = locations.id 
  AND kds_monitors.name = 'Cocina Principal'
)
ON CONFLICT DO NOTHING;

INSERT INTO kds_monitors (
  location_id,
  name,
  type,
  destinations,
  primary_statuses,
  secondary_statuses,
  view_mode,
  show_start_btn,
  show_finish_btn,
  show_serve_btn
)
SELECT 
  id as location_id,
  'Barra',
  'restaurant',
  ARRAY['bar']::TEXT[],
  ARRAY['pending', 'preparing']::TEXT[],
  ARRAY['ready']::TEXT[],
  'classic',
  true,
  true,
  false
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM kds_monitors 
  WHERE kds_monitors.location_id = locations.id 
  AND kds_monitors.name = 'Barra'
)
ON CONFLICT DO NOTHING;

INSERT INTO kds_monitors (
  location_id,
  name,
  type,
  destinations,
  primary_statuses,
  secondary_statuses,
  view_mode,
  show_start_btn,
  show_finish_btn,
  show_serve_btn
)
SELECT 
  id as location_id,
  'Pase/Expeditor',
  'expeditor',
  ARRAY['kitchen', 'bar', 'prep']::TEXT[],
  ARRAY['ready']::TEXT[],
  ARRAY['served']::TEXT[],
  'classic',
  false,
  false,
  true
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM kds_monitors 
  WHERE kds_monitors.location_id = locations.id 
  AND kds_monitors.name = 'Pase/Expeditor'
)
ON CONFLICT DO NOTHING;

-- 6) Functions for common operations
CREATE OR REPLACE FUNCTION march_order(
  p_ticket_id UUID,
  p_course INT,
  p_user_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO ticket_order_flags (ticket_id, course, is_marched, marched_at, marched_by)
  VALUES (p_ticket_id, p_course, true, NOW(), p_user_id)
  ON CONFLICT (ticket_id, course) 
  DO UPDATE SET is_marched = true, marched_at = NOW(), marched_by = p_user_id;
  
  INSERT INTO kds_events (location_id, ticket_id, event_type, user_id, payload)
  SELECT t.location_id, p_ticket_id, 'march', p_user_id, jsonb_build_object('course', p_course)
  FROM tickets t WHERE t.id = p_ticket_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unmarch_order(
  p_ticket_id UUID,
  p_course INT
) RETURNS void AS $$
BEGIN
  UPDATE ticket_order_flags
  SET is_marched = false, marched_at = NULL
  WHERE ticket_id = p_ticket_id AND course = p_course;
  
  INSERT INTO kds_events (location_id, ticket_id, event_type, payload)
  SELECT t.location_id, p_ticket_id, 'unmarch', jsonb_build_object('course', p_course)
  FROM tickets t WHERE t.id = p_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- 7) Update ticket_lines to log events on status change
CREATE OR REPLACE FUNCTION log_kds_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log event when prep_status changes
  IF (TG_OP = 'UPDATE' AND OLD.prep_status IS DISTINCT FROM NEW.prep_status) THEN
    INSERT INTO kds_events (location_id, ticket_id, ticket_line_id, event_type, payload)
    SELECT 
      t.location_id,
      NEW.ticket_id,
      NEW.id,
      CASE NEW.prep_status
        WHEN 'preparing' THEN 'start'
        WHEN 'ready' THEN 'finish'
        WHEN 'served' THEN 'serve'
        ELSE 'sent'
      END,
      jsonb_build_object(
        'from_status', OLD.prep_status,
        'to_status', NEW.prep_status,
        'item_name', NEW.item_name
      )
    FROM tickets t WHERE t.id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_lines_status_change
  AFTER UPDATE ON ticket_lines
  FOR EACH ROW
  EXECUTE FUNCTION log_kds_status_change();

COMMENT ON TABLE kds_monitors IS 'Configuración de monitores KDS por location (tipo Ágora)';
COMMENT ON TABLE ticket_order_flags IS 'Flags de "marchar" por curso para KDS';
COMMENT ON TABLE kds_events IS 'Auditoría completa de eventos KDS';
