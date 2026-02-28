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


-- ============================================================
-- A) MATERIALIZED VIEW: sales_hourly_unified_mv_v2
--    POS-only hourly aggregation from cdm_orders
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.sales_hourly_unified_mv_v2 AS
SELECT
  o.org_id,
  o.location_id,
  (date_trunc('day', o.closed_at))::date                                   AS day,
  date_trunc('hour', o.closed_at)                                          AS hour_bucket,
  EXTRACT(HOUR FROM o.closed_at)::integer                                  AS hour_of_day,
  COALESCE(SUM(o.net_sales), 0)::numeric                                  AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric         AS gross_sales,
  COUNT(*)::integer                                                        AS orders_count,
  0::integer                                                               AS covers,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric
       ELSE 0 END                                                          AS avg_check,
  COALESCE(SUM(o.discounts), 0)::numeric                                  AS discounts,
  0::numeric                                                               AS refunds,
  'pos'::text                                                              AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id,
  (date_trunc('day', o.closed_at))::date,
  date_trunc('hour', o.closed_at),
  EXTRACT(HOUR FROM o.closed_at)::integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_hourly_unified_mv_v2_pk
  ON sales_hourly_unified_mv_v2 (org_id, location_id, day, hour_bucket, data_source);

GRANT SELECT ON sales_hourly_unified_mv_v2 TO anon, authenticated;


-- ============================================================
-- B) MATERIALIZED VIEW: product_sales_daily_unified_mv_v2
--    POS-only product-level daily aggregation
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.product_sales_daily_unified_mv_v2 AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at)::date                                                      AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid)      AS product_id,
  COALESCE(ci.name, 'Unknown')::text                                       AS product_name,
  COALESCE(ci.category, 'Other')::text                                     AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer                                        AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric                                      AS net_sales,
  ROUND(
    COALESCE(SUM(ol.gross), 0) *
    COALESCE(ls.default_cogs_percent, 30) / 100.0, 2
  )::numeric                                                               AS cogs,
  ROUND(
    COALESCE(SUM(ol.gross), 0) *
    (1 - COALESCE(ls.default_cogs_percent, 30) / 100.0), 2
  )::numeric                                                               AS gross_profit,
  CASE WHEN COALESCE(SUM(ol.gross), 0) > 0
    THEN ROUND(
      (1 - COALESCE(ls.default_cogs_percent, 30) / 100.0) * 100, 1
    )::numeric
    ELSE 0 END                                                             AS margin_pct,
  'pos'::text                                                              AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
LEFT JOIN location_settings ls ON ls.location_id = o.location_id
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id,
  (o.closed_at)::date,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(ci.name, 'Unknown'),
  COALESCE(ci.category, 'Other'),
  COALESCE(ls.default_cogs_percent, 30);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_daily_unified_mv_v2_pk
  ON product_sales_daily_unified_mv_v2 (org_id, location_id, day, product_id, data_source);

GRANT SELECT ON product_sales_daily_unified_mv_v2 TO anon, authenticated;


-- ============================================================
-- D) Replace wrapper views with source-safe lateral join
-- ============================================================

-- D1. sales_hourly_unified
--     Selects from the v2 MV, filtered by resolve_data_source per org.
--     Falls back to demo MV rows if resolve chooses 'demo'.
CREATE OR REPLACE VIEW public.sales_hourly_unified AS
SELECT
  mv.org_id,
  mv.location_id,
  mv.day,
  mv.hour_bucket,
  mv.hour_of_day,
  mv.net_sales,
  mv.gross_sales,
  mv.orders_count,
  mv.covers,
  mv.avg_check,
  mv.discounts,
  mv.refunds,
  mv.data_source
FROM (
  -- Union: v2 POS rows + legacy demo rows
  SELECT org_id, location_id, day, hour_bucket, hour_of_day,
         net_sales, gross_sales, orders_count, covers, avg_check,
         discounts, refunds, data_source
  FROM sales_hourly_unified_mv_v2
  UNION ALL
  SELECT org_id, location_id, day, hour_bucket, hour_of_day,
         net_sales, gross_sales, orders_count, covers, avg_check,
         discounts, refunds, 'demo'::text AS data_source
  FROM sales_hourly_unified_mv
) mv
JOIN LATERAL resolve_data_source(mv.org_id) ds ON true
WHERE ds->>'data_source' = mv.data_source;

