-- ============================================================
-- Refactor unified RPCs to use v_*_unified views
--
-- Changes:
--   - Eliminates v_ds_legacy variable from all RPCs
--   - Reads from v_*_unified views instead of raw tables
--   - Filters on data_source_unified = v_ds (always 'demo'|'pos')
--   - No change to return shapes or function signatures
-- ============================================================


-- ============================================================
-- A) get_sales_timeseries_unified — uses views
-- ============================================================
CREATE OR REPLACE FUNCTION get_sales_timeseries_unified(
  p_org_id       uuid,
  p_location_ids uuid[],
  p_from         date,
  p_to           date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve     jsonb;
  v_ds          text;        -- 'demo' | 'pos'
  v_mode        text;
  v_reason      text;
  v_last_synced timestamptz;

  v_hourly      jsonb;
  v_daily       jsonb;
  v_kpis        jsonb;
  v_busy_hours  jsonb;
BEGIN
  -- 1) Resolve data source
  v_resolve := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;

  -- 2) Hourly timeseries (actual + forecast)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ts_hour',         COALESCE(a.ts_hour, f.ts_hour),
      'actual_sales',    COALESCE(a.actual_sales, 0),
      'actual_orders',   COALESCE(a.actual_orders, 0),
      'forecast_sales',  COALESCE(f.forecast_sales, 0),
      'forecast_orders', COALESCE(f.forecast_orders, 0),
      'lower',           COALESCE(f.lower, 0),
      'upper',           COALESCE(f.upper, 0)
    ) ORDER BY COALESCE(a.ts_hour, f.ts_hour)
  ), '[]'::jsonb)
  INTO v_hourly
  FROM (
    SELECT
      date_trunc('hour', fs.ts_bucket AT TIME ZONE 'Europe/Madrid')
        AT TIME ZONE 'Europe/Madrid' AS ts_hour,
      SUM(fs.sales_net)  AS actual_sales,
      SUM(fs.tickets)    AS actual_orders
    FROM v_facts_sales_15m_unified fs
    WHERE fs.location_id = ANY(p_location_ids)
      AND fs.data_source_unified = v_ds
      AND (fs.ts_bucket AT TIME ZONE 'Europe/Madrid')::date
          BETWEEN p_from AND p_to
    GROUP BY 1
  ) a
  FULL OUTER JOIN (
    SELECT
      (fh.forecast_date + (fh.hour_of_day || ' hours')::interval)
        AT TIME ZONE 'Europe/Madrid' AS ts_hour,
      SUM(fh.forecast_sales)       AS forecast_sales,
      SUM(fh.forecast_orders)      AS forecast_orders,
      SUM(fh.forecast_sales_lower) AS lower,
      SUM(fh.forecast_sales_upper) AS upper
    FROM forecast_hourly_metrics fh
    WHERE fh.location_id = ANY(p_location_ids)
      AND fh.data_source = v_ds
      AND fh.forecast_date BETWEEN p_from AND p_to
    GROUP BY 1
  ) f ON a.ts_hour = f.ts_hour;

  -- 3) Daily timeseries (actual + forecast)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',            COALESCE(a.day, f.day),
      'actual_sales',    COALESCE(a.actual_sales, 0),
      'actual_orders',   COALESCE(a.actual_orders, 0),
      'forecast_sales',  COALESCE(f.forecast_sales, 0),
      'forecast_orders', COALESCE(
        NULLIF(f.forecast_orders, 0),
        CASE
          WHEN COALESCE(f.forecast_sales, 0) > 0
               AND COALESCE(a.avg_ticket_hist, 0) > 0
          THEN ROUND(f.forecast_sales / a.avg_ticket_hist)
          ELSE 0
        END
      ),
      'lower',           COALESCE(f.lower, 0),
      'upper',           COALESCE(f.upper, 0)
    ) ORDER BY COALESCE(a.day, f.day)
  ), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      pdf.date AS day,
      SUM(pdf.net_sales)     AS actual_sales,
      SUM(pdf.orders_count)  AS actual_orders,
      CASE
        WHEN SUM(pdf.orders_count) > 0
        THEN SUM(pdf.net_sales) / SUM(pdf.orders_count)
        ELSE 0
      END AS avg_ticket_hist
    FROM v_pos_daily_finance_unified pdf
    WHERE pdf.location_id = ANY(p_location_ids)
      AND pdf.data_source_unified = v_ds
      AND pdf.date BETWEEN p_from AND p_to
    GROUP BY pdf.date
  ) a
  FULL OUTER JOIN (
    SELECT
      fd.date AS day,
      SUM(fd.forecast_sales)  AS forecast_sales,
      SUM(fd.forecast_orders) AS forecast_orders,
      SUM(fh_agg.lower)       AS lower,
      SUM(fh_agg.upper)       AS upper
    FROM forecast_daily_metrics fd
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(fh.forecast_sales_lower), 0) AS lower,
        COALESCE(SUM(fh.forecast_sales_upper), 0) AS upper
      FROM forecast_hourly_metrics fh
      WHERE fh.location_id = ANY(p_location_ids)
        AND fh.data_source = v_ds
        AND fh.forecast_date = fd.date
    ) fh_agg ON true
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source = v_ds
      AND fd.date BETWEEN p_from AND p_to
    GROUP BY fd.date
  ) f ON a.day = f.day;

  -- 4) KPIs: totals across the date range
  SELECT jsonb_build_object(
    'actual_sales',       COALESCE(act.total_sales, 0),
    'forecast_sales',     COALESCE(fct.total_forecast_sales, 0),
    'actual_orders',      COALESCE(act.total_orders, 0),
    'forecast_orders',    COALESCE(
      NULLIF(fct.total_forecast_orders, 0),
      CASE
        WHEN COALESCE(fct.total_forecast_sales, 0) > 0
             AND COALESCE(act.total_orders, 0) > 0
             AND COALESCE(act.total_sales, 0) > 0
        THEN ROUND(fct.total_forecast_sales / (act.total_sales / act.total_orders))
        ELSE 0
      END
    ),
    'avg_check_actual',   CASE
                            WHEN COALESCE(act.total_orders, 0) > 0
                            THEN ROUND(act.total_sales / act.total_orders, 2)
                            ELSE 0
                          END,
    'avg_check_forecast', CASE
                            WHEN COALESCE(fct.total_forecast_orders, 0) > 0
                            THEN ROUND(fct.total_forecast_sales / fct.total_forecast_orders, 2)
                            WHEN COALESCE(act.total_orders, 0) > 0
                            THEN ROUND(act.total_sales / act.total_orders, 2)
                            ELSE 0
                          END
  )
  INTO v_kpis
  FROM (
    SELECT
      SUM(pdf.net_sales)    AS total_sales,
      SUM(pdf.orders_count) AS total_orders
    FROM v_pos_daily_finance_unified pdf
    WHERE pdf.location_id = ANY(p_location_ids)
      AND pdf.data_source_unified = v_ds
      AND pdf.date BETWEEN p_from AND p_to
  ) act
  CROSS JOIN (
    SELECT
      SUM(fd.forecast_sales)  AS total_forecast_sales,
      SUM(fd.forecast_orders) AS total_forecast_orders
    FROM forecast_daily_metrics fd
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source = v_ds
      AND fd.date BETWEEN p_from AND p_to
  ) fct;

  -- 5) Busy hours: top 3 forecast hours per day
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',           bh.forecast_date,
      'hour',           bh.hour_of_day,
      'forecast_sales', bh.forecast_sales
    ) ORDER BY bh.forecast_date, bh.rn
  ), '[]'::jsonb)
  INTO v_busy_hours
  FROM (
    SELECT
      fh.forecast_date,
      fh.hour_of_day,
      SUM(fh.forecast_sales) AS forecast_sales,
      ROW_NUMBER() OVER (
        PARTITION BY fh.forecast_date
        ORDER BY SUM(fh.forecast_sales) DESC
      ) AS rn
    FROM forecast_hourly_metrics fh
    WHERE fh.location_id = ANY(p_location_ids)
      AND fh.data_source = v_ds
      AND fh.forecast_date BETWEEN p_from AND p_to
    GROUP BY fh.forecast_date, fh.hour_of_day
  ) bh
  WHERE bh.rn <= 3;

  -- 6) Assemble final JSON
  RETURN jsonb_build_object(
    'data_source',   v_ds,
    'mode',          v_mode,
    'reason',        v_reason,
    'last_synced_at', v_last_synced,
    'hourly',        v_hourly,
    'daily',         v_daily,
    'kpis',          v_kpis,
    'busy_hours',    v_busy_hours
  );
