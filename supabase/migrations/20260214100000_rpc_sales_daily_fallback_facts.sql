-- ============================================================
-- Fix get_sales_timeseries_unified: daily + KPI fallback
--
-- Problem: pos_daily_finance has no rows for data_source='demo'
-- (demo data was only seeded into facts_sales_15m). This causes
-- the daily array and KPIs to be empty in demo mode.
--
-- Fix: When pos_daily_finance yields no rows for the resolved
-- data_source, fall back to aggregating daily totals from
-- v_facts_sales_15m_unified (which does have demo data).
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

  v_has_pdf_data boolean;
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

  -- 3) Check if pos_daily_finance has data for this data_source
  SELECT EXISTS (
    SELECT 1
    FROM v_pos_daily_finance_unified pdf
    WHERE pdf.location_id = ANY(p_location_ids)
      AND pdf.data_source_unified = v_ds
      AND pdf.date BETWEEN p_from AND p_to
    LIMIT 1
  ) INTO v_has_pdf_data;

  -- 4) Daily timeseries (actual + forecast)
  IF v_has_pdf_data THEN
    -- Primary path: use pos_daily_finance
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
  ELSE
    -- Fallback: aggregate facts_sales_15m into daily buckets
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
        (fs.ts_bucket AT TIME ZONE 'Europe/Madrid')::date AS day,
        SUM(fs.sales_net)  AS actual_sales,
        SUM(fs.tickets)    AS actual_orders,
        CASE
          WHEN SUM(fs.tickets) > 0
          THEN SUM(fs.sales_net) / SUM(fs.tickets)
          ELSE 0
        END AS avg_ticket_hist
      FROM v_facts_sales_15m_unified fs
      WHERE fs.location_id = ANY(p_location_ids)
        AND fs.data_source_unified = v_ds
        AND (fs.ts_bucket AT TIME ZONE 'Europe/Madrid')::date
            BETWEEN p_from AND p_to
      GROUP BY 1
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
  END IF;

  -- 5) KPIs: totals across the date range
  IF v_has_pdf_data THEN
    -- Primary: from pos_daily_finance
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
  ELSE
    -- Fallback: from facts_sales_15m
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
        SUM(fs.sales_net) AS total_sales,
        SUM(fs.tickets)   AS total_orders
      FROM v_facts_sales_15m_unified fs
      WHERE fs.location_id = ANY(p_location_ids)
        AND fs.data_source_unified = v_ds
        AND (fs.ts_bucket AT TIME ZONE 'Europe/Madrid')::date
            BETWEEN p_from AND p_to
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
  END IF;

  -- 6) Busy hours: top 3 forecast hours per day
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

  -- 7) Assemble final JSON
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