GRANT SELECT ON sales_hourly_unified TO anon, authenticated;

-- D2. product_sales_daily_unified
CREATE OR REPLACE VIEW public.product_sales_daily_unified AS
SELECT
  mv.org_id,
  mv.location_id,
  mv.day,
  mv.product_id,
  mv.product_name,
  mv.product_category,
  mv.units_sold,
  mv.net_sales,
  mv.cogs,
  mv.gross_profit,
  mv.margin_pct,
  mv.data_source,
  mv.day AS date
FROM (
  -- Union: v2 POS rows + legacy demo rows
  SELECT org_id, location_id, day, product_id, product_name,
         product_category, units_sold, net_sales, cogs,
         gross_profit, margin_pct, data_source
  FROM product_sales_daily_unified_mv_v2
  UNION ALL
  SELECT org_id, location_id, day, product_id, product_name,
         product_category, units_sold, net_sales, cogs,
         gross_profit, margin_pct, 'demo'::text AS data_source
  FROM product_sales_daily_unified_mv
) mv
JOIN LATERAL resolve_data_source(mv.org_id) ds ON true
WHERE ds->>'data_source' = mv.data_source;

GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;


-- ============================================================
-- F) Update ops.refresh_all_mvs to include v2 MVs
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
    'mart_sales_category_daily_mv',
    'sales_hourly_unified_mv_v2',
    'product_sales_daily_unified_mv_v2'
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

-- Public wrapper
CREATE OR REPLACE FUNCTION public.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
  SELECT ops.refresh_all_mvs(p_triggered_by);
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role, authenticated;

-- ============================================================
-- G) sales_daily_unified: dual-source (demo + pos) with
--    LATERAL resolve_data_source filter
-- ============================================================

CREATE OR REPLACE VIEW public.sales_daily_unified AS
SELECT
  r.org_id,
  r.location_id,
  r.date,
  r.gross_sales,
  r.net_sales,
  r.tax,
  r.tips,
  r.discounts,
  r.comps,
  r.voids,
  r.refunds,
  r.orders_count,
  r.payments_total,
  r.avg_check,
  r.payments_cash,
  r.payments_card,
  r.payments_other,
  r.refunds_amount,
  r.refunds_count,
  r.discounts_amount,
  r.comps_amount,
  r.voids_amount,
  r.labor_cost,
  r.labor_hours,
  r.data_source
