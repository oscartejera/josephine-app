-- lint:disable-file (intentional cleanup of dead functions — see audit 2026-03-04)
-- =============================================================================
-- DROP DEAD SQL FUNCTIONS
-- These functions are never called by the application or any trigger/cron.
-- Verified via full-text search of src/ directory on 2026-03-04.
-- =============================================================================

-- Demo data generators (only used during initial seed, never again)
DROP FUNCTION IF EXISTS generate_daily_data CASCADE;
DROP FUNCTION IF EXISTS generate_pos_daily_data CASCADE;

-- Tip distribution (feature not launched, UI not wired)
DROP FUNCTION IF EXISTS calculate_tip_distribution CASCADE;

-- Never wired to any frontend page or hook
DROP FUNCTION IF EXISTS get_employee_revenue_scores CASCADE;
DROP FUNCTION IF EXISTS get_payroll_forecast CASCADE;
DROP FUNCTION IF EXISTS get_staffing_heatmap CASCADE;
DROP FUNCTION IF EXISTS get_staffing_recommendation CASCADE;

-- Replaced by get_labour_kpis (newer, unified)
DROP FUNCTION IF EXISTS get_labour_cost_by_date CASCADE;

-- Replaced by direct table query in frontend
DROP FUNCTION IF EXISTS get_labour_rule CASCADE;

-- Debug function, not user-facing
DROP FUNCTION IF EXISTS rpc_data_health CASCADE;

NOTIFY pgrst, 'reload schema';
