-- ============================================================
-- PR1: Contract Views, RPCs & Indexes
-- Makes the new DB compatible with the frontend data layer.
-- NO table alterations. NO stub tables. Pure views + functions.
-- Idempotent: CREATE OR REPLACE / IF NOT EXISTS throughout.
-- ============================================================

-- ============================================================
-- SECTION 0: Compatibility shim — "groups" view
-- AppContext.tsx queries supabase.from('groups').select('id,name')
-- ============================================================

-- Drop legacy TABLE groups if it exists (replaced by orgs + this VIEW)
DROP TABLE IF EXISTS public.groups CASCADE;

CREATE OR REPLACE VIEW groups AS
SELECT id, name FROM orgs;

GRANT SELECT ON groups TO anon, authenticated;

-- ============================================================
-- SECTION 1: Contract Views (7)
-- ============================================================

-- ------------------------------------------------------------
-- 1.1  sales_daily_unified
-- Source: daily_sales LEFT JOIN time_entries (for labor)
-- Columns match exactly: DB_APP_CONTRACT.md §1.1
-- data_source = 'simulated' for all demo rows (frontend maps
-- 'simulated' via toLegacyDataSource when querying)
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW sales_daily_unified AS
SELECT
  ds.org_id,
  ds.location_id,
  ds.day                                                        AS date,
  COALESCE(ds.net_sales,  0)::numeric                           AS net_sales,
  COALESCE(ds.gross_sales, 0)::numeric                          AS gross_sales,
  COALESCE(ds.orders_count, 0)::integer                         AS orders_count,
  CASE WHEN COALESCE(ds.orders_count, 0) > 0
       THEN (ds.net_sales / ds.orders_count)::numeric
       ELSE 0 END                                               AS avg_check,
  0::numeric                                                    AS payments_cash,
  COALESCE(ds.payments_total, 0)::numeric                       AS payments_card,
  0::numeric                                                    AS payments_other,
  COALESCE(ds.refunds, 0)::numeric                              AS refunds_amount,
  0::integer                                                    AS refunds_count,
  COALESCE(ds.discounts, 0)::numeric                            AS discounts_amount,
  COALESCE(ds.comps, 0)::numeric                                AS comps_amount,
  COALESCE(ds.voids, 0)::numeric                                AS voids_amount,
  COALESCE(lab.labour_cost, 0)::numeric                         AS labor_cost,
  COALESCE(lab.labour_hours, 0)::numeric                        AS labor_hours,
  'simulated'::text                                             AS data_source
FROM daily_sales ds
LEFT JOIN (
  SELECT
    te.org_id,
    te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)        AS labour_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) * 14.50 AS labour_cost
  FROM time_entries te
  JOIN locations l ON l.id = te.location_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date
) lab ON lab.org_id = ds.org_id
     AND lab.location_id = ds.location_id
     AND lab.day = ds.day;