FROM (
  -- ── A) Demo dataset: pos_daily_finance ──────────────────────
  SELECT
    l.group_id                                             AS org_id,
    f.location_id,
    f.date,
    COALESCE(f.gross_sales, 0)::numeric                    AS gross_sales,
    COALESCE(f.net_sales, 0)::numeric                      AS net_sales,
    0::numeric                                             AS tax,
    0::numeric                                             AS tips,
    COALESCE(f.discounts_amount, 0)::numeric               AS discounts,
    COALESCE(f.comps_amount, 0)::numeric                   AS comps,
    COALESCE(f.voids_amount, 0)::numeric                   AS voids,
    COALESCE(f.refunds_amount, 0)::numeric                 AS refunds,
    COALESCE(f.orders_count, 0)::integer                   AS orders_count,
    (COALESCE(f.payments_cash, 0)
     + COALESCE(f.payments_card, 0)
     + COALESCE(f.payments_other, 0))::numeric             AS payments_total,
    CASE WHEN COALESCE(f.orders_count, 0) > 0
         THEN (f.net_sales / f.orders_count)::numeric
         ELSE 0 END                                        AS avg_check,
    COALESCE(f.payments_cash, 0)::numeric                  AS payments_cash,
    COALESCE(f.payments_card, 0)::numeric                  AS payments_card,
    COALESCE(f.payments_other, 0)::numeric                 AS payments_other,
    COALESCE(f.refunds_amount, 0)::numeric                 AS refunds_amount,
    COALESCE(f.refunds_count, 0)::integer                  AS refunds_count,
    COALESCE(f.discounts_amount, 0)::numeric               AS discounts_amount,
    COALESCE(f.comps_amount, 0)::numeric                   AS comps_amount,
    COALESCE(f.voids_amount, 0)::numeric                   AS voids_amount,
    COALESCE(ld.labour_cost, 0)::numeric                   AS labor_cost,
    COALESCE(ld.labour_hours, 0)::numeric                  AS labor_hours,
    'demo'::text                                           AS data_source
  FROM pos_daily_finance f
  JOIN locations l ON l.id = f.location_id
  LEFT JOIN labour_daily ld
    ON ld.location_id = f.location_id AND ld.date = f.date
  WHERE f.data_source = 'demo'

  UNION ALL

  -- ── B) POS dataset: cdm_orders + cdm_payments ──────────────
  SELECT
    o_agg.org_id,
    o_agg.location_id,
    o_agg.date,
    o_agg.gross_sales,
    o_agg.net_sales,
    o_agg.tax,
    o_agg.tips,
    o_agg.discounts,
    o_agg.comps,
    o_agg.voids,
    o_agg.refunds,
    o_agg.orders_count,
    COALESCE(pay.payments_total, 0)::numeric               AS payments_total,
    CASE WHEN o_agg.orders_count > 0
         THEN (o_agg.net_sales / o_agg.orders_count)::numeric
         ELSE 0 END                                        AS avg_check,
    COALESCE(pay.payments_cash, 0)::numeric                AS payments_cash,
    COALESCE(pay.payments_card, 0)::numeric                AS payments_card,
    COALESCE(pay.payments_other, 0)::numeric               AS payments_other,
    COALESCE(pay.refunds_total, 0)::numeric                AS refunds_amount,
    COALESCE(pay.refunds_count, 0)::integer                AS refunds_count,
    o_agg.discounts                                        AS discounts_amount,
    o_agg.comps                                            AS comps_amount,
    o_agg.voids                                            AS voids_amount,
    COALESCE(ld.labour_cost, 0)::numeric                   AS labor_cost,
    COALESCE(ld.labour_hours, 0)::numeric                  AS labor_hours,
    'pos'::text                                            AS data_source
  FROM (
    -- Aggregate cdm_orders per day/location
    SELECT
      o.org_id,
      o.location_id,
      (o.closed_at)::date                                  AS date,
      COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales + COALESCE(o.tax, 0))), 0)::numeric AS gross_sales,
      COALESCE(SUM(o.net_sales), 0)::numeric               AS net_sales,
      COALESCE(SUM(o.tax), 0)::numeric                     AS tax,
      COALESCE(SUM(o.tips), 0)::numeric                    AS tips,
      COALESCE(SUM(o.discounts), 0)::numeric               AS discounts,
      COALESCE(SUM(o.comps), 0)::numeric                   AS comps,
      COALESCE(SUM(o.voids), 0)::numeric                   AS voids,
      COALESCE(SUM(o.refunds), 0)::numeric                 AS refunds,
      COUNT(*)::integer                                    AS orders_count
    FROM cdm_orders o
    WHERE o.closed_at IS NOT NULL
      AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
    GROUP BY o.org_id, o.location_id, (o.closed_at)::date
  ) o_agg
  LEFT JOIN (
    -- Pre-aggregate cdm_payments per day/location
    SELECT
      p.org_id,
      o2.location_id,
      (o2.closed_at)::date                                 AS date,
      SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END)::numeric AS payments_total,
      SUM(CASE WHEN p.amount > 0 AND lower(p.method) IN ('cash','efectivo')
               THEN p.amount ELSE 0 END)::numeric         AS payments_cash,
      SUM(CASE WHEN p.amount > 0 AND lower(p.method) IN ('card','visa','mastercard','amex','credit','debit','tarjeta')
               THEN p.amount ELSE 0 END)::numeric         AS payments_card,
      SUM(CASE WHEN p.amount > 0
               AND lower(p.method) NOT IN ('cash','efectivo','card','visa','mastercard','amex','credit','debit','tarjeta')
               THEN p.amount ELSE 0 END)::numeric         AS payments_other,
      SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END)::numeric AS refunds_total,
      COUNT(CASE WHEN p.amount < 0 THEN 1 END)::integer   AS refunds_count
    FROM cdm_payments p
    JOIN cdm_orders o2 ON o2.id = p.order_id
    WHERE o2.closed_at IS NOT NULL
      AND (o2.provider IS NOT NULL OR o2.integration_account_id IS NOT NULL)
    GROUP BY p.org_id, o2.location_id, (o2.closed_at)::date
  ) pay ON pay.org_id = o_agg.org_id
       AND pay.location_id = o_agg.location_id
       AND pay.date = o_agg.date
  LEFT JOIN labour_daily ld
    ON ld.location_id = o_agg.location_id AND ld.date = o_agg.date
) r
-- ── C) Filter by resolved data source ────────────────────────
JOIN LATERAL resolve_data_source(r.org_id) ds ON true
WHERE ds->>'data_source' = r.data_source;

