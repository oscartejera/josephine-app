-- ============================================================
-- Fix: add missing columns to planned_shifts that iOS app expects
-- The Swift PlannedShift model requires start_time, end_time, role, status
-- but these columns were never created in the database.
-- ============================================================

ALTER TABLE public.planned_shifts
  ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS end_time   TEXT DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS role       TEXT DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'published';

COMMENT ON COLUMN public.planned_shifts.start_time IS 'Shift start time HH:mm — default 09:00';
COMMENT ON COLUMN public.planned_shifts.end_time   IS 'Shift end time HH:mm — default 17:00';
COMMENT ON COLUMN public.planned_shifts.role       IS 'Employee role for this shift — default staff';
COMMENT ON COLUMN public.planned_shifts.status     IS 'draft | published — default published';
