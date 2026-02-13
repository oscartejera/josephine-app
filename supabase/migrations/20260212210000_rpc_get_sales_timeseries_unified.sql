-- ============================================================
-- RPC: get_sales_timeseries_unified
--
-- Single entrypoint for sales + forecast timeseries.
-- Uses resolve_data_source() to pick demo vs pos automatically.
--
-- Legacy mapping:
--   facts_sales_15m / pos_daily_finance use 'simulated' | 'pos'
--   forecast_hourly_metrics / forecast_daily_metrics use 'demo' | 'pos'
--   resolve_data_source returns 'demo' | 'pos'
--   => v_ds_legacy maps 'demo' -> 'simulated' for fact tables
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
  v_ds_legacy   text;        -- 'simulated' | 'pos' (for facts/pos_daily tables)
  v_mode        text;
  v_reason      text;
  v_last_synced timestamptz;

  v_hourly      jsonb;
  v_daily       jsonb;
  v_kpis        jsonb;
  v_busy_hours  jsonb;
BEGIN
  -- -------------------------------------------------------
  -- 1) Resolve data source
  -- -------------------------------------------------------
  v_resolve := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;

  -- Map to legacy column values used by fact tables
  v_ds_legacy := CASE WHEN v_ds = 'pos' THEN 'pos' ELSE 'simulated' END;

  -- -------------------------------------------------------
  -- 2) Hourly timeseries (actual + forecast) in Europe/Madrid
  --
  --    Actual: facts_sales_15m aggregated to hour
  --      - sales_net for actual_sales
  --      - tickets for actual_orders
  --    Forecast: forecast_hourly_metrics
  --      - forecast_sales, forecast_orders, lower, upper
  --
  --    FULL OUTER JOIN so hours with only actuals or only
  --    forecast still appear.
  -- -------------------------------------------------------
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
    -- Actual hourly from facts_sales_15m
    SELECT
      date_trunc('hour', fs.ts_bucket AT TIME ZONE 'Europe/Madrid')
        AT TIME ZONE 'Europe/Madrid' AS ts_hour,
      SUM(fs.sales_net)  AS actual_sales,
      SUM(fs.tickets)    AS actual_orders
    FROM facts_sales_15m fs
    WHERE fs.location_id = ANY(p_location_ids)
      AND fs.data_source = v_ds_legacy
      AND (fs.ts_bucket AT TIME ZONE 'Europe/Madrid')::date
          BETWEEN p_from AND p_to
    GROUP BY 1
  ) a
  FULL OUTER JOIN (
    -- Forecast hourly
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

  -- -------------------------------------------------------
  -- 3) Daily timeseries (actual + forecast)
  --
  --    Actual daily: pos_daily_finance (net_sales, orders_count)
  --    Forecast daily: forecast_daily_metrics
  --    Forecast lower/upper: aggregate from hourly per day
  --
  --    If forecast_orders = 0 but forecast_sales > 0,
  --    derive orders via avg_ticket from actual data:
  --      forecast_orders = forecast_sales / avg_ticket_hist
  -- -------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',            COALESCE(a.day, f.day),
      'actual_sales',    COALESCE(a.actual_sales, 0),
      'actual_orders',   COALESCE(a.actual_orders, 0),
      'forecast_sales',  COALESCE(f.forecast_sales, 0),
      'forecast_orders', COALESCE(
        NULLIF(f.forecast_orders, 0),
        -- Fallback: derive orders from forecast_sales / avg ticket
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
    -- Actual daily from pos_daily_finance
    SELECT
      pdf.date AS day,
      SUM(pdf.net_sales)     AS actual_sales,
      SUM(pdf.orders_count)  AS actual_orders,
      -- Avg ticket for the derivation fallback (across full range)
      CASE
        WHEN SUM(pdf.orders_count) > 0
        THEN SUM(pdf.net_sales) / SUM(pdf.orders_count)
        ELSE 0
      END AS avg_ticket_hist
    FROM pos_daily_finance pdf
    WHERE pdf.location_id = ANY(p_location_ids)
      AND pdf.data_source = v_ds_legacy
      AND pdf.date BETWEEN p_from AND p_to
    GROUP BY pdf.date
  ) a
  FULL OUTER JOIN (
    -- Forecast daily
    SELECT
      fd.date AS day,
      SUM(fd.forecast_sales)  AS forecast_sales,
      SUM(fd.forecast_orders) AS forecast_orders,
      -- Lower/upper aggregated from hourly forecast per day
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

  -- -------------------------------------------------------
  -- 4) KPIs: totals across the date range
  -- -------------------------------------------------------
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
    FROM pos_daily_finance pdf
    WHERE pdf.location_id = ANY(p_location_ids)
      AND pdf.data_source = v_ds_legacy
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

  -- -------------------------------------------------------
  -- 5) Busy hours: top 3 forecast hours per day
  -- -------------------------------------------------------
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

  -- -------------------------------------------------------
  -- 6) Assemble final JSON
  -- -------------------------------------------------------
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

-- Grant access
GRANT EXECUTE ON FUNCTION get_sales_timeseries_unified(uuid, uuid[], date, date)
  TO authenticated;

-- ============================================================
-- TEST QUERY (replace UUIDs with real values):
--
-- SELECT get_sales_timeseries_unified(
--   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,   -- org_id
--   ARRAY[
--     '11111111-2222-3333-4444-555555555555'::uuid    -- location_id(s)
--   ],
--   '2026-02-01'::date,                               -- from
--   '2026-02-12'::date                                -- to
-- );
--
-- Via REST API:
-- curl -X POST "https://<project>.supabase.co/rest/v1/rpc/get_sales_timeseries_unified" \
--   -H "apikey: <key>" -H "Authorization: Bearer <key>" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "p_org_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
--     "p_location_ids": ["11111111-2222-3333-4444-555555555555"],
--     "p_from": "2026-02-01",
--     "p_to": "2026-02-12"
--   }'
-- ============================================================