GRANT SELECT ON sales_daily_unified TO anon, authenticated;


-- ============================================================
-- H) forecast_daily_unified: dual-source (demo + pos heuristic)
--    with LATERAL resolve_data_source filter
-- ============================================================

CREATE OR REPLACE VIEW public.forecast_daily_unified AS
SELECT
  r.org_id,
  r.location_id,
  r.day,
  r.forecast_sales,
  r.forecast_orders,
  r.planned_labor_hours,
  r.planned_labor_cost,
  r.forecast_avg_check,
  r.forecast_sales_lower,
  r.forecast_sales_upper,
  r.data_source
FROM (
  -- ── DEMO: forecast_runs + forecast_points ───────────────────
  SELECT
    fp.org_id,
    fp.location_id,
    fp.day,
    COALESCE(fp.yhat, 0)::numeric                          AS forecast_sales,
    ROUND(COALESCE(fp.yhat, 0) / NULLIF(25, 0))::integer  AS forecast_orders,
    ROUND(COALESCE(fp.yhat, 0) * 0.28 / 14.50, 1)::numeric AS planned_labor_hours,
    ROUND(COALESCE(fp.yhat, 0) * 0.28, 2)::numeric        AS planned_labor_cost,
    25::numeric                                            AS forecast_avg_check,
    COALESCE(fp.yhat_lower, 0)::numeric                    AS forecast_sales_lower,
    COALESCE(fp.yhat_upper, 0)::numeric                    AS forecast_sales_upper,
    'demo'::text                                           AS data_source
  FROM forecast_points fp
  JOIN (
    SELECT DISTINCT ON (org_id, location_id)
      id, org_id, location_id
    FROM forecast_runs
    WHERE status IN ('finished','completed')
    ORDER BY org_id, location_id, finished_at DESC NULLS LAST
  ) lr ON lr.id = fp.forecast_run_id

  UNION ALL

  -- ── POS: weekday-average heuristic (56-day history → 14-day horizon)
  SELECT
    hist.org_id,
    hist.location_id,
    fd.day,
    COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)::numeric   AS forecast_sales,
    COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 0)::integer AS forecast_orders,
    ROUND(
      COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
      * COALESCE(ls.target_col_percent, 28) / 100.0
      / NULLIF(COALESCE(ls.default_hourly_cost, 14.50), 0), 1
    )::numeric                                                        AS planned_labor_hours,
    ROUND(
      COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
      * COALESCE(ls.target_col_percent, 28) / 100.0, 2
    )::numeric                                                        AS planned_labor_cost,
    CASE WHEN COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 0) > 0
         THEN ROUND(
           COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
           / COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 1), 2
         )::numeric
         ELSE 0 END                                                   AS forecast_avg_check,
    ROUND(COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0) * 0.85, 2)::numeric AS forecast_sales_lower,
    ROUND(COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0) * 1.15, 2)::numeric AS forecast_sales_upper,
    'pos'::text                                                       AS data_source
  FROM (
    -- Per-location overall averages from last 56 days of POS orders
    SELECT
      o.org_id,
      o.location_id,
      ROUND(AVG(day_sales), 2)   AS overall_avg_sales,
      ROUND(AVG(day_orders))     AS overall_avg_orders
    FROM (
      SELECT
        org_id, location_id,
        (closed_at)::date AS d,
        SUM(net_sales)    AS day_sales,
        COUNT(*)          AS day_orders
      FROM cdm_orders
      WHERE closed_at IS NOT NULL
        AND (provider IS NOT NULL OR integration_account_id IS NOT NULL)
        AND closed_at >= (current_date - 56)
      GROUP BY org_id, location_id, (closed_at)::date
    ) o
    GROUP BY o.org_id, o.location_id
  ) hist
  -- Generate 14 future days
  CROSS JOIN LATERAL generate_series(
    current_date, current_date + 13, '1 day'::interval
  ) AS fd(day)
  -- Weekday-specific averages
  LEFT JOIN LATERAL (
    SELECT
      ROUND(AVG(day_sales), 2) AS avg_sales,
      ROUND(AVG(day_orders))   AS avg_orders
    FROM (
      SELECT
        SUM(net_sales) AS day_sales,
        COUNT(*)       AS day_orders
      FROM cdm_orders
      WHERE org_id = hist.org_id
        AND location_id = hist.location_id
        AND closed_at IS NOT NULL
        AND (provider IS NOT NULL OR integration_account_id IS NOT NULL)
        AND closed_at >= (current_date - 56)
        AND EXTRACT(DOW FROM closed_at) = EXTRACT(DOW FROM fd.day)
      GROUP BY (closed_at)::date
    ) wd
  ) dow_avg ON true
  LEFT JOIN location_settings ls ON ls.location_id = hist.location_id
) r
-- ── Filter by resolved data source ───────────────────────────
JOIN LATERAL resolve_data_source(r.org_id) ds ON true
WHERE ds->>'data_source' = r.data_source;

