-- ============================================================
-- Add break tracking to employee_clock_records
-- employee_breaks: tracks paid/unpaid breaks during shifts
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_breaks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_record_id uuid NOT NULL REFERENCES employee_clock_records(id) ON DELETE CASCADE,
  break_start     timestamptz NOT NULL DEFAULT now(),
  break_end       timestamptz,
  break_type      text NOT NULL DEFAULT 'unpaid'
                  CHECK (break_type IN ('paid','unpaid','meal')),
  duration_minutes int GENERATED ALWAYS AS (
    CASE WHEN break_end IS NOT NULL
      THEN EXTRACT(EPOCH FROM (break_end - break_start))::int / 60
      ELSE NULL
    END
  ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breaks_clock_record
  ON employee_breaks(clock_record_id);

-- RLS
ALTER TABLE employee_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breaks_select" ON employee_breaks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "breaks_insert" ON employee_breaks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "breaks_update" ON employee_breaks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "breaks_delete" ON employee_breaks
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON employee_breaks TO authenticated;
