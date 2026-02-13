-- ============================================================
-- Refine resolve_data_source: more expressive "blocked" reasons
-- when manual→POS cannot be fulfilled.
--
-- Backwards compatible: same function signature, same JSON shape.
-- Only the `reason` strings change for the manual-POS-blocked case:
--
--   OLD: manual_pos_blocked_no_sync   (single catch-all)
--   NEW: manual_pos_blocked_integration_inactive  (no active integration)
--        manual_pos_blocked_never_synced           (active but never synced)
--        manual_pos_blocked_sync_stale             (active but sync > 24h)
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_mode         text;
  v_manual_src   text;
  v_status       text;           -- best integration status for this org
  v_last_synced  timestamptz;    -- most recent sync across ALL statuses
  v_data_source  text;
  v_reason       text;
BEGIN
  -- 1. Read org_settings (default to 'auto' if no row)
  SELECT data_source_mode, manual_data_source
    INTO v_mode, v_manual_src
    FROM org_settings
   WHERE org_id = p_org_id;

  IF NOT FOUND THEN
    v_mode := 'auto';
    v_manual_src := NULL;
  END IF;

  -- 2. Find the "best" integration status for this org's Square provider.
  --    Priority: active > pending > any other.
  SELECT status
    INTO v_status
    FROM integrations
   WHERE org_id = p_org_id
     AND provider = 'square'
   ORDER BY
     CASE status
       WHEN 'active' THEN 0
       WHEN 'pending' THEN 1
       ELSE 2
     END
   LIMIT 1;

  -- 3. Find latest sync timestamp across ALL Square integrations for this org
  --    (not filtered by status — we want to know if sync *ever* happened).
  SELECT max((metadata->>'last_synced_at')::timestamptz)
    INTO v_last_synced
    FROM integrations
   WHERE org_id = p_org_id
     AND provider = 'square'
     AND metadata ? 'last_synced_at';

  -- 4. Resolve based on mode
  IF v_mode = 'auto' THEN
    -- Auto mode: never blocked; use POS only if active + recent sync
    IF v_status = 'active'
       AND v_last_synced IS NOT NULL
       AND v_last_synced >= now() - interval '24 hours' THEN
      v_data_source := 'pos';
      v_reason := 'auto_pos_recent';
    ELSE
      v_data_source := 'demo';
      v_reason := 'auto_demo_no_sync';
    END IF;

  ELSE  -- manual mode
    IF v_manual_src = 'demo' THEN
      v_data_source := 'demo';
      v_reason := 'manual_demo';

    ELSIF v_manual_src = 'pos' THEN
      -- Three distinct blocked causes:
      IF v_status IS DISTINCT FROM 'active' THEN
        -- (a) No active integration (missing, pending, disabled, error…)
        v_data_source := 'demo';
        v_reason := 'manual_pos_blocked_integration_inactive';

      ELSIF v_last_synced IS NULL THEN
        -- (b) Integration is active but has never synced
        v_data_source := 'demo';
        v_reason := 'manual_pos_blocked_never_synced';

      ELSIF v_last_synced < now() - interval '24 hours' THEN
        -- (c) Integration is active but last sync is stale (>24h)
        v_data_source := 'demo';
        v_reason := 'manual_pos_blocked_sync_stale';

      ELSE
        -- All good: active integration with recent sync
        v_data_source := 'pos';
        v_reason := 'manual_pos_ok';
      END IF;

    ELSE
      -- manual mode but no manual_data_source set: fallback to auto logic
      v_data_source := 'demo';
      v_reason := 'auto_demo_no_sync';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'data_source',   v_data_source,
    'mode',          v_mode,
    'reason',        v_reason,
    'last_synced_at', v_last_synced
  );
END;
$$;
