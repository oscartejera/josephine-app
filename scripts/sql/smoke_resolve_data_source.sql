-- ============================================================
-- Smoke test: resolve_data_source reason refinement
-- Run these manually against the DB after applying the migration.
-- ============================================================

-- Pre-requisite: pick an org_id that exists in your groups table.
-- Replace '00000000-0000-0000-0000-000000000000' with a real org_id.

-- Case 1: manual=pos, integration disabled → manual_pos_blocked_integration_inactive
--   Setup: org_settings.data_source_mode='manual', manual_data_source='pos'
--          integrations.status='disabled' for that org
--   SELECT resolve_data_source('ORG_ID');
--   Expected: { "reason": "manual_pos_blocked_integration_inactive", "data_source": "demo", ... }

-- Case 2: manual=pos, integration active, never synced → manual_pos_blocked_never_synced
--   Setup: org_settings as above
--          integrations.status='active', metadata has no last_synced_at key
--   SELECT resolve_data_source('ORG_ID');
--   Expected: { "reason": "manual_pos_blocked_never_synced", "data_source": "demo", ... }

-- Case 3: manual=pos, integration active, sync > 24h → manual_pos_blocked_sync_stale
--   Setup: org_settings as above
--          integrations.status='active', metadata->>'last_synced_at' = now() - interval '48 hours'
--   SELECT resolve_data_source('ORG_ID');
--   Expected: { "reason": "manual_pos_blocked_sync_stale", "data_source": "demo", ... }

-- Case 4: manual=pos, integration active, sync fresh → manual_pos_ok
--   Setup: org_settings as above
--          integrations.status='active', metadata->>'last_synced_at' = now() - interval '1 hour'
--   SELECT resolve_data_source('ORG_ID');
--   Expected: { "reason": "manual_pos_ok", "data_source": "pos", ... }

-- Case 5: auto mode, no active integration → auto_demo_no_sync
--   Setup: org_settings.data_source_mode='auto'
--   SELECT resolve_data_source('ORG_ID');
--   Expected: { "reason": "auto_demo_no_sync", "data_source": "demo", ... }