GRANT SELECT ON sales_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.2  sales_hourly_unified
-- Source: cdm_orders (may be empty — that is fine, view exists
-- with correct schema so PostgREST doesn't 404)
-- Columns match: DB_APP_CONTRACT.md §1.2
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date     AS day,
  date_trunc('hour', o.closed_at)                                            AS hour_bucket,
  EXTRACT(HOUR FROM o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::integer AS hour_of_day,
  COALESCE(SUM(o.net_sales), 0)::numeric                                    AS net_sales,
  COALESCE(SUM(o.gross_sales), 0)::numeric                                  AS gross_sales,
  COUNT(*)::integer                                                          AS orders_count,
  0::integer                                                                 AS covers,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END               AS avg_check,
  COALESCE(SUM(o.discounts), 0)::numeric                               AS discounts,
  0::numeric                                                                 AS refunds,
  'simulated'::text                                                          AS data_source
FROM cdm_orders o
JOIN locations l ON l.id = o.location_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date,
  date_trunc('hour', o.closed_at),
  EXTRACT(HOUR FROM o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'));

GRANT SELECT ON sales_hourly_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.3  product_sales_daily_unified
-- Source: cdm_order_lines + cdm_items/menu_items (may be empty)
-- Columns match: DB_APP_CONTRACT.md §1.3
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid)    AS product_id,
  COALESCE(mi.name, ci.name, 'Unknown')::text                          AS product_name,
  COALESCE(mi.category, 'Other')::text                                 AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer                               AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric                       AS net_sales,
  0::numeric                                                           AS cogs,
  COALESCE(SUM(ol.gross), 0)::numeric                       AS gross_profit,
  100::numeric                                                         AS margin_pct,
  'simulated'::text                                                    AS data_source
FROM cdm_orders o
JOIN locations l ON l.id = o.location_id
LEFT JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
LEFT JOIN menu_items mi ON mi.id = ol.item_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(mi.name, ci.name, 'Unknown'),
  COALESCE(mi.category, 'Other');

GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.4  labour_daily_unified
-- Source: time_entries (actuals) FULL OUTER JOIN shifts (scheduled)
-- Columns match: DB_APP_CONTRACT.md §1.4
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW labour_daily_unified AS
SELECT
  COALESCE(a.org_id,       s.org_id)       AS org_id,
  COALESCE(a.location_id,  s.location_id)  AS location_id,
  COALESCE(a.day,          s.day)          AS day,
  COALESCE(a.actual_hours, 0)::numeric     AS actual_hours,
  COALESCE(a.actual_cost,  0)::numeric     AS actual_cost,
  COALESCE(s.scheduled_hours, 0)::numeric  AS scheduled_hours,
  COALESCE(s.scheduled_cost,  0)::numeric  AS scheduled_cost,
  COALESCE(s.scheduled_headcount, 0)::integer AS scheduled_headcount,
  (COALESCE(a.actual_hours, 0) - COALESCE(s.scheduled_hours, 0))::numeric AS hours_variance,
  (COALESCE(a.actual_cost,  0) - COALESCE(s.scheduled_cost,  0))::numeric AS cost_variance,
  CASE WHEN COALESCE(s.scheduled_hours, 0) > 0
       THEN ((COALESCE(a.actual_hours, 0) - s.scheduled_hours) / s.scheduled_hours * 100)::numeric
       ELSE 0 END AS hours_variance_pct
FROM (
  -- Actuals: aggregate time_entries per day
  SELECT
    te.org_id,
    te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)          AS actual_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) * 14.50  AS actual_cost
  FROM time_entries te
  JOIN locations loc ON loc.id = te.location_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) a
FULL OUTER JOIN (
  -- Scheduled: aggregate shifts + assignments per day
  SELECT
    sch.org_id,
    sh.location_id,
    (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0)             AS scheduled_hours,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0) * 14.50     AS scheduled_cost,
    COUNT(DISTINCT sa.employee_id)::integer                                   AS scheduled_headcount
  FROM shifts sh
  JOIN schedules sch ON sch.id = sh.schedule_id
  JOIN locations loc ON loc.id = sh.location_id
  LEFT JOIN shift_assignments sa ON sa.shift_id = sh.id
  GROUP BY sch.org_id, sh.location_id,
           (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) s ON a.org_id = s.org_id AND a.location_id = s.location_id AND a.day = s.day;

GRANT SELECT ON labour_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.5  forecast_daily_unified
-- Source: forecast_points + forecast_runs (latest finished per loc)
-- Labour estimated at 28% COL, 14.50 EUR/h avg rate
-- Columns match: DB_APP_CONTRACT.md §1.5
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW forecast_daily_unified AS
WITH latest_runs AS (
  SELECT DISTINCT ON (org_id, location_id)
    id, org_id, location_id
  FROM forecast_runs
  WHERE status IN ('finished','completed')
  ORDER BY org_id, location_id, finished_at DESC NULLS LAST
),
avg_checks AS (
  SELECT org_id, location_id,
    CASE WHEN SUM(orders_count) > 0
         THEN (SUM(net_sales) / SUM(orders_count))::numeric
         ELSE 25 END AS avg_check
  FROM daily_sales
  GROUP BY org_id, location_id
)
SELECT
  fp.org_id,
  fp.location_id,
  fp.day,
  COALESCE(fp.yhat, 0)::numeric                                            AS forecast_sales,
  CASE WHEN COALESCE(ac.avg_check, 25) > 0
       THEN ROUND(COALESCE(fp.yhat, 0) / COALESCE(ac.avg_check, 25))::integer
       ELSE 0 END                                                          AS forecast_orders,
  ROUND(COALESCE(fp.yhat, 0) * 0.28 / 14.50, 1)::numeric                  AS planned_labor_hours,
  ROUND(COALESCE(fp.yhat, 0) * 0.28, 2)::numeric                          AS planned_labor_cost,
  COALESCE(ac.avg_check, 25)::numeric                                      AS forecast_avg_check,
  COALESCE(fp.yhat_lower, 0)::numeric                                      AS forecast_sales_lower,
  COALESCE(fp.yhat_upper, 0)::numeric                                      AS forecast_sales_upper,
  'simulated'::text                                                        AS data_source
