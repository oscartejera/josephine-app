-- ============================================================
-- Grant INSERT/UPDATE/DELETE on announcements to authenticated
-- so managers can create & manage announcements from the UI.
-- ============================================================

GRANT INSERT, UPDATE, DELETE ON announcements TO authenticated;