END;
$$;


-- ============================================================
-- B) get_top_products_unified — uses v_product_sales_daily_unified
-- ============================================================
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id       uuid,
  p_location_ids uuid[],
  p_from         date,
  p_to           date,
  p_limit        int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve    jsonb;
  v_ds         text;
  v_items      jsonb;
  v_total_sales numeric;
BEGIN
  v_resolve := resolve_data_source(p_org_id);
  v_ds      := v_resolve->>'data_source';

  -- Total sales for share calculation
  SELECT COALESCE(SUM(psd.net_sales), 0)
    INTO v_total_sales
    FROM v_product_sales_daily_unified psd
   WHERE psd.location_id = ANY(p_location_ids)
     AND psd.data_source_unified = v_ds
     AND psd.date BETWEEN p_from AND p_to;

  -- Top products
  SELECT COALESCE(jsonb_agg(row_j ORDER BY row_j->>'sales' DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'product_id', p.id,
        'name',       p.name,
        'category',   COALESCE(p.category, 'Sin categoría'),
        'sales',      SUM(psd.net_sales),
        'qty',        SUM(psd.units_sold),
        'share',      CASE
                        WHEN v_total_sales > 0
                        THEN ROUND(SUM(psd.net_sales) / v_total_sales * 100, 2)
                        ELSE 0
                      END
      ) AS row_j
      FROM v_product_sales_daily_unified psd
      JOIN products p ON p.id = psd.product_id
      WHERE psd.location_id = ANY(p_location_ids)
        AND psd.data_source_unified = v_ds
        AND psd.date BETWEEN p_from AND p_to
      GROUP BY p.id, p.name, p.category
      ORDER BY SUM(psd.net_sales) DESC
      LIMIT p_limit
    ) sub;

  RETURN jsonb_build_object(
    'data_source',   v_ds,
    'mode',          v_resolve->>'mode',
    'reason',        v_resolve->>'reason',
    'last_synced_at', v_resolve->>'last_synced_at',
    'total_sales',   v_total_sales,
    'items',         v_items
  );