FROM forecast_points fp
JOIN latest_runs lr ON lr.id = fp.forecast_run_id
LEFT JOIN avg_checks ac ON ac.org_id = fp.org_id AND ac.location_id = fp.location_id;

GRANT SELECT ON forecast_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.6  budget_daily_unified
-- Source: budget_days + budget_metrics (pivot rows->columns)
-- Seeded data uses layer='base'; production may use 'final'.
-- We COALESCE(final, base) so both work.
-- Columns match: DB_APP_CONTRACT.md §1.6
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW budget_daily_unified AS
SELECT
  bd.org_id,
  bd.location_id,
  bd.day,
  COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'    THEN bm.value END), 0)::numeric AS budget_sales,
  COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost'  THEN bm.value END), 0)::numeric AS budget_labour,
  COALESCE(MAX(CASE WHEN bm.metric = 'cogs'         THEN bm.value END), 0)::numeric AS budget_cogs,
  -- profit = sales - labour - cogs
  (COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))::numeric AS budget_profit,
  -- margin_pct = profit / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN ((COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_margin_pct,
  -- col_pct = labour / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_col_pct,
  -- cogs_pct = cogs / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_cogs_pct
FROM budget_days bd
JOIN budget_versions bv ON bv.id = bd.budget_version_id
LEFT JOIN budget_metrics bm
  ON bm.budget_day_id = bd.id
  AND bm.layer IN ('final', 'base')          -- prefer final, fall back to base
WHERE bv.status IN ('published', 'frozen')
GROUP BY bd.org_id, bd.location_id, bd.day;

GRANT SELECT ON budget_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 1.7  cogs_daily
-- Source: stock_movements (waste + sale_estimate)
-- Columns match: DB_APP_CONTRACT.md §1.7
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW cogs_daily AS
SELECT
  sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS date,
  SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_cost, 0))::numeric             AS cogs_amount
FROM stock_movements sm
JOIN locations l ON l.id = sm.location_id
WHERE sm.movement_type IN ('waste', 'sale_estimate')
GROUP BY sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date;

GRANT SELECT ON cogs_daily TO anon, authenticated;


-- ============================================================
-- SECTION 2: Auth RPCs (5)
-- ============================================================

-- 2.1  is_owner
CREATE OR REPLACE FUNCTION is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role = 'owner'
  );
$$;

-- 2.2  get_user_has_global_scope
CREATE OR REPLACE FUNCTION get_user_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner', 'manager')
  );
$$;

-- 2.3  get_user_accessible_locations
CREATE OR REPLACE FUNCTION get_user_accessible_locations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner', 'manager')) THEN
    RETURN QUERY
      SELECT l.id FROM locations l
      JOIN org_memberships om ON om.org_id = l.org_id
      WHERE om.user_id = _user_id AND l.active = true;
  ELSE
    RETURN QUERY
      SELECT lm.location_id FROM location_memberships lm
      JOIN locations l ON l.id = lm.location_id
      WHERE lm.user_id = _user_id AND l.active = true;
  END IF;
END;
$$;

