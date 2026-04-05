-- =============================================================================
-- JOSEPHINE DB v2 — HELPER FUNCTIONS
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTH HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM org_memberships WHERE org_id = p_org_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM org_memberships WHERE org_id = p_org_id AND user_id = p_user_id AND role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.org_role_of(p_org_id uuid, p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM org_memberships WHERE org_id = p_org_id AND user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION get_user_accessible_locations(_user_id uuid)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner','manager')) THEN
    RETURN QUERY SELECT l.id FROM locations l JOIN org_memberships om ON om.org_id = l.org_id WHERE om.user_id = _user_id AND l.active = true;
  ELSE
    RETURN QUERY SELECT lm.location_id FROM location_memberships lm JOIN locations l ON l.id = lm.location_id WHERE lm.user_id = _user_id AND l.active = true;
  END IF;
END;$$;

CREATE OR REPLACE FUNCTION get_user_has_global_scope(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_key text, module text)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_role text;
BEGIN
  SELECT om.role::text INTO v_role FROM org_memberships om WHERE om.user_id = _user_id
  ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
  IF v_role IS NULL THEN
    SELECT lm.role::text INTO v_role FROM location_memberships lm WHERE lm.user_id = _user_id
    ORDER BY CASE lm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
  END IF;
  IF v_role = 'owner' THEN
    RETURN QUERY VALUES ('sales.view','sales'),('sales.export','sales'),('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('settings.manage','settings'),('team.view','team'),('team.manage','team'),
      ('payroll.view','payroll'),('payroll.manage','payroll'),('reports.view','reports'),('forecast.view','forecast'),
      ('ai.view','ai'),('integrations.manage','integrations');
  ELSIF v_role = 'manager' THEN
    RETURN QUERY VALUES ('sales.view','sales'),('sales.export','sales'),('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('team.view','team'),('payroll.view','payroll'),('reports.view','reports'),
      ('forecast.view','forecast'),('ai.view','ai');
  ELSIF v_role = 'staff' THEN
    RETURN QUERY VALUES ('sales.view','sales'),('labour.view','labour'),('inventory.view','inventory'),
      ('menu.view','menu'),('reports.view','reports');
  END IF;
  RETURN;
END;$$;

CREATE OR REPLACE FUNCTION get_user_roles_with_scope(_user_id uuid)
RETURNS TABLE(role_name text, role_id uuid, location_id uuid, location_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT om.role::text, om.org_id, NULL::uuid, NULL::text FROM org_memberships om WHERE om.user_id = _user_id
    UNION ALL
    SELECT lm.role::text, lm.location_id, lm.location_id, l.name::text FROM location_memberships lm
    JOIN locations l ON l.id = lm.location_id WHERE lm.user_id = _user_id;
END;$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DATA SOURCE RESOLVER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_data_source(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_mode text; v_threshold_hours int;
  v_last_synced_at timestamptz; v_last_pos_order timestamptz;
  v_last_activity timestamptz; v_within_threshold boolean;
  v_pos_has_data boolean; v_has_active_integ boolean;
BEGIN
  SELECT COALESCE(os.data_source_mode,'auto'), COALESCE(os.demo_fallback_after_hours,24)
  INTO v_mode, v_threshold_hours FROM org_settings os WHERE os.org_id = p_org_id;
  IF NOT FOUND THEN v_mode:='auto'; v_threshold_hours:=24; END IF;

  SELECT EXISTS(SELECT 1 FROM integrations i WHERE i.org_id = p_org_id AND i.status = 'active') INTO v_has_active_integ;

  SELECT GREATEST(MAX((i.metadata->>'last_synced_at')::timestamptz), MAX(isr.finished_at))
  INTO v_last_synced_at FROM integrations i LEFT JOIN integration_sync_runs isr ON isr.integration_id = i.id
  WHERE i.org_id = p_org_id AND i.status = 'active';

  SELECT MAX(o.closed_at) INTO v_last_pos_order FROM cdm_orders o
  WHERE o.org_id = p_org_id AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL);

  v_pos_has_data := (v_has_active_integ AND v_last_pos_order IS NOT NULL);
  v_last_activity := GREATEST(v_last_synced_at, v_last_pos_order);
  v_within_threshold := (v_last_activity IS NOT NULL AND v_last_activity >= (now() - make_interval(hours => v_threshold_hours)));

  IF v_mode = 'manual_demo' THEN
    RETURN jsonb_build_object('data_source','demo','mode','manual','reason','manual_demo','blocked',false,'last_synced_at',v_last_synced_at);
  END IF;
  IF v_mode = 'manual_pos' THEN
    IF v_pos_has_data AND v_within_threshold THEN
      RETURN jsonb_build_object('data_source','pos','mode','manual','reason','manual_pos_recent','blocked',false,'last_synced_at',v_last_synced_at);
    ELSE
      RETURN jsonb_build_object('data_source','demo','mode','manual','reason','manual_pos_blocked_no_sync','blocked',true,'last_synced_at',v_last_synced_at);
    END IF;
  END IF;
  IF v_pos_has_data AND v_within_threshold THEN
    RETURN jsonb_build_object('data_source','pos','mode','auto','reason','auto_pos_recent','blocked',false,'last_synced_at',v_last_synced_at);
  ELSE
    RETURN jsonb_build_object('data_source','demo','mode','auto','reason','auto_demo_no_sync','blocked',false,'last_synced_at',v_last_synced_at);
  END IF;
END;$fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- LABOUR RULE HELPER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_labour_rule(p_org_id uuid, p_location_id uuid, p_key text, p_default numeric DEFAULT 0)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT rule_value FROM labour_rules WHERE org_id = p_org_id AND location_id = p_location_id AND rule_key = p_key),
    (SELECT rule_value FROM labour_rules WHERE org_id = p_org_id AND location_id IS NULL AND rule_key = p_key),
    p_default
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_compute_variance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.variance := NEW.stock_actual - NEW.stock_expected;
  IF NEW.stock_expected > 0 THEN
    NEW.variance_pct := ROUND((NEW.stock_actual - NEW.stock_expected) / NEW.stock_expected * 100, 1);
  ELSE NEW.variance_pct := 0; END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_inventory_counts_variance ON inventory_counts;
CREATE TRIGGER trg_inventory_counts_variance
  BEFORE INSERT OR UPDATE ON inventory_counts
  FOR EACH ROW EXECUTE FUNCTION trg_compute_variance();

CREATE OR REPLACE FUNCTION trg_waste_auto_decrement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.movement_type = 'waste' THEN
    UPDATE inventory_item_location SET on_hand = GREATEST(on_hand + NEW.qty_delta, 0), updated_at = now()
    WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
    UPDATE inventory_items SET current_stock = GREATEST(COALESCE(current_stock,0) + NEW.qty_delta, 0) WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_stock_waste_decrement ON stock_movements;
CREATE TRIGGER trg_stock_waste_decrement
  AFTER INSERT ON stock_movements FOR EACH ROW
  WHEN (NEW.movement_type = 'waste') EXECUTE FUNCTION trg_waste_auto_decrement();

-- MV refresh job trigger
CREATE OR REPLACE FUNCTION public.trg_enqueue_refresh_mvs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id uuid; v_existing bigint;
BEGIN
  SELECT i.org_id INTO v_org_id FROM integrations i WHERE i.id = NEW.integration_id;
  IF v_org_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_existing FROM jobs WHERE job_type = 'refresh_mvs' AND org_id = v_org_id
    AND status = 'queued' AND created_at >= (now() - interval '10 minutes');
  IF v_existing > 0 THEN RETURN NEW; END IF;
  INSERT INTO jobs (job_type, org_id, status, priority, payload)
  VALUES ('refresh_mvs', v_org_id, 'queued', 50, jsonb_build_object('org_id', v_org_id, 'triggered_by', 'sync_success'));
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_success_refresh_mvs ON integration_sync_runs;
CREATE TRIGGER trg_sync_success_refresh_mvs
  AFTER UPDATE OF status ON integration_sync_runs FOR EACH ROW
  WHEN (NEW.status = 'success' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_enqueue_refresh_mvs();

-- ═══════════════════════════════════════════════════════════════════════════
-- MV REFRESH
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ops.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
DECLARE
  t_start timestamptz; log_id bigint; results jsonb := '[]'::jsonb;
  mv_name text; mv_start timestamptz; mv_ms integer; mv_rows bigint;
  mv_list text[] := ARRAY['product_sales_daily_unified_mv','sales_hourly_unified_mv',
    'product_sales_daily_unified_mv_v2','sales_hourly_unified_mv_v2','mart_kpi_daily_mv','mart_sales_category_daily_mv'];
BEGIN
  t_start := clock_timestamp();
  INSERT INTO ops.mv_refresh_log (triggered_by, status) VALUES (p_triggered_by, 'running') RETURNING id INTO log_id;
  FOREACH mv_name IN ARRAY mv_list LOOP
    IF to_regclass(mv_name) IS NULL THEN
      results := results || jsonb_build_object('view', mv_name, 'skipped', true);
      CONTINUE;
    END IF;
    mv_start := clock_timestamp();
    EXECUTE format('SELECT count(*) FROM %I', mv_name) INTO mv_rows;
    IF mv_rows = 0 THEN EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
    ELSE EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name); END IF;
    mv_ms := extract(milliseconds from clock_timestamp() - mv_start)::integer;
    results := results || jsonb_build_object('view', mv_name, 'ms', mv_ms);
  END LOOP;
  UPDATE ops.mv_refresh_log SET finished_at = clock_timestamp(),
    duration_ms = extract(milliseconds from clock_timestamp() - t_start)::integer,
    views_refreshed = mv_list, status = 'success', metadata = jsonb_build_object('details', results)
  WHERE id = log_id;
  RETURN jsonb_build_object('log_id', log_id, 'duration_ms', extract(milliseconds from clock_timestamp() - t_start)::integer, 'views', results);
EXCEPTION WHEN OTHERS THEN
  UPDATE ops.mv_refresh_log SET finished_at = clock_timestamp(), status = 'error', error_message = SQLERRM WHERE id = log_id;
  RAISE;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$ SELECT ops.refresh_all_mvs(p_triggered_by); $$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_data_source(uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- LEGACY COLUMN SYNC TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- locations.group_id = org_id
CREATE OR REPLACE FUNCTION trg_sync_location_group_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.group_id := NEW.org_id; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_locations_group_id ON locations;
CREATE TRIGGER trg_locations_group_id BEFORE INSERT OR UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION trg_sync_location_group_id();

-- inventory_items.group_id = org_id
CREATE OR REPLACE FUNCTION trg_sync_inv_group_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.group_id := NEW.org_id; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_inv_items_group_id ON inventory_items;
CREATE TRIGGER trg_inv_items_group_id BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION trg_sync_inv_group_id();

-- employees.active = (status = 'active')
CREATE OR REPLACE FUNCTION trg_sync_employee_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.active := (NEW.status = 'active'); RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_employees_active ON employees;
CREATE TRIGGER trg_employees_active BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION trg_sync_employee_active();

-- stock_movements.inventory_item_id = item_id
CREATE OR REPLACE FUNCTION trg_sync_sm_inv_item_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.inventory_item_id := NEW.item_id; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_sm_inv_item_id ON stock_movements;
CREATE TRIGGER trg_sm_inv_item_id BEFORE INSERT OR UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION trg_sync_sm_inv_item_id();

-- cash_counts_daily.day = date
CREATE OR REPLACE FUNCTION trg_sync_cash_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.day := NEW.date; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_cash_day ON cash_counts_daily;
CREATE TRIGGER trg_cash_day BEFORE INSERT OR UPDATE ON cash_counts_daily
  FOR EACH ROW EXECUTE FUNCTION trg_sync_cash_day();