GRANT SELECT ON forecast_daily_unified TO anon, authenticated;


-- ============================================================
-- I) RPCs rewritten to read only from unified views
--    (data source resolution happens inside the views)
-- ============================================================

-- I.1  get_sales_timeseries_unified
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
  v_ds     jsonb;
  v_kpis   jsonb;
  v_daily  jsonb;
  v_hourly jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  -- KPIs from sales_daily_unified
  SELECT jsonb_build_object(
    'actual_sales',       COALESCE(SUM(net_sales), 0),
    'forecast_sales',     COALESCE(SUM(fc.forecast_sales), 0),
    'actual_orders',      COALESCE(SUM(orders_count), 0),
    'forecast_orders',    COALESCE(SUM(fc.forecast_orders), 0),
    'avg_check_actual',   CASE WHEN COALESCE(SUM(orders_count), 0) > 0
                               THEN SUM(net_sales) / SUM(orders_count) ELSE 0 END,
    'avg_check_forecast', CASE WHEN COALESCE(SUM(fc.forecast_orders), 0) > 0
                               THEN SUM(fc.forecast_sales) / SUM(fc.forecast_orders) ELSE 0 END
  ) INTO v_kpis
  FROM sales_daily_unified s
  LEFT JOIN (
    SELECT location_id, day, forecast_sales, forecast_orders
    FROM forecast_daily_unified
    WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
      AND day BETWEEN p_from AND p_to
  ) fc ON fc.location_id = s.location_id AND fc.day = s.date
  WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids)
    AND s.date BETWEEN p_from AND p_to;

  -- Daily timeseries
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      s.date,
      SUM(COALESCE(s.net_sales, 0))::numeric     AS actual_sales,
      SUM(COALESCE(s.orders_count, 0))::integer   AS actual_orders,
      COALESCE(SUM(fc.forecast_sales), 0)::numeric AS forecast_sales,
      COALESCE(SUM(fc.forecast_orders), 0)::integer AS forecast_orders,
      COALESCE(SUM(fc.forecast_sales_lower), 0)::numeric AS lower,
      COALESCE(SUM(fc.forecast_sales_upper), 0)::numeric AS upper
    FROM sales_daily_unified s
    LEFT JOIN (
      SELECT location_id, day,
             forecast_sales, forecast_orders,
             forecast_sales_lower, forecast_sales_upper
      FROM forecast_daily_unified
      WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
        AND day BETWEEN p_from AND p_to
    ) fc ON fc.location_id = s.location_id AND fc.day = s.date
    WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids)
      AND s.date BETWEEN p_from AND p_to
    GROUP BY s.date
  ) d;

  -- Hourly from sales_hourly_unified
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.ts_hour), '[]'::jsonb) INTO v_hourly
  FROM (
    SELECT
      hour_bucket AS ts_hour,
      SUM(net_sales)::numeric      AS actual_sales,
      SUM(orders_count)::integer   AS actual_orders,
      0::numeric AS forecast_sales,
      0::integer AS forecast_orders,
      0::numeric AS lower,
      0::numeric AS upper
    FROM sales_hourly_unified
    WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
      AND day BETWEEN p_from AND p_to
    GROUP BY hour_bucket
  ) h;

  RETURN jsonb_build_object(
    'data_source',    v_ds->>'data_source',
    'mode',           v_ds->>'mode',
    'reason',         v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'kpis',           v_kpis,
    'daily',          v_daily,
    'hourly',         v_hourly,
    'busy_hours',     '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_timeseries_unified(uuid, uuid[], date, date) TO anon, authenticated;


-- I.2  get_top_products_unified
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
  v_ds    jsonb;
  v_total numeric;
  v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  -- Total sales from sales_daily_unified
  SELECT COALESCE(SUM(net_sales), 0) INTO v_total
  FROM sales_daily_unified
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
    AND date BETWEEN p_from AND p_to;

  -- Products from product_sales_daily_unified
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      product_id::text,
      product_name AS name,
      product_category AS category,
      SUM(COALESCE(net_sales, 0))::numeric AS sales,
      SUM(COALESCE(units_sold, 0))::numeric AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(net_sales, 0)) / v_total ELSE 0 END AS share
    FROM product_sales_daily_unified
    WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
      AND day BETWEEN p_from AND p_to
    GROUP BY product_id, product_name, product_category
    ORDER BY sales DESC
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'data_source',    v_ds->>'data_source',
    'mode',           v_ds->>'mode',
    'reason',         v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'total_sales',    v_total,
    'items',          v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_products_unified(uuid, uuid[], date, date, integer) TO anon, authenticated;