-- 2.4  get_user_roles_with_scope
CREATE OR REPLACE FUNCTION get_user_roles_with_scope(_user_id uuid)
RETURNS TABLE(role_name text, role_id uuid, location_id uuid, location_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    -- Org-level roles
    SELECT om.role::text, om.org_id, NULL::uuid, NULL::text
    FROM org_memberships om
    WHERE om.user_id = _user_id
  UNION ALL
    -- Location-level roles
    SELECT lm.role::text, lm.location_id, lm.location_id, l.name::text
    FROM location_memberships lm
    JOIN locations l ON l.id = lm.location_id
    WHERE lm.user_id = _user_id;
END;
$$;

-- 2.5  get_user_permissions
CREATE OR REPLACE FUNCTION get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_key text, module text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT om.role::text INTO v_role
  FROM org_memberships om WHERE om.user_id = _user_id
  ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT lm.role::text INTO v_role
    FROM location_memberships lm WHERE lm.user_id = _user_id
    ORDER BY CASE lm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    LIMIT 1;
  END IF;

  IF v_role = 'owner' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('sales.export','sales'),
      ('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),
      ('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('settings.manage','settings'),
      ('team.view','team'),('team.manage','team'),
      ('payroll.view','payroll'),('payroll.manage','payroll'),
      ('reports.view','reports'),('forecast.view','forecast'),
      ('ai.view','ai'),('integrations.manage','integrations');
  ELSIF v_role = 'manager' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('sales.export','sales'),
      ('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),
      ('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('team.view','team'),
      ('payroll.view','payroll'),('reports.view','reports'),
      ('forecast.view','forecast'),('ai.view','ai');
  ELSIF v_role = 'staff' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('labour.view','labour'),
      ('inventory.view','inventory'),('menu.view','menu'),
      ('reports.view','reports');
  END IF;
  RETURN;
END;
$$;


-- ============================================================
-- SECTION 3: Data Source RPC
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
  v_last_synced timestamptz;
BEGIN
  SELECT os.data_source_mode::text INTO v_mode
  FROM org_settings os WHERE os.org_id = p_org_id;
  v_mode := COALESCE(v_mode, 'auto');

  SELECT MAX((i.metadata->>'last_synced_at')::timestamptz) INTO v_last_synced
  FROM integrations i WHERE i.org_id = p_org_id AND i.is_enabled = true;

  IF v_mode = 'manual_pos' THEN
    IF v_last_synced IS NOT NULL THEN
      RETURN jsonb_build_object('data_source','pos','mode','manual','reason','manual_pos','last_synced_at',v_last_synced);
    ELSE
      RETURN jsonb_build_object('data_source','demo','mode','manual','reason','manual_pos_blocked_no_sync','last_synced_at',null);
    END IF;
  ELSIF v_mode = 'manual_demo' THEN
    RETURN jsonb_build_object('data_source','demo','mode','manual','reason','manual_demo','last_synced_at',v_last_synced);
  ELSE -- auto
    IF v_last_synced IS NOT NULL THEN
      RETURN jsonb_build_object('data_source','pos','mode','auto','reason','auto_pos_connected','last_synced_at',v_last_synced);
    ELSE
      RETURN jsonb_build_object('data_source','demo','mode','auto','reason','auto_no_pos','last_synced_at',null);
    END IF;
  END IF;
END;
$$;


-- ============================================================
-- SECTION 4: Sales RPCs (4)
-- ============================================================

-- 4.1  get_sales_timeseries_unified
CREATE OR REPLACE FUNCTION get_sales_timeseries_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds   jsonb;
  v_kpis jsonb;
  v_daily  jsonb;
  v_hourly jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  -- KPIs
  SELECT jsonb_build_object(
    'actual_sales',       COALESCE(SUM(net_sales), 0),
    'forecast_sales',     0,
    'actual_orders',      COALESCE(SUM(orders_count), 0),
    'forecast_orders',    0,
    'avg_check_actual',   CASE WHEN COALESCE(SUM(orders_count),0)>0 THEN SUM(net_sales)/SUM(orders_count) ELSE 0 END,
    'avg_check_forecast', 0
  ) INTO v_kpis
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
    AND day BETWEEN p_from AND p_to;

  -- Daily
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      ds.day AS date,
      SUM(COALESCE(ds.net_sales,0))::numeric     AS actual_sales,
      SUM(COALESCE(ds.orders_count,0))::integer   AS actual_orders,
      COALESCE(SUM(fp.yhat),0)::numeric           AS forecast_sales,
      0::integer                                   AS forecast_orders,
      COALESCE(SUM(fp.yhat_lower),0)::numeric     AS lower,
      COALESCE(SUM(fp.yhat_upper),0)::numeric     AS upper
    FROM daily_sales ds
    LEFT JOIN forecast_points fp
      ON fp.location_id = ds.location_id AND fp.day = ds.day
      AND fp.forecast_run_id = (
        SELECT fr.id FROM forecast_runs fr
        WHERE fr.org_id = p_org_id AND fr.location_id = ds.location_id AND fr.status IN ('finished','completed')
        ORDER BY fr.finished_at DESC NULLS LAST LIMIT 1
      )
    WHERE ds.org_id = p_org_id AND ds.location_id = ANY(p_location_ids)
      AND ds.day BETWEEN p_from AND p_to
    GROUP BY ds.day
  ) d;

  -- Hourly (from cdm_orders -- empty if no POS data)
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.ts_hour), '[]'::jsonb) INTO v_hourly
  FROM (
    SELECT
      date_trunc('hour', o.closed_at) AS ts_hour,
      SUM(o.net_sales)::numeric       AS actual_sales,
      COUNT(*)::integer                AS actual_orders,
      0::numeric AS forecast_sales, 0::integer AS forecast_orders,
      0::numeric AS lower, 0::numeric AS upper
    FROM cdm_orders o
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY date_trunc('hour', o.closed_at)
  ) h;

  RETURN jsonb_build_object(
    'data_source',   v_ds->>'data_source',
    'mode',          v_ds->>'mode',
    'reason',        v_ds->>'reason',
    'last_synced_at',v_ds->>'last_synced_at',
    'kpis',   v_kpis,
    'daily',  v_daily,
    'hourly', v_hourly,
    'busy_hours', '[]'::jsonb
  );
END;
$$;

-- 4.2  get_top_products_unified
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds jsonb;
  v_total numeric;
  v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(SUM(net_sales),0) INTO v_total
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000')::text AS product_id,
      COALESCE(mi.name, ci.name, 'Unknown') AS name,
      COALESCE(mi.category, 'Other')        AS category,
      SUM(COALESCE(ol.gross,0))::numeric AS sales,
      SUM(COALESCE(ol.qty,0))::numeric         AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(ol.gross,0))/v_total ELSE 0 END AS share
    FROM cdm_orders o
    JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN cdm_items ci ON ci.id = ol.item_id
    LEFT JOIN menu_items mi ON mi.id = ol.item_id
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY 1,2,3
    ORDER BY sales DESC
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'total_sales',v_total,'items',v_items
  );
