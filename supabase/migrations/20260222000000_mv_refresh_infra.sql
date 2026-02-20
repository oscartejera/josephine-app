-- ============================================================
-- MV Refresh Infrastructure
-- ops schema, mv_owner role, materialized views, refresh function
-- ============================================================

-- ============================================================
-- SECTION 1: ops schema + mv_owner role + refresh log table
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ops;

-- Dedicated role that owns all MVs (required for REFRESH)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mv_owner') THEN
    CREATE ROLE mv_owner NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO mv_owner;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mv_owner;

CREATE TABLE ops.mv_refresh_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  views_refreshed text[],
  triggered_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  error_message text,
  metadata jsonb
);

GRANT USAGE ON SCHEMA ops TO mv_owner, service_role, authenticated;
GRANT SELECT ON ops.mv_refresh_log TO authenticated;
GRANT ALL ON ops.mv_refresh_log TO service_role, mv_owner;

-- ============================================================
-- SECTION 2: Materialized Views + Wrapper Views
--
-- Strategy:
--   1. Drop dependent views first (respecting dependency order)
--   2. Create <name>_mv as MATERIALIZED VIEW with unique index
--   3. Re-create <name> as thin VIEW → SELECT * FROM <name>_mv
--
-- Drop order (dependencies):
--   mart_sales_category_daily depends on product_sales_daily_unified
--   mart_kpi_daily depends on sales_daily_unified, labour_daily_unified, cogs_daily
--   (sales_daily_unified, labour_daily_unified, cogs_daily stay as regular views)
-- ============================================================

-- 2a. Drop dependent views in correct order
DROP VIEW IF EXISTS mart_sales_category_daily CASCADE;
DROP VIEW IF EXISTS mart_kpi_daily CASCADE;
DROP VIEW IF EXISTS product_sales_daily_unified CASCADE;
DROP VIEW IF EXISTS sales_hourly_unified CASCADE;

-- 2b. product_sales_daily_unified_mv
CREATE MATERIALIZED VIEW product_sales_daily_unified_mv AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid)    AS product_id,
  COALESCE(mi.name, ci.name, 'Unknown')::text                          AS product_name,
  COALESCE(mi.category, 'Other')::text                                 AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer                                    AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric                                  AS net_sales,
  0::numeric                                                           AS cogs,
  COALESCE(SUM(ol.gross), 0)::numeric                                  AS gross_profit,
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

CREATE UNIQUE INDEX idx_product_sales_daily_unified_mv_pk
  ON product_sales_daily_unified_mv (org_id, location_id, day, product_id);

ALTER MATERIALIZED VIEW product_sales_daily_unified_mv OWNER TO mv_owner;
GRANT SELECT ON product_sales_daily_unified_mv TO anon, authenticated;

-- Wrapper view preserves existing query contract
CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT * FROM product_sales_daily_unified_mv;
GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;

-- 2c. sales_hourly_unified_mv
CREATE MATERIALIZED VIEW sales_hourly_unified_mv AS
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
  COALESCE(SUM(o.discounts), 0)::numeric                                    AS discounts,
  0::numeric                                                                 AS refunds,
  'simulated'::text                                                          AS data_source