-- I.3  get_instant_pnl_unified
CREATE OR REPLACE FUNCTION public.get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id,
      l.name AS location_name,
      COALESCE(s.net_sales, 0)::numeric         AS actual_sales,
      COALESCE(fc.forecast_sales, 0)::numeric   AS forecast_sales,
      ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS actual_cogs,
      ROUND(COALESCE(fc.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS forecast_cogs,
      COALESCE(s.labor_cost, 0)::numeric        AS actual_labour,
      COALESCE(s.labor_hours, 0)::numeric       AS actual_labour_hours,
      COALESCE(fc.planned_labor_cost, 0)::numeric AS forecast_labour,
      COALESCE(fc.planned_labor_hours, 0)::numeric AS forecast_labour_hours,
      (COALESCE(s.net_sales, 0)
        - ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(s.labor_cost, 0))::numeric   AS actual_gp,
      (COALESCE(fc.forecast_sales, 0)
        - ROUND(COALESCE(fc.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(fc.planned_labor_cost, 0))::numeric AS forecast_gp,
      true AS estimated_cogs,
      CASE WHEN COALESCE(s.labor_cost, 0) = 0 AND COALESCE(s.net_sales, 0) > 0
        THEN true ELSE false END AS estimated_labour
    FROM locations l
    LEFT JOIN (
      SELECT location_id,
             SUM(net_sales) AS net_sales,
             SUM(labor_cost) AS labor_cost,
             SUM(labor_hours) AS labor_hours
      FROM sales_daily_unified
      WHERE org_id = p_org_id AND date BETWEEN p_from AND p_to
      GROUP BY 1
    ) s ON s.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
             SUM(forecast_sales) AS forecast_sales,
             SUM(planned_labor_cost) AS planned_labor_cost,
             SUM(planned_labor_hours) AS planned_labor_hours
      FROM forecast_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) fc ON fc.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
        CASE WHEN SUM(net_sales) > 0 THEN SUM(cogs) / SUM(net_sales) ELSE 0.32 END AS cogs_pct
      FROM product_sales_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) cg ON cg.location_id = l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source',    v_ds->>'data_source',
    'mode',           v_ds->>'mode',
    'reason',         v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'locations',      v_locs,
    'flags',          jsonb_build_object('estimated_cogs', true, 'cogs_note', 'COGS from product mix ratio')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, uuid[], date, date) TO anon, authenticated;


-- ============================================================
-- Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