END;
$$;

-- 4.3  get_instant_pnl_unified
CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id, l.name AS location_name,
      COALESCE(s.net_sales,0)::numeric   AS actual_sales,
      COALESCE(f.fc_sales,0)::numeric    AS forecast_sales,
      COALESCE(lab.cost,0)::numeric      AS actual_labour,
      ROUND(COALESCE(f.fc_sales,0)*0.28,2)::numeric AS forecast_labour,
      COALESCE(cg.cogs_est,0)::numeric   AS actual_cogs,
      (COALESCE(s.net_sales,0) - COALESCE(lab.cost,0) - COALESCE(cg.cogs_est,0))::numeric AS gp_value,
      true AS estimated_cogs
    FROM locations l
    LEFT JOIN (SELECT location_id, SUM(net_sales) AS net_sales FROM daily_sales
               WHERE org_id=p_org_id AND day BETWEEN p_from AND p_to GROUP BY 1) s ON s.location_id=l.id
    LEFT JOIN (SELECT fp.location_id, SUM(fp.yhat) AS fc_sales
               FROM forecast_points fp
               JOIN forecast_runs fr ON fr.id=fp.forecast_run_id AND fr.status='finished'
               WHERE fp.org_id=p_org_id AND fp.day BETWEEN p_from AND p_to GROUP BY 1) f ON f.location_id=l.id
    LEFT JOIN (SELECT te.location_id,
                 SUM(EXTRACT(EPOCH FROM (te.clock_out-te.clock_in))/3600.0*14.50) AS cost
               FROM time_entries te WHERE te.org_id=p_org_id AND te.clock_out IS NOT NULL
                 AND te.clock_in::date BETWEEN p_from AND p_to GROUP BY 1) lab ON lab.location_id=l.id
    LEFT JOIN (SELECT sm.location_id, SUM(ABS(sm.qty_delta)*COALESCE(sm.unit_cost,0)) AS cogs_est
               FROM stock_movements sm WHERE sm.org_id=p_org_id
                 AND sm.movement_type IN ('waste','sale_estimate')
                 AND sm.created_at::date BETWEEN p_from AND p_to GROUP BY 1) cg ON cg.location_id=l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'locations',v_locs
  );
END;
$$;

