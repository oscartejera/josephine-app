-- Fix: resolver ignores integration status + integrations RLS blocks disconnect
-- ============================================================

-- 1. Fix integrations RLS: allow org members to write (disconnect was failing)
DROP POLICY IF EXISTS integrations_write ON integrations;
CREATE POLICY integrations_write ON integrations
  FOR ALL
  USING (is_org_member(org_id, auth.uid()))
  WITH CHECK (is_org_member(org_id, auth.uid()));

-- 2. Fix resolve_data_source: check integration status before returning POS
-- Previously, it only checked cdm_orders existence, so even after disconnect
-- it would still return 'pos'. Now it requires an active integration.
CREATE OR REPLACE FUNCTION public.resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_mode             text;
  v_threshold_hours  int;
  v_last_synced_at   timestamptz;
  v_last_pos_order   timestamptz;
  v_last_activity    timestamptz;
  v_within_threshold boolean;
  v_pos_has_data     boolean;
  v_has_active_integ boolean;
BEGIN
  -- 1. Read org settings
  SELECT
    COALESCE(os.data_source_mode, 'auto'),
    COALESCE(os.demo_fallback_after_hours, 24)
  INTO v_mode, v_threshold_hours
  FROM org_settings os
  WHERE os.org_id = p_org_id;

  IF NOT FOUND THEN
    v_mode := 'auto';
    v_threshold_hours := 24;
  END IF;

  -- 2. Check if there is an ACTIVE integration
  SELECT EXISTS(
    SELECT 1 FROM integrations i
    WHERE i.org_id = p_org_id
      AND i.status = 'active'
  ) INTO v_has_active_integ;

  -- 3. Compute last_synced_at (only from active integrations)
  SELECT GREATEST(
    MAX((i.metadata->>'last_synced_at')::timestamptz),
    MAX((i.metadata->>'last_sync_ended_at')::timestamptz),
    MAX(isr.finished_at)
  )
  INTO v_last_synced_at
  FROM integrations i
  LEFT JOIN integration_sync_runs isr ON isr.integration_id = i.id
  WHERE i.org_id = p_org_id
    AND i.status = 'active';

  -- 4. Compute last POS order
  SELECT MAX(o.closed_at)
  INTO v_last_pos_order
  FROM cdm_orders o
  WHERE o.org_id = p_org_id
    AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL);

  -- POS is available ONLY if integration is active AND orders exist
  v_pos_has_data := (v_has_active_integ AND v_last_pos_order IS NOT NULL);

  -- 5. Determine threshold
  v_last_activity := GREATEST(v_last_synced_at, v_last_pos_order);
  v_within_threshold := (
    v_last_activity IS NOT NULL
    AND v_last_activity >= (now() - make_interval(hours => v_threshold_hours))
  );

  -- 6. Apply rules

  -- A) manual_demo — always demo
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
$fn$;
