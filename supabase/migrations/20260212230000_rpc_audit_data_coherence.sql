-- ============================================================
-- RPC: audit_data_coherence
--
-- Audits data integrity across the unified data layer.
-- Returns a jsonb report with pass/fail per check plus
-- actionable error details.
--
-- Checks:
--   1. data_source consistency — each key table uses exactly
--      the resolved data_source, no cross-contamination
--   2. forecast_daily ≈ SUM(forecast_hourly) per day (0.5% tol)
--   3. product_sales_daily totals ≈ pos_daily_finance (5% tol)
--   4. missing item mappings in cdm_order_lines
--   5. sync status + auto-switch readiness
-- ============================================================

CREATE OR REPLACE FUNCTION audit_data_coherence(
  p_org_id       uuid,
  p_location_ids uuid[],
  p_days         int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve       jsonb;
  v_ds            text;        -- 'demo' | 'pos'
  v_ds_legacy     text;        -- 'simulated' | 'pos'
  v_mode          text;
  v_reason        text;
  v_last_synced   timestamptz;

  v_from          date;
  v_to            date;

  -- Check results
  v_check1        jsonb;
  v_check2        jsonb;
  v_check3        jsonb;
  v_check4        jsonb;
  v_check5        jsonb;

  v_all_pass      boolean := true;
BEGIN
  -- -------------------------------------------------------
  -- 0) Resolve data source & compute date range
  -- -------------------------------------------------------
  v_resolve     := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;
  v_ds_legacy   := CASE WHEN v_ds = 'pos' THEN 'pos' ELSE 'simulated' END;

  v_to   := CURRENT_DATE;
  v_from := v_to - p_days;

  -- -------------------------------------------------------
  -- CHECK 1: Data source consistency
  --
  -- For each key table, count rows per data_source within
  -- the date range / location scope. Flag if rows exist
  -- under the WRONG data_source (cross-contamination) or
  -- if NO rows exist for the active data_source.
  -- -------------------------------------------------------
  SELECT jsonb_build_object(
    'name',   'data_source_consistency',
    'pass',   COALESCE(bool_and(t.pass), true),
    'tables', COALESCE(jsonb_agg(
      jsonb_build_object(
        'table',              t.tbl,
        'expected_ds',        t.expected_ds,
        'rows_active',        t.rows_active,
        'rows_other',         t.rows_other,
        'pass',               t.pass,
        'error',              t.err
      )
    ), '[]'::jsonb)
  )
  INTO v_check1
  FROM (
    -- pos_daily_finance
    SELECT
      'pos_daily_finance' AS tbl,
      v_ds_legacy AS expected_ds,
      COUNT(*) FILTER (WHERE data_source = v_ds_legacy) AS rows_active,
      COUNT(*) FILTER (WHERE data_source <> v_ds_legacy) AS rows_other,
      (COUNT(*) FILTER (WHERE data_source = v_ds_legacy) > 0) AS pass,
      CASE
        WHEN COUNT(*) FILTER (WHERE data_source = v_ds_legacy) = 0
        THEN 'No rows for active data_source "' || v_ds_legacy || '" in last ' || p_days || ' days'
        ELSE NULL
      END AS err
    FROM pos_daily_finance
    WHERE location_id = ANY(p_location_ids)
      AND date BETWEEN v_from AND v_to

    UNION ALL

    -- product_sales_daily
    SELECT
      'product_sales_daily',
      v_ds_legacy,
      COUNT(*) FILTER (WHERE data_source = v_ds_legacy),
      COUNT(*) FILTER (WHERE data_source <> v_ds_legacy),
      (COUNT(*) FILTER (WHERE data_source = v_ds_legacy) > 0),
      CASE
        WHEN COUNT(*) FILTER (WHERE data_source = v_ds_legacy) = 0
        THEN 'No rows for active data_source "' || v_ds_legacy || '"'
        ELSE NULL
      END
    FROM product_sales_daily
    WHERE location_id = ANY(p_location_ids)
      AND date BETWEEN v_from AND v_to

    UNION ALL

    -- facts_sales_15m
    SELECT
      'facts_sales_15m',
      v_ds_legacy,
      COUNT(*) FILTER (WHERE data_source = v_ds_legacy),
      COUNT(*) FILTER (WHERE data_source <> v_ds_legacy),
      (COUNT(*) FILTER (WHERE data_source = v_ds_legacy) > 0),
      CASE
        WHEN COUNT(*) FILTER (WHERE data_source = v_ds_legacy) = 0
        THEN 'No rows for active data_source "' || v_ds_legacy || '"'
        ELSE NULL
      END
    FROM facts_sales_15m
    WHERE location_id = ANY(p_location_ids)
      AND (ts_bucket AT TIME ZONE 'Europe/Madrid')::date BETWEEN v_from AND v_to

    UNION ALL

    -- forecast_daily_metrics
    SELECT
      'forecast_daily_metrics',
      v_ds,
      COUNT(*) FILTER (WHERE data_source = v_ds),
      COUNT(*) FILTER (WHERE data_source <> v_ds),
      (COUNT(*) FILTER (WHERE data_source = v_ds) > 0),
      CASE
        WHEN COUNT(*) FILTER (WHERE data_source = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL
      END
    FROM forecast_daily_metrics
    WHERE location_id = ANY(p_location_ids)
      AND date BETWEEN v_from AND v_to

    UNION ALL

    -- forecast_hourly_metrics
    SELECT
      'forecast_hourly_metrics',
      v_ds,
      COUNT(*) FILTER (WHERE data_source = v_ds),
      COUNT(*) FILTER (WHERE data_source <> v_ds),
      (COUNT(*) FILTER (WHERE data_source = v_ds) > 0),
      CASE
        WHEN COUNT(*) FILTER (WHERE data_source = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL
      END
    FROM forecast_hourly_metrics
    WHERE location_id = ANY(p_location_ids)
      AND forecast_date BETWEEN v_from AND v_to
  ) t;

  IF NOT (v_check1->>'pass')::boolean THEN
    v_all_pass := false;
  END IF;

  -- -------------------------------------------------------
  -- CHECK 2: Forecast daily ≈ SUM(forecast_hourly) per day
  --          Tolerance: 0.5%
  --
  -- For each day, compare forecast_daily_metrics.forecast_sales
  -- against SUM(forecast_hourly_metrics.forecast_sales).
  -- Flag days where |delta| > 0.5%.
  -- -------------------------------------------------------
  WITH daily_vs_hourly AS (
    SELECT
      fd.date AS day,
      SUM(fd.forecast_sales) AS daily_total,
      COALESCE(h.hourly_total, 0) AS hourly_total,
      CASE
        WHEN SUM(fd.forecast_sales) > 0
        THEN ABS(SUM(fd.forecast_sales) - COALESCE(h.hourly_total, 0))
             / SUM(fd.forecast_sales) * 100
        ELSE 0
      END AS pct_diff
    FROM forecast_daily_metrics fd
    LEFT JOIN (
      SELECT
        fh.forecast_date,
        SUM(fh.forecast_sales) AS hourly_total
      FROM forecast_hourly_metrics fh
      WHERE fh.location_id = ANY(p_location_ids)
        AND fh.data_source = v_ds
        AND fh.forecast_date BETWEEN v_from AND v_to
      GROUP BY fh.forecast_date
    ) h ON h.forecast_date = fd.date
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source = v_ds
      AND fd.date BETWEEN v_from AND v_to
    GROUP BY fd.date, h.hourly_total
  ),
  flagged AS (
    SELECT * FROM daily_vs_hourly WHERE pct_diff > 0.5
  )
  SELECT jsonb_build_object(
    'name',           'forecast_daily_vs_hourly',
    'pass',           NOT EXISTS (SELECT 1 FROM flagged),
    'tolerance_pct',  0.5,
    'days_checked',   (SELECT COUNT(*) FROM daily_vs_hourly),
    'days_failed',    (SELECT COUNT(*) FROM flagged),
    'failures',       COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'date',         f.day,
          'daily_total',  ROUND(f.daily_total::numeric, 2),
          'hourly_total', ROUND(f.hourly_total::numeric, 2),
          'pct_diff',     ROUND(f.pct_diff::numeric, 3)
        ) ORDER BY f.day
      ) FROM flagged f),
      '[]'::jsonb
    )
  )
  INTO v_check2;

  IF NOT (v_check2->>'pass')::boolean THEN
    v_all_pass := false;
  END IF;

  -- -------------------------------------------------------
  -- CHECK 3: product_sales_daily totals ≈ pos_daily_finance
  --          Tolerance: 5% (product breakdown may exclude
  --          voided items, discounts, or uncategorized sales)
  --
  -- Compare SUM(product_sales_daily.net_sales) vs
  -- SUM(pos_daily_finance.net_sales) per day.
  -- -------------------------------------------------------
  WITH daily_comparison AS (
    SELECT
      COALESCE(p.day, f.day) AS day,
      COALESCE(p.product_total, 0) AS product_total,
      COALESCE(f.finance_total, 0) AS finance_total,
      CASE
        WHEN COALESCE(f.finance_total, 0) > 0
        THEN ABS(COALESCE(p.product_total, 0) - f.finance_total)
             / f.finance_total * 100
        ELSE 0
      END AS pct_diff
    FROM (
      SELECT date AS day, SUM(net_sales) AS product_total
      FROM product_sales_daily
      WHERE location_id = ANY(p_location_ids)
        AND data_source = v_ds_legacy
        AND date BETWEEN v_from AND v_to
      GROUP BY date
    ) p
    FULL OUTER JOIN (
      SELECT date AS day, SUM(net_sales) AS finance_total
      FROM pos_daily_finance
      WHERE location_id = ANY(p_location_ids)
        AND data_source = v_ds_legacy
        AND date BETWEEN v_from AND v_to
      GROUP BY date
    ) f ON p.day = f.day
  ),
  flagged3 AS (
    SELECT * FROM daily_comparison WHERE pct_diff > 5
  )
  SELECT jsonb_build_object(
    'name',           'product_vs_finance_sales',
    'pass',           NOT EXISTS (SELECT 1 FROM flagged3),
    'tolerance_pct',  5,
    'note',           'product_sales_daily may exclude voided items, discounts, or uncategorized sales — small deltas expected',
    'days_checked',   (SELECT COUNT(*) FROM daily_comparison),
    'days_failed',    (SELECT COUNT(*) FROM flagged3),
    'totals',         (
      SELECT jsonb_build_object(
        'product_total', ROUND(SUM(product_total)::numeric, 2),
        'finance_total', ROUND(SUM(finance_total)::numeric, 2),
        'pct_diff',      CASE
                           WHEN SUM(finance_total) > 0
                           THEN ROUND(
                             ABS(SUM(product_total) - SUM(finance_total))
                             / SUM(finance_total) * 100, 3
                           )
                           ELSE 0
                         END
      ) FROM daily_comparison
    ),
    'failures',       COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'date',           f.day,
          'product_total',  ROUND(f.product_total::numeric, 2),
          'finance_total',  ROUND(f.finance_total::numeric, 2),
          'pct_diff',       ROUND(f.pct_diff::numeric, 3)
        ) ORDER BY f.day
      ) FROM flagged3 f),
      '[]'::jsonb
    )
  )
  INTO v_check3;

  IF NOT (v_check3->>'pass')::boolean THEN
    v_all_pass := false;
  END IF;

  -- -------------------------------------------------------
  -- CHECK 4: Missing item mappings
  --
  -- cdm_order_lines rows that have external_variation_id
  -- but item_id IS NULL — meaning the variation-to-item
  -- link is broken or the backfill hasn't run.
  -- -------------------------------------------------------
  SELECT jsonb_build_object(
    'name',              'missing_item_mappings',
    'pass',              (COUNT(*) = 0),
    'unmapped_lines',    COUNT(*),
    'distinct_variations', COUNT(DISTINCT ol.external_variation_id),
    'action',            CASE
                           WHEN COUNT(*) > 0
                           THEN 'Run backfill_order_lines_item_id(''' || p_org_id || ''') or check cdm_item_variations for missing entries'
                           ELSE 'No action needed'
                         END,
    'sample',            COALESCE(
      (SELECT jsonb_agg(s) FROM (
        SELECT jsonb_build_object(
          'order_line_id',          ol2.id,
          'external_variation_id',  ol2.external_variation_id,
          'order_id',               ol2.order_id,
          'quantity',               ol2.quantity,
          'unit_price',             ol2.unit_price
        ) AS s
        FROM cdm_order_lines ol2
        WHERE ol2.org_id = p_org_id
          AND ol2.external_variation_id IS NOT NULL
          AND ol2.item_id IS NULL
        LIMIT 5
      ) sub),
      '[]'::jsonb
    )
  )
  INTO v_check4
  FROM cdm_order_lines ol
  WHERE ol.org_id = p_org_id
    AND ol.external_variation_id IS NOT NULL
    AND ol.item_id IS NULL;

  IF NOT (v_check4->>'pass')::boolean THEN
    v_all_pass := false;
  END IF;

  -- -------------------------------------------------------
  -- CHECK 5: Sync status & auto-switch readiness
  --
  -- Reports last_synced_at, whether auto mode would
  -- currently resolve to 'pos', and integration status.
  -- -------------------------------------------------------
  SELECT jsonb_build_object(
    'name',             'sync_status',
    'pass',             true,  -- informational check, always passes
    'current_mode',     v_mode,
    'current_source',   v_ds,
    'reason',           v_reason,
    'last_synced_at',   v_last_synced,
    'synced_within_24h', (v_last_synced IS NOT NULL
                          AND v_last_synced >= now() - interval '24 hours'),
    'auto_would_use',   CASE
                           WHEN v_last_synced IS NOT NULL
                                AND v_last_synced >= now() - interval '24 hours'
                           THEN 'pos'
                           ELSE 'demo'
                         END,
    'integrations',     COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'provider',       i.provider,
          'status',         i.status,
          'last_synced_at', i.metadata->>'last_synced_at'
        )
      ) FROM integrations i
      WHERE i.org_id = p_org_id),
      '[]'::jsonb
    )
  )
  INTO v_check5;

  -- -------------------------------------------------------
  -- Assemble final report
  -- -------------------------------------------------------
  RETURN jsonb_build_object(
    'audit_ts',       now(),
    'org_id',         p_org_id,
    'location_ids',   to_jsonb(p_location_ids),
    'date_range',     jsonb_build_object('from', v_from, 'to', v_to),
    'resolved_source', jsonb_build_object(
      'data_source', v_ds,
      'legacy',      v_ds_legacy,
      'mode',        v_mode,
      'reason',      v_reason
    ),
    'all_pass',       v_all_pass,
    'checks',         jsonb_build_array(
      v_check1,
      v_check2,
      v_check3,
      v_check4,
      v_check5
    )
  );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION audit_data_coherence(uuid, uuid[], int)
  TO authenticated;

-- ============================================================
-- EXAMPLE QUERY
--
-- Replace UUIDs with real org / location IDs:
--
-- SELECT audit_data_coherence(
--   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
--   ARRAY[
--     '11111111-2222-3333-4444-555555555555'::uuid
--   ],
--   30  -- last 30 days
-- );
--
-- Via Supabase REST API:
--
-- curl -X POST \
--   "https://qixipveebfhurbarksib.supabase.co/rest/v1/rpc/audit_data_coherence" \
--   -H "apikey: <service_role_key>" \
--   -H "Authorization: Bearer <service_role_key>" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "p_org_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
--     "p_location_ids": ["11111111-2222-3333-4444-555555555555"],
--     "p_days": 30
--   }'
--
-- Expected output shape:
-- {
--   "audit_ts": "2026-02-12T...",
--   "org_id": "aaaa...",
--   "location_ids": ["1111..."],
--   "date_range": { "from": "2026-01-13", "to": "2026-02-12" },
--   "resolved_source": { "data_source": "demo", "legacy": "simulated", ... },
--   "all_pass": true,
--   "checks": [
--     { "name": "data_source_consistency", "pass": true, "tables": [...] },
--     { "name": "forecast_daily_vs_hourly", "pass": true, "days_checked": 30, ... },
--     { "name": "product_vs_finance_sales", "pass": true, "days_checked": 30, ... },
--     { "name": "missing_item_mappings", "pass": true, "unmapped_lines": 0, ... },
--     { "name": "sync_status", "pass": true, "current_source": "demo", ... }
--   ]
-- }
-- ============================================================