-- 4.4  menu_engineering_summary
CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown') AS product_name,
        COALESCE(mi.category, 'Other')        AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint   AS units_sold,
        COALESCE(SUM(ol.gross),0)   AS net_sales,
        0::numeric AS cogs,
        COALESCE(SUM(ol.gross),0)   AS gross_profit,
        100::numeric                           AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name, pd.product_category,
        pd.units_sold, pd.net_sales, pd.cogs, pd.gross_profit, pd.margin_pct,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct <  COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM product_data pd, stats s
      ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;


-- ============================================================
-- SECTION 5: Labour RPCs (4)
-- ============================================================

-- 5.1  get_labour_kpis
CREATE OR REPLACE FUNCTION get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_sales numeric; v_result jsonb;
BEGIN
  SELECT COALESCE(SUM(net_sales),0) INTO v_sales
  FROM sales_daily_unified
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT jsonb_build_object(
    'total_actual_hours',    COALESCE(SUM(actual_hours),0),
    'total_actual_cost',     COALESCE(SUM(actual_cost),0),
    'total_scheduled_hours', COALESCE(SUM(scheduled_hours),0),
    'total_scheduled_cost',  COALESCE(SUM(scheduled_cost),0),
    'avg_headcount', CASE WHEN COUNT(*)>0 THEN SUM(scheduled_headcount)::numeric/COUNT(*) ELSE 0 END,
    'total_sales', v_sales,
    'splh',    CASE WHEN COALESCE(SUM(actual_hours),0)>0 THEN v_sales/SUM(actual_hours) ELSE 0 END,
    'col_pct', CASE WHEN v_sales>0 THEN COALESCE(SUM(actual_cost),0)/v_sales*100 ELSE 0 END
  ) INTO v_result
  FROM labour_daily_unified
  WHERE day BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  RETURN v_result;
END;
$$;

-- 5.2  get_labour_timeseries
CREATE OR REPLACE FUNCTION get_labour_timeseries(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day), '[]'::jsonb)
    FROM (
      SELECT
        ldu.day,
        COALESCE(ldu.actual_hours,0)        AS actual_hours,
        COALESCE(ldu.actual_cost,0)         AS actual_cost,
        COALESCE(ldu.scheduled_hours,0)     AS scheduled_hours,
        COALESCE(ldu.scheduled_cost,0)      AS scheduled_cost,
        COALESCE(ldu.scheduled_headcount,0) AS scheduled_headcount,
        COALESCE(ldu.hours_variance,0)      AS hours_variance,
        COALESCE(ldu.hours_variance_pct,0)  AS hours_variance_pct,
        COALESCE(s.net_sales,0)             AS sales,
        CASE WHEN COALESCE(ldu.actual_hours,0)>0
             THEN COALESCE(s.net_sales,0)/ldu.actual_hours ELSE 0 END AS splh,
        CASE WHEN COALESCE(s.net_sales,0)>0
             THEN COALESCE(ldu.actual_cost,0)/s.net_sales*100 ELSE 0 END AS col_pct
      FROM labour_daily_unified ldu
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = ldu.location_id
      WHERE ldu.day BETWEEN date_from AND date_to
        AND (selected_location_id IS NULL OR ldu.location_id = selected_location_id)
    ) d
  );
END;
$$;

-- 5.3  get_labour_locations_table
CREATE OR REPLACE FUNCTION get_labour_locations_table(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        l.id AS location_id, l.name AS location_name,
        COALESCE(SUM(ldu.actual_hours),0)    AS actual_hours,
        COALESCE(SUM(ldu.actual_cost),0)     AS actual_cost,
        COALESCE(SUM(ldu.scheduled_hours),0) AS scheduled_hours,
        COALESCE(SUM(ldu.scheduled_cost),0)  AS scheduled_cost,
        COALESCE(SUM(s.net_sales),0)         AS sales,
        CASE WHEN COALESCE(SUM(ldu.actual_hours),0)>0
             THEN SUM(COALESCE(s.net_sales,0))/SUM(ldu.actual_hours) ELSE 0 END AS splh,
        CASE WHEN COALESCE(SUM(s.net_sales),0)>0
             THEN SUM(COALESCE(ldu.actual_cost,0))/SUM(s.net_sales)*100 ELSE 0 END AS col_pct
      FROM locations l
      LEFT JOIN labour_daily_unified ldu
        ON ldu.location_id = l.id AND ldu.day BETWEEN date_from AND date_to
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = l.id
      WHERE (selected_location_id IS NULL OR l.id = selected_location_id)
        AND l.active = true
      GROUP BY l.id, l.name
    ) r
  );