END;
$$;


-- ============================================================
-- C) get_forecast_items_mix_unified — uses v_product_sales_daily_unified
-- ============================================================
CREATE OR REPLACE FUNCTION get_forecast_items_mix_unified(
  p_org_id        uuid,
  p_location_ids  uuid[],
  p_from          date,
  p_to            date,
  p_horizon_days  int DEFAULT 14,
  p_limit         int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve      jsonb;
  v_ds           text;
  v_hist_from    date;
  v_hist_to      date;
  v_horizon_from date;
  v_horizon_to   date;
  v_items        jsonb;
BEGIN
  v_resolve := resolve_data_source(p_org_id);
  v_ds      := v_resolve->>'data_source';

  -- Historical window: last 8 weeks from p_from
  v_hist_to   := p_from - 1;
  v_hist_from := v_hist_to - 55;

  -- Forecast horizon
  v_horizon_from := CURRENT_DATE;
  v_horizon_to   := CURRENT_DATE + p_horizon_days - 1;

  WITH
  day_totals AS (
    SELECT
      psd.date,
      EXTRACT(ISODOW FROM psd.date)::int AS dow,
      SUM(psd.net_sales) AS total_sales
    FROM v_product_sales_daily_unified psd
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source_unified = v_ds
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.date
    HAVING SUM(psd.net_sales) > 0
  ),
  product_day AS (
    SELECT
      psd.product_id,
      psd.date,
      dt.dow,
      SUM(psd.net_sales) AS product_sales,
      dt.total_sales,
      LEAST(GREATEST(SUM(psd.net_sales) / dt.total_sales, 0), 1) AS day_share
    FROM v_product_sales_daily_unified psd
    JOIN day_totals dt ON dt.date = psd.date
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source_unified = v_ds
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.product_id, psd.date, dt.dow, dt.total_sales
  ),
  mix_by_dow AS (
    SELECT product_id, dow, AVG(day_share) AS mix_share, COUNT(*) AS sample_count
    FROM product_day
    GROUP BY product_id, dow
  ),
  mix_global AS (
    SELECT product_id, AVG(day_share) AS mix_share_global
    FROM product_day
    GROUP BY product_id
  ),
  mix_resolved AS (
    SELECT
      COALESCE(md.product_id, mg.product_id) AS product_id,
      COALESCE(md.dow, gen.dow)              AS dow,
      CASE
        WHEN md.sample_count >= 3 THEN md.mix_share
        ELSE COALESCE(mg.mix_share_global, 0)
      END AS mix_share
    FROM mix_global mg
    CROSS JOIN generate_series(1, 7) AS gen(dow)
    LEFT JOIN mix_by_dow md
      ON md.product_id = mg.product_id AND md.dow = gen.dow
  ),
  avg_prices AS (
    SELECT
      psd.product_id,
      CASE
        WHEN SUM(psd.units_sold) > 0
        THEN SUM(psd.net_sales) / SUM(psd.units_sold)
        ELSE NULL
      END AS avg_unit_price
    FROM v_product_sales_daily_unified psd
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source_unified = v_ds
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.product_id
  ),
  forecast_days AS (
    SELECT
      fd.date AS forecast_date,
      EXTRACT(ISODOW FROM fd.date)::int AS dow,
      SUM(fd.forecast_sales) AS forecast_sales
    FROM forecast_daily_metrics fd
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source = v_ds
      AND fd.date BETWEEN v_horizon_from AND v_horizon_to
    GROUP BY fd.date
  ),
  forecast_items AS (
    SELECT
      mr.product_id,
      fdy.forecast_date,
      fdy.forecast_sales * mr.mix_share AS forecast_item_sales,
      CASE
        WHEN ap.avg_unit_price IS NOT NULL AND ap.avg_unit_price > 0
        THEN ROUND(fdy.forecast_sales * mr.mix_share / ap.avg_unit_price, 1)
        ELSE NULL
      END AS forecast_item_qty
    FROM forecast_days fdy
    JOIN mix_resolved mr ON mr.dow = fdy.dow
    LEFT JOIN avg_prices ap ON ap.product_id = mr.product_id
    WHERE mr.mix_share > 0
  ),
  product_totals AS (
    SELECT
      fi.product_id,
      SUM(fi.forecast_item_sales)  AS total_forecast_sales,
      SUM(fi.forecast_item_qty)    AS total_forecast_qty
    FROM forecast_items fi
    GROUP BY fi.product_id
    ORDER BY SUM(fi.forecast_item_sales) DESC
    LIMIT p_limit
  )
  SELECT
    jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id',           pt.product_id,
            'name',                 p.name,
            'category',             COALESCE(p.category, 'Sin categoría'),
            'total_forecast_sales', ROUND(pt.total_forecast_sales, 2),
            'total_forecast_qty',   pt.total_forecast_qty,
            'avg_unit_price',       ROUND(COALESCE(ap.avg_unit_price, 0), 2),
            'daily', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'date',           fi2.forecast_date,
                  'forecast_sales', ROUND(fi2.forecast_item_sales, 2),
                  'forecast_qty',   fi2.forecast_item_qty
                ) ORDER BY fi2.forecast_date
              )
              FROM forecast_items fi2
              WHERE fi2.product_id = pt.product_id
            ), '[]'::jsonb)
          ) ORDER BY pt.total_forecast_sales DESC
        )
        FROM product_totals pt
        JOIN products p ON p.id = pt.product_id
        LEFT JOIN avg_prices ap ON ap.product_id = pt.product_id
      ), '[]'::jsonb)
    )
  INTO v_items;

  RETURN jsonb_build_object(
    'data_source',    v_ds,
    'mode',           v_resolve->>'mode',
    'reason',         v_resolve->>'reason',
    'last_synced_at', v_resolve->>'last_synced_at',
    'hist_window',    jsonb_build_object('from', v_hist_from, 'to', v_hist_to),
    'horizon',        jsonb_build_object('from', v_horizon_from, 'to', v_horizon_to),
    'items',          v_items->'items'
  );
