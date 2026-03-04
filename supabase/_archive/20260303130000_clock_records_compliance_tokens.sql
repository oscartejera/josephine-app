-- ============================================================
-- Create employee_clock_records & compliance_tokens tables
-- These tables are referenced by the frontend but were missing.
-- ============================================================

-- ─── 1. employee_clock_records ──────────────────────────────
-- Stores clock-in/out records for employees with optional GPS.
-- Used by: WorkforceTimesheet, WorkforceTeam, TeamHome,
--          TeamPay, ClockInPanel

CREATE TABLE IF NOT EXISTS employee_clock_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  clock_in    timestamptz NOT NULL DEFAULT now(),
  clock_out   timestamptz,
  clock_in_lat  double precision,
  clock_in_lng  double precision,
  clock_out_lat double precision,
  clock_out_lng double precision,
  source      text NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual','geo','kiosk','api')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clock_records_employee
  ON employee_clock_records(employee_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_clock_records_location
  ON employee_clock_records(location_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_clock_records_active
  ON employee_clock_records(location_id)
  WHERE clock_out IS NULL;

-- RLS
ALTER TABLE employee_clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clock_records_select" ON employee_clock_records
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clock_records_insert" ON employee_clock_records
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "clock_records_update" ON employee_clock_records
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "clock_records_delete" ON employee_clock_records
  FOR DELETE TO authenticated
  USING (true);


-- ─── 2. compliance_tokens ───────────────────────────────────
-- Stores compliance certificates per legal entity (TGSS/AEAT/SEPE).
-- When no rows exist, the payroll module runs in Sandbox mode.
-- Used by: Payroll.tsx

CREATE TABLE IF NOT EXISTS compliance_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id  uuid NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('tgss','aeat','sepe','other')),
  certificate_ref  text,
  expires_at       timestamptz,
  is_active        boolean NOT NULL DEFAULT true,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_tokens_entity
  ON compliance_tokens(legal_entity_id);

-- RLS
ALTER TABLE compliance_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_tokens_select" ON compliance_tokens
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "compliance_tokens_insert" ON compliance_tokens
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "compliance_tokens_update" ON compliance_tokens
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "compliance_tokens_delete" ON compliance_tokens
  FOR DELETE TO authenticated
  USING (true);

-- Grant access
GRANT ALL ON employee_clock_records TO authenticated;
GRANT ALL ON compliance_tokens TO authenticated;
