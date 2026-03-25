-- ============================================================
-- Link Oscar Tejera's auth user to employee for iOS app context
-- user_id is GENERATED ALWAYS AS (profile_user_id), so we must
-- update profile_user_id instead.
-- ============================================================

-- Link auth user oscartejera99@gmail.com to the first seed employee
UPDATE employees
SET profile_user_id = 'ac95b1f7-9abe-411a-8f9b-896112e39c57'::uuid
WHERE id = 'e0000001-0000-0000-0000-000000000001';