END;
$$;


-- ============================================================
-- D) audit_data_coherence — uses v_*_unified views
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
  v_ds            text;
  v_mode          text;
  v_reason        text;
  v_last_synced   timestamptz;

  v_from          date;
  v_to            date;

  v_check1        jsonb;
  v_check2        jsonb;
  v_check3        jsonb;
  v_check4        jsonb;
  v_check5        jsonb;

  v_all_pass      boolean := true;
BEGIN
  v_resolve     := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;

  v_to   := CURRENT_DATE;
  v_from := v_to - p_days;

  -- CHECK 1: Data source consistency (via unified views)
  SELECT jsonb_build_object(
    'name',   'data_source_consistency',
    'pass',   COALESCE(bool_and(t.pass), true),
    'tables', COALESCE(jsonb_agg(
      jsonb_build_object(
        'table',        t.tbl,
        'expected_ds',  v_ds,
        'rows_active',  t.rows_active,
        'rows_other',   t.rows_other,
        'pass',         t.pass,
        'error',        t.err
      )
    ), '[]'::jsonb)
  )
  INTO v_check1
  FROM (
    SELECT 'pos_daily_finance' AS tbl,
      COUNT(*) FILTER (WHERE data_source_unified = v_ds) AS rows_active,
      COUNT(*) FILTER (WHERE data_source_unified <> v_ds) AS rows_other,
      (COUNT(*) FILTER (WHERE data_source_unified = v_ds) > 0) AS pass,
      CASE WHEN COUNT(*) FILTER (WHERE data_source_unified = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '" in last ' || p_days || ' days'
        ELSE NULL END AS err
    FROM v_pos_daily_finance_unified
    WHERE location_id = ANY(p_location_ids) AND date BETWEEN v_from AND v_to

    UNION ALL

    SELECT 'product_sales_daily',
      COUNT(*) FILTER (WHERE data_source_unified = v_ds),
      COUNT(*) FILTER (WHERE data_source_unified <> v_ds),
      (COUNT(*) FILTER (WHERE data_source_unified = v_ds) > 0),
      CASE WHEN COUNT(*) FILTER (WHERE data_source_unified = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL END
    FROM v_product_sales_daily_unified
    WHERE location_id = ANY(p_location_ids) AND date BETWEEN v_from AND v_to

    UNION ALL

    SELECT 'facts_sales_15m',
      COUNT(*) FILTER (WHERE data_source_unified = v_ds),
      COUNT(*) FILTER (WHERE data_source_unified <> v_ds),
      (COUNT(*) FILTER (WHERE data_source_unified = v_ds) > 0),
      CASE WHEN COUNT(*) FILTER (WHERE data_source_unified = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL END
    FROM v_facts_sales_15m_unified
    WHERE location_id = ANY(p_location_ids)
      AND (ts_bucket AT TIME ZONE 'Europe/Madrid')::date BETWEEN v_from AND v_to

    UNION ALL

    SELECT 'forecast_daily_metrics',
      COUNT(*) FILTER (WHERE data_source = v_ds),
      COUNT(*) FILTER (WHERE data_source <> v_ds),
      (COUNT(*) FILTER (WHERE data_source = v_ds) > 0),
      CASE WHEN COUNT(*) FILTER (WHERE data_source = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL END
    FROM forecast_daily_metrics
    WHERE location_id = ANY(p_location_ids) AND date BETWEEN v_from AND v_to

    UNION ALL

    SELECT 'forecast_hourly_metrics',
      COUNT(*) FILTER (WHERE data_source = v_ds),
      COUNT(*) FILTER (WHERE data_source <> v_ds),
      (COUNT(*) FILTER (WHERE data_source = v_ds) > 0),
      CASE WHEN COUNT(*) FILTER (WHERE data_source = v_ds) = 0
        THEN 'No rows for active data_source "' || v_ds || '"'
        ELSE NULL END
    FROM forecast_hourly_metrics
    WHERE location_id = ANY(p_location_ids) AND forecast_date BETWEEN v_from AND v_to
  ) t;

  IF NOT (v_check1->>'pass')::boolean THEN v_all_pass := false; END IF;

  -- CHECK 2: forecast_daily ≈ SUM(forecast_hourly)
  WITH daily_vs_hourly AS (
    SELECT fd.date AS day,
      SUM(fd.forecast_sales) AS daily_total,
      COALESCE(h.hourly_total, 0) AS hourly_total,
      CASE WHEN SUM(fd.forecast_sales) > 0
        THEN ABS(SUM(fd.forecast_sales) - COALESCE(h.hourly_total, 0))
             / SUM(fd.forecast_sales) * 100
        ELSE 0 END AS pct_diff
    FROM forecast_daily_metrics fd
    LEFT JOIN (
      SELECT fh.forecast_date, SUM(fh.forecast_sales) AS hourly_total
      FROM forecast_hourly_metrics fh
      WHERE fh.location_id = ANY(p_location_ids)
        AND fh.data_source = v_ds AND fh.forecast_date BETWEEN v_from AND v_to
      GROUP BY fh.forecast_date
    ) h ON h.forecast_date = fd.date
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source = v_ds AND fd.date BETWEEN v_from AND v_to
    GROUP BY fd.date, h.hourly_total
  ),
  flagged AS (SELECT * FROM daily_vs_hourly WHERE pct_diff > 0.5)
  SELECT jsonb_build_object(
    'name', 'forecast_daily_vs_hourly', 'pass', NOT EXISTS (SELECT 1 FROM flagged),
    'tolerance_pct', 0.5,
    'days_checked', (SELECT COUNT(*) FROM daily_vs_hourly),
    'days_failed',  (SELECT COUNT(*) FROM flagged),
    'failures', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', f.day, 'daily_total', ROUND(f.daily_total::numeric,2),
      'hourly_total', ROUND(f.hourly_total::numeric,2), 'pct_diff', ROUND(f.pct_diff::numeric,3)
    ) ORDER BY f.day) FROM flagged f), '[]'::jsonb)
  ) INTO v_check2;

  IF NOT (v_check2->>'pass')::boolean THEN v_all_pass := false; END IF;

  -- CHECK 3: product_sales_daily ≈ pos_daily_finance
  WITH daily_comparison AS (
    SELECT COALESCE(p.day, f.day) AS day,
      COALESCE(p.product_total, 0) AS product_total,
      COALESCE(f.finance_total, 0) AS finance_total,
      CASE WHEN COALESCE(f.finance_total, 0) > 0
        THEN ABS(COALESCE(p.product_total, 0) - f.finance_total) / f.finance_total * 100
        ELSE 0 END AS pct_diff
    FROM (
      SELECT date AS day, SUM(net_sales) AS product_total
      FROM v_product_sales_daily_unified
      WHERE location_id = ANY(p_location_ids) AND data_source_unified = v_ds
        AND date BETWEEN v_from AND v_to
      GROUP BY date
    ) p
    FULL OUTER JOIN (
      SELECT date AS day, SUM(net_sales) AS finance_total
      FROM v_pos_daily_finance_unified
      WHERE location_id = ANY(p_location_ids) AND data_source_unified = v_ds
        AND date BETWEEN v_from AND v_to
      GROUP BY date
    ) f ON p.day = f.day
  ),
  flagged3 AS (SELECT * FROM daily_comparison WHERE pct_diff > 5)
  SELECT jsonb_build_object(
    'name', 'product_vs_finance_sales', 'pass', NOT EXISTS (SELECT 1 FROM flagged3),
    'tolerance_pct', 5,
    'note', 'product_sales_daily may exclude voided items, discounts, or uncategorized sales',
    'days_checked', (SELECT COUNT(*) FROM daily_comparison),
    'days_failed',  (SELECT COUNT(*) FROM flagged3),
    'totals', (SELECT jsonb_build_object(
      'product_total', ROUND(SUM(product_total)::numeric,2),
      'finance_total', ROUND(SUM(finance_total)::numeric,2),
      'pct_diff', CASE WHEN SUM(finance_total) > 0
        THEN ROUND(ABS(SUM(product_total)-SUM(finance_total))/SUM(finance_total)*100, 3)
        ELSE 0 END
    ) FROM daily_comparison),
    'failures', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', f.day, 'product_total', ROUND(f.product_total::numeric,2),
      'finance_total', ROUND(f.finance_total::numeric,2), 'pct_diff', ROUND(f.pct_diff::numeric,3)
    ) ORDER BY f.day) FROM flagged3 f), '[]'::jsonb)
  ) INTO v_check3;

  IF NOT (v_check3->>'pass')::boolean THEN v_all_pass := false; END IF;

  -- CHECK 4: Missing item mappings
  SELECT jsonb_build_object(
    'name', 'missing_item_mappings',
    'pass', (COUNT(*) = 0),
    'unmapped_lines', COUNT(*),
    'distinct_variations', COUNT(DISTINCT ol.external_variation_id),
    'action', CASE WHEN COUNT(*) > 0
      THEN 'Run backfill_order_lines_item_id(''' || p_org_id || ''') or check cdm_item_variations'
      ELSE 'No action needed' END,
    'sample', COALESCE((SELECT jsonb_agg(s) FROM (
      SELECT jsonb_build_object(
        'order_line_id', ol2.id, 'external_variation_id', ol2.external_variation_id,
        'order_id', ol2.order_id, 'quantity', ol2.quantity, 'unit_price', ol2.unit_price
      ) AS s
      FROM cdm_order_lines ol2
      WHERE ol2.org_id = p_org_id AND ol2.external_variation_id IS NOT NULL AND ol2.item_id IS NULL
      LIMIT 5
    ) sub), '[]'::jsonb)
  )
  INTO v_check4
  FROM cdm_order_lines ol
  WHERE ol.org_id = p_org_id AND ol.external_variation_id IS NOT NULL AND ol.item_id IS NULL;

  IF NOT (v_check4->>'pass')::boolean THEN v_all_pass := false; END IF;

  -- CHECK 5: Sync status
  SELECT jsonb_build_object(
    'name', 'sync_status', 'pass', true,
    'current_mode', v_mode, 'current_source', v_ds, 'reason', v_reason,
    'last_synced_at', v_last_synced,
    'synced_within_24h', (v_last_synced IS NOT NULL AND v_last_synced >= now() - interval '24 hours'),
    'auto_would_use', CASE WHEN v_last_synced IS NOT NULL AND v_last_synced >= now() - interval '24 hours'
      THEN 'pos' ELSE 'demo' END,
    'integrations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'provider', i.provider, 'status', i.status, 'last_synced_at', i.metadata->>'last_synced_at'
    )) FROM integrations i WHERE i.org_id = p_org_id), '[]'::jsonb)
  ) INTO v_check5;

  RETURN jsonb_build_object(
    'audit_ts', now(), 'org_id', p_org_id,
    'location_ids', to_jsonb(p_location_ids),
    'date_range', jsonb_build_object('from', v_from, 'to', v_to),
    'resolved_source', jsonb_build_object(
      'data_source', v_ds, 'mode', v_mode, 'reason', v_reason
    ),
    'all_pass', v_all_pass,
    'checks', jsonb_build_array(v_check1, v_check2, v_check3, v_check4, v_check5)
  );
END;
$$;
