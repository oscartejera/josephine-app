-- ============================================================
-- ONE-TIME BACKFILL: Fix orphaned employees & invited users
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Backfill org_id on employees that have a location but NULL org_id
UPDATE employees e
SET org_id = l.org_id
FROM locations l
WHERE e.location_id = l.id
  AND e.org_id IS NULL;

-- 2. Create employee rows for invited users (profile + user_role exists, but no employee)
-- Note: user_id is a GENERATED ALWAYS column mirroring profile_user_id
INSERT INTO employees (full_name, profile_user_id, org_id, active)
SELECT p.full_name, p.user_id, p.group_id, true
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
LEFT JOIN employees e ON e.profile_user_id = p.user_id
WHERE e.id IS NULL
  AND p.group_id IS NOT NULL
ON CONFLICT DO NOTHING;
