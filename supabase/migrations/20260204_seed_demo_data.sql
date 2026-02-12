-- legacy no-op: original seed migration referenced columns that no longer
-- exist on cdm_items (location_id, unit_price, cost_price, active).
-- The seed data was already applied to production; this file is kept so
-- Supabase Preview can replay the migration history without errors.
select 1;