FROM cdm_orders o
JOIN locations l ON l.id = o.location_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date,
  date_trunc('hour', o.closed_at),
  EXTRACT(HOUR FROM o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'));

CREATE UNIQUE INDEX idx_sales_hourly_unified_mv_pk
  ON sales_hourly_unified_mv (org_id, location_id, hour_bucket);

ALTER MATERIALIZED VIEW sales_hourly_unified_mv OWNER TO mv_owner;
GRANT SELECT ON sales_hourly_unified_mv TO anon, authenticated;

CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT * FROM sales_hourly_unified_mv;
GRANT SELECT ON sales_hourly_unified TO anon, authenticated;

-- 2d. mart_kpi_daily_mv
CREATE MATERIALIZED VIEW mart_kpi_daily_mv AS
SELECT
  s.org_id,
  s.location_id,
  s.date,
  s.net_sales,
  s.orders_count,
  0::integer AS covers,
  CASE WHEN s.orders_count > 0
       THEN s.net_sales / s.orders_count
       ELSE 0 END AS avg_check,
  l.actual_cost AS labour_cost,
  l.actual_hours AS labour_hours,
  CASE WHEN s.net_sales > 0 AND l.actual_cost IS NOT NULL
       THEN (l.actual_cost / s.net_sales) * 100
       ELSE NULL END AS col_percent,
  COALESCE(
    NULLIF(c.cogs_amount, 0),
    s.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
  ) AS cogs,
  CASE
    WHEN NULLIF(c.cogs_amount, 0) IS NOT NULL THEN 'actual'
    ELSE 'estimated'
  END AS cogs_source,
  CASE WHEN s.net_sales > 0 THEN
    ((s.net_sales - COALESCE(
      NULLIF(c.cogs_amount, 0),
      s.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
    )) / s.net_sales) * 100
  ELSE NULL END AS gp_percent,
  CASE WHEN l.actual_cost IS NOT NULL AND l.actual_cost > 0
       THEN 'actual' ELSE 'estimated' END AS labour_source
FROM sales_daily_unified s
LEFT JOIN labour_daily_unified l
  ON l.location_id = s.location_id AND l.day = s.date
LEFT JOIN cogs_daily c
  ON c.location_id = s.location_id AND c.date = s.date
LEFT JOIN location_settings ls
  ON ls.location_id = s.location_id;

CREATE UNIQUE INDEX idx_mart_kpi_daily_mv_pk
  ON mart_kpi_daily_mv (org_id, location_id, date);

ALTER MATERIALIZED VIEW mart_kpi_daily_mv OWNER TO mv_owner;
GRANT SELECT ON mart_kpi_daily_mv TO anon, authenticated;

CREATE OR REPLACE VIEW mart_kpi_daily AS
SELECT * FROM mart_kpi_daily_mv;
GRANT SELECT ON mart_kpi_daily TO anon, authenticated;

-- 2e. mart_sales_category_daily_mv
CREATE MATERIALIZED VIEW mart_sales_category_daily_mv AS
SELECT
  p.org_id,
  p.location_id,
  p.day AS date,
  p.product_id,
  p.product_name,
  p.product_category AS category,
  p.units_sold,
  p.net_sales,
  COALESCE(
    (SELECT SUM(ri.quantity * ii.last_cost)
     FROM recipes r
     JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     JOIN inventory_items ii ON ii.id = ri.inventory_item_id
     WHERE r.menu_item_name = p.product_name
       AND r.group_id = p.org_id
    ) * p.units_sold,
    p.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
  ) AS cogs,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.menu_item_name = p.product_name AND r.group_id = p.org_id
    ) THEN 'recipe'
    ELSE 'estimated'
  END AS cogs_source
FROM product_sales_daily_unified p
LEFT JOIN location_settings ls ON ls.location_id = p.location_id;

CREATE UNIQUE INDEX idx_mart_sales_category_daily_mv_pk
  ON mart_sales_category_daily_mv (org_id, location_id, date, product_id);

ALTER MATERIALIZED VIEW mart_sales_category_daily_mv OWNER TO mv_owner;
GRANT SELECT ON mart_sales_category_daily_mv TO anon, authenticated;

CREATE OR REPLACE VIEW mart_sales_category_daily AS
SELECT * FROM mart_sales_category_daily_mv;
GRANT SELECT ON mart_sales_category_daily TO anon, authenticated;

-- ============================================================
-- SECTION 3: Refresh function (SECURITY DEFINER, owned by mv_owner)
-- ============================================================

CREATE OR REPLACE FUNCTION ops.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
DECLARE
  t_start timestamptz;
  log_id bigint;
  results jsonb := '[]'::jsonb;
  mv_name text;
  mv_start timestamptz;
  mv_ms integer;
  mv_list text[] := ARRAY[
    'product_sales_daily_unified_mv',
    'sales_hourly_unified_mv',
    'mart_kpi_daily_mv',
    'mart_sales_category_daily_mv'
  ];
BEGIN
  t_start := clock_timestamp();

  INSERT INTO ops.mv_refresh_log (triggered_by, status)
  VALUES (p_triggered_by, 'running')
  RETURNING id INTO log_id;

  FOREACH mv_name IN ARRAY mv_list LOOP
    mv_start := clock_timestamp();
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
    mv_ms := extract(milliseconds from clock_timestamp() - mv_start)::integer;
    results := results || jsonb_build_object('view', mv_name, 'ms', mv_ms);
  END LOOP;

  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    duration_ms = extract(milliseconds from clock_timestamp() - t_start)::integer,
    views_refreshed = mv_list,
    status = 'success',
    metadata = jsonb_build_object('details', results)
  WHERE id = log_id;

  RETURN jsonb_build_object(
    'log_id', log_id,
    'duration_ms', extract(milliseconds from clock_timestamp() - t_start)::integer,
    'views', results
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    status = 'error',
    error_message = SQLERRM
  WHERE id = log_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Own the function by mv_owner so SECURITY DEFINER runs as mv_owner
ALTER FUNCTION ops.refresh_all_mvs(text) OWNER TO mv_owner;
-- Allow service_role to call it (via Edge Function)
GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role;
