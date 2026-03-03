-- ============================================================
-- Phase 3: Full Nory Parity
-- 1. Event Calendar (dynamic events for forecast)
-- 2. Training Records (staff certs & expiry)
-- 3. AI Conversations (ops assistant chat history)
-- ============================================================


-- ─── 1. EVENT CALENDAR ──────────────────────────────────────
-- Dynamic local events that affect demand forecast

CREATE TABLE IF NOT EXISTS event_calendar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  name          text NOT NULL,
  event_type    text NOT NULL DEFAULT 'local'
                CHECK (event_type IN ('holiday','sports','concert','festival','local','weather','custom')),
  impact_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  recurrence    text DEFAULT 'none'
                CHECK (recurrence IN ('none','yearly','monthly','weekly')),
  city          text,
  source        text DEFAULT 'manual'
                CHECK (source IN ('manual','api','system')),
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_location_date
  ON event_calendar(location_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_org_date
  ON event_calendar(org_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_date_range
  ON event_calendar(event_date)
  WHERE is_active = true;

ALTER TABLE event_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON event_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert" ON event_calendar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "events_update" ON event_calendar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "events_delete" ON event_calendar FOR DELETE TO authenticated USING (true);
GRANT ALL ON event_calendar TO authenticated;


-- ─── 2. TRAINING RECORDS ────────────────────────────────────
-- Staff certifications, training, and expiry tracking

CREATE TABLE IF NOT EXISTS training_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_name       text NOT NULL,
  cert_type       text NOT NULL DEFAULT 'food_safety'
                  CHECK (cert_type IN ('food_safety','alcohol','first_aid','fire','allergen','haccp','custom')),
  issued_date     date,
  expiry_date     date,
  status          text NOT NULL DEFAULT 'valid'
                  CHECK (status IN ('valid','expiring','expired','pending')),
  document_url    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_employee
  ON training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_expiry
  ON training_records(expiry_date)
  WHERE status != 'expired';
CREATE INDEX IF NOT EXISTS idx_training_org
  ON training_records(org_id);

ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_select" ON training_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_insert" ON training_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "training_update" ON training_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "training_delete" ON training_records FOR DELETE TO authenticated USING (true);
GRANT ALL ON training_records TO authenticated;


-- ─── 3. AI CONVERSATIONS ───────────────────────────────────
-- Josephine AI assistant chat history

CREATE TABLE IF NOT EXISTS ai_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  user_id       uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  title         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  tool_calls      jsonb,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org
  ON ai_conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON ai_messages(conversation_id, created_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_select" ON ai_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversations_insert" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "conversations_update" ON ai_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "conversations_delete" ON ai_conversations FOR DELETE TO authenticated USING (true);
CREATE POLICY "messages_select" ON ai_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_insert" ON ai_messages FOR INSERT TO authenticated WITH CHECK (true);
GRANT ALL ON ai_conversations TO authenticated;
GRANT ALL ON ai_messages TO authenticated;


-- ─── 4. SEED DEFAULT SPANISH EVENTS ────────────────────────
-- Pre-populate with key Spanish holidays and Madrid events

INSERT INTO event_calendar (org_id, event_date, name, event_type, impact_multiplier, recurrence, city, source)
SELECT
  '00000000-0000-0000-0000-000000000000',
  d.event_date,
  d.name,
  d.event_type,
  d.impact,
  d.rec,
  d.city,
  'system'
FROM (VALUES
  ('2025-01-01'::date, 'Año Nuevo', 'holiday', 0.60, 'yearly', NULL),
  ('2025-01-06'::date, 'Reyes Magos', 'holiday', 0.70, 'yearly', NULL),
  ('2025-03-19'::date, 'San José (Fallas)', 'festival', 1.30, 'yearly', 'Valencia'),
  ('2025-04-18'::date, 'Viernes Santo', 'holiday', 0.75, 'yearly', NULL),
  ('2025-05-01'::date, 'Día del Trabajo', 'holiday', 0.80, 'yearly', NULL),
  ('2025-05-15'::date, 'San Isidro', 'festival', 1.25, 'yearly', 'Madrid'),
  ('2025-06-24'::date, 'San Juan', 'festival', 1.15, 'yearly', 'Barcelona'),
  ('2025-08-15'::date, 'Asunción', 'holiday', 0.85, 'yearly', NULL),
  ('2025-10-12'::date, 'Fiesta Nacional', 'holiday', 0.80, 'yearly', NULL),
  ('2025-11-01'::date, 'Todos los Santos', 'holiday', 0.75, 'yearly', NULL),
  ('2025-12-06'::date, 'Constitución', 'holiday', 0.80, 'yearly', NULL),
  ('2025-12-08'::date, 'Inmaculada', 'holiday', 0.80, 'yearly', NULL),
  ('2025-12-24'::date, 'Nochebuena', 'holiday', 1.40, 'yearly', NULL),
  ('2025-12-25'::date, 'Navidad', 'holiday', 0.50, 'yearly', NULL),
  ('2025-12-31'::date, 'Nochevieja', 'holiday', 1.50, 'yearly', NULL),
  ('2025-04-26'::date, 'Champions League QF', 'sports', 1.30, 'none', 'Madrid'),
  ('2025-06-01'::date, 'Champions League Final', 'sports', 1.40, 'none', 'Madrid'),
  ('2025-10-11'::date, 'Liga Clásico', 'sports', 1.25, 'none', 'Madrid'),
  ('2026-05-15'::date, 'San Isidro 2026', 'festival', 1.25, 'none', 'Madrid'),
  ('2026-06-24'::date, 'San Juan 2026', 'festival', 1.15, 'none', 'Barcelona')
) AS d(event_date, name, event_type, impact, rec, city)
ON CONFLICT DO NOTHING;
