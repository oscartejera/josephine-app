-- ============================================================
-- PR4: resolve_data_source auto-switch + stale fallback
--
-- Safety: CREATE OR REPLACE only, no schema changes.
--
-- Returns jsonb with keys:
--   data_source   : 'pos' | 'demo'
--   mode          : 'auto' | 'manual'
--   reason        : string explaining the decision
--   blocked       : boolean
--   last_synced_at: timestamptz | null
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode             text;
  v_threshold_hours  int;
  v_last_synced_at   timestamptz;
  v_last_pos_order   timestamptz;
  v_last_activity    timestamptz;
  v_within_threshold boolean;
  v_pos_has_data     boolean;
BEGIN
  -- ── 1. Read org settings ───────────────────────────────────
  SELECT
    COALESCE(os.data_source_mode, 'auto'),
    COALESCE(os.demo_fallback_after_hours, 24)
  INTO v_mode, v_threshold_hours
  FROM org_settings os
  WHERE os.org_id = p_org_id;

  -- If no row exists, default to auto / 24h
  IF NOT FOUND THEN
    v_mode := 'auto';
    v_threshold_hours := 24;
  END IF;

  -- ── 2. Compute last_synced_at ──────────────────────────────
  -- Greatest of:
  --   a) integrations.metadata->>'last_synced_at'
  --   b) integrations.metadata->>'last_sync_ended_at'
  --   c) max(integration_sync_runs.finished_at) via integrations.id
  SELECT GREATEST(
    MAX((i.metadata->>'last_synced_at')::timestamptz),
    MAX((i.metadata->>'last_sync_ended_at')::timestamptz),
    MAX(isr.finished_at)
  )
  INTO v_last_synced_at
  FROM integrations i
  LEFT JOIN integration_sync_runs isr ON isr.integration_id = i.id
  WHERE i.org_id = p_org_id;

  -- ── 3. Compute last POS order ──────────────────────────────
  SELECT MAX(o.closed_at)
  INTO v_last_pos_order
  FROM cdm_orders o
  WHERE o.org_id = p_org_id
    AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL);

  v_pos_has_data := (v_last_pos_order IS NOT NULL);

  -- ── 4. Determine last activity & threshold ─────────────────
  v_last_activity := GREATEST(v_last_synced_at, v_last_pos_order);
  v_within_threshold := (
    v_last_activity IS NOT NULL
    AND v_last_activity >= (now() - make_interval(hours => v_threshold_hours))
  );

  -- ── 5. Apply rules ────────────────────────────────────────

  -- A) manual_demo
  IF v_mode = 'manual_demo' THEN
    RETURN jsonb_build_object(
      'data_source',    'demo',
      'mode',           'manual',
      'reason',         'manual_demo',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  END IF;

  -- B) manual_pos
  IF v_mode = 'manual_pos' THEN
    IF v_pos_has_data AND v_within_threshold THEN
      RETURN jsonb_build_object(
        'data_source',    'pos',
        'mode',           'manual',
        'reason',         'manual_pos_recent',
        'blocked',        false,
        'last_synced_at', v_last_synced_at
      );
    ELSE
      RETURN jsonb_build_object(
        'data_source',    'demo',
        'mode',           'manual',
        'reason',         'manual_pos_blocked_no_sync',
        'blocked',        true,
        'last_synced_at', v_last_synced_at
      );
    END IF;
  END IF;

  -- C) auto (default)
  IF v_pos_has_data AND v_within_threshold THEN
    RETURN jsonb_build_object(
      'data_source',    'pos',
      'mode',           'auto',
      'reason',         'auto_pos_recent',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  ELSE
    RETURN jsonb_build_object(
      'data_source',    'demo',
      'mode',           'auto',
      'reason',         'auto_demo_no_sync',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_data_source(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
