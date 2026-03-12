-- Employee contracts: add contracted_hours and contract_type columns
-- Run this migration via Supabase SQL Editor (Dashboard → SQL → New Query)

ALTER TABLE employees ADD COLUMN IF NOT EXISTS contracted_hours numeric DEFAULT 40;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'full_time';

-- contract_type values: 'full_time' | 'part_time' | 'temporary' | 'intern'

COMMENT ON COLUMN employees.contracted_hours IS 'Weekly contracted hours for this employee';
COMMENT ON COLUMN employees.contract_type IS 'Employment contract type: full_time, part_time, temporary, intern';
