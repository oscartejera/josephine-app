-- legacy no-op: original seed function (seed_josephine_demo_data) referenced
-- columns that do not exist on cdm_items (location_id, unit_price, cost_price,
-- active). The actual schema uses org_id, price, is_active, and the
-- location↔item relationship goes through cdm_location_items.
--
-- This migration already ran on production; the function was never called
-- (SELECT was commented out). Replaced with no-op so Supabase Preview
-- can replay migration history cleanly.
select 1;