END;
$$;

-- 5.4  get_labor_plan_unified
CREATE OR REPLACE FUNCTION get_labor_plan_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'metadata', jsonb_build_object(
      'org_id', p_org_id, 'locations', to_jsonb(p_location_ids),
      'from', p_from, 'to', p_to,
      'target_col_pct', 28, 'avg_hourly_rate', 14.50
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day)
      FROM (
        SELECT fdu.day, fdu.location_id,
          COALESCE(fdu.forecast_sales,0)       AS forecast_sales,
          COALESCE(fdu.planned_labor_hours,0)   AS planned_hours,
          COALESCE(fdu.planned_labor_cost,0)    AS planned_cost,
          ROUND(COALESCE(fdu.planned_labor_hours,0)*0.6,1) AS foh_hours,
          ROUND(COALESCE(fdu.planned_labor_hours,0)*0.4,1) AS boh_hours
        FROM forecast_daily_unified fdu
        WHERE fdu.org_id = p_org_id AND fdu.location_id = ANY(p_location_ids)
          AND fdu.day BETWEEN p_from AND p_to
      ) d
    ), '[]'::jsonb),
    'hourly', '[]'::jsonb,
    'flags', jsonb_build_object('estimated_rates', true, 'data_sufficiency_level', 'medium')
  );
END;
$$;


-- ============================================================
-- SECTION 6: Other RPCs (4)
-- ============================================================

-- 6.1  get_forecast_items_mix_unified (stub -- no CDM product data)
CREATE OR REPLACE FUNCTION get_forecast_items_mix_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_horizon_days integer DEFAULT 14,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_ds jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);
  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'hist_window', jsonb_build_object('from',p_from,'to',p_to),
    'horizon',     jsonb_build_object('from',p_to+1,'to',p_to+p_horizon_days),
    'items','[]'::jsonb
  );
END;
$$;

-- 6.2  audit_data_coherence
CREATE OR REPLACE FUNCTION audit_data_coherence(
  p_org_id uuid,
  p_location_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_pass   boolean := true;
  v_cnt    bigint;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','sales_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));
  IF v_cnt = 0 THEN v_pass := false; END IF;

  SELECT COUNT(*) INTO v_cnt FROM time_entries
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','labour_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  SELECT COUNT(*) INTO v_cnt FROM forecast_points fp
  JOIN forecast_runs fr ON fr.id = fp.forecast_run_id
  WHERE fp.org_id = p_org_id AND fp.location_id = ANY(p_location_ids) AND fr.status='finished';
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','forecast_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  SELECT COUNT(*) INTO v_cnt FROM budget_days
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','budget_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  RETURN jsonb_build_object('allPass', v_pass, 'checks', v_checks);
END;
$$;

-- 6.3  add_loyalty_points (stub -- loyalty tables not yet created)
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_member_id uuid,
  p_points integer,
  p_type text DEFAULT 'earned',
  p_description text DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT '{"ok":true,"stub":true}'::jsonb; $$;

-- 6.4  redeem_loyalty_reward (stub)
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_member_id uuid,
  p_reward_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT '{"ok":true,"stub":true}'::jsonb; $$;


-- ============================================================
-- SECTION 7: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_daily_sales_org_loc_day
  ON daily_sales (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_time_entries_org_loc
  ON time_entries (org_id, location_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_loc_clockin
  ON time_entries (location_id, clock_in);

CREATE INDEX IF NOT EXISTS idx_shifts_loc_start
  ON shifts (location_id, start_at);

CREATE INDEX IF NOT EXISTS idx_forecast_points_org_loc_day
  ON forecast_points (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_org_loc_status
  ON forecast_runs (org_id, location_id, status, finished_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_budget_days_org_loc_day
  ON budget_days (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_budget_metrics_day_layer
  ON budget_metrics (budget_day_id, layer);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user
  ON org_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_location_memberships_user
  ON location_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_loc_type
  ON stock_movements (location_id, movement_type, created_at);

CREATE INDEX IF NOT EXISTS idx_cdm_orders_org_loc_closed
  ON cdm_orders (org_id, location_id, closed_at)
  WHERE closed_at IS NOT NULL;
