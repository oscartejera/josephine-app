-- ============================================================
-- RPC: get_labor_plan_unified
--
-- Single source of truth for workforce planning.
-- Uses resolve_data_source() → forecast_hourly_metrics → planned hours.
--
-- Formula:
--   planned_hours_total = forecast_sales / splh_goal
--   Split: prep (09-12) = 100% BOH; service (12-23) = 60% FOH / 40% BOH
--   Cost: hours * hourly_rate_{foh|boh}
--
-- Returns: metadata + hourly[] + daily[] + flags
-- ============================================================

CREATE OR REPLACE FUNCTION get_labor_plan_unified(
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
  v_resolve        jsonb;
  v_ds             text;
  v_mode           text;
  v_reason         text;
  v_last_synced    timestamptz;

  v_splh_goal      numeric;
  v_hourly_rate_foh numeric;
  v_hourly_rate_boh numeric;
  v_target_col_pct numeric;
  v_estimated_rates boolean := false;

  v_hourly         jsonb;
  v_daily          jsonb;
  v_flags          jsonb;

  v_total_days     int;
  v_sufficiency    text;
BEGIN
  -- 1) Resolve data source
  v_resolve     := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;

  -- 2) Get location_settings (aggregate across locations, use first match)
  SELECT
    COALESCE(ls.splh_goal, 50),
    COALESCE(ls.target_col_percent, 25),
    COALESCE(ls.default_hourly_cost, 15)
  INTO v_splh_goal, v_target_col_pct, v_hourly_rate_foh
  FROM location_settings ls
  WHERE ls.location_id = ANY(p_location_ids)
  LIMIT 1;

  -- Defaults if no location_settings found
  IF v_splh_goal IS NULL THEN
    v_splh_goal := 50;
    v_target_col_pct := 25;
    v_hourly_rate_foh := 15;
    v_estimated_rates := true;
  END IF;

  -- BOH rate ~20% higher than FOH (kitchen roles)
  v_hourly_rate_boh := ROUND(v_hourly_rate_foh * 1.2, 2);

  -- Check if we're using defaults vs real rates
  IF v_hourly_rate_foh = 15 THEN
    v_estimated_rates := true;
  END IF;

  -- 3) Data quality: count forecast days available
  SELECT COUNT(DISTINCT fh.forecast_date)
  INTO v_total_days
  FROM forecast_hourly_metrics fh
  WHERE fh.location_id = ANY(p_location_ids)
    AND fh.data_source = v_ds
    AND fh.forecast_date BETWEEN p_from AND p_to;

  v_sufficiency := CASE
    WHEN v_total_days >= 14 THEN 'HIGH'
    WHEN v_total_days >= 7  THEN 'MID'
    ELSE 'LOW'
  END;

  -- 4) Hourly detail: forecast → planned hours → FOH/BOH split → cost
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ts_hour',              h.ts_hour,
      'forecast_sales',       ROUND(h.forecast_sales, 2),
      'planned_hours_total',  ROUND(h.planned_hours_total, 2),
      'planned_hours_foh',    ROUND(h.planned_hours_foh, 2),
      'planned_hours_boh',    ROUND(h.planned_hours_boh, 2),
      'planned_cost',         ROUND(h.planned_cost, 2)
    ) ORDER BY h.ts_hour
  ), '[]'::jsonb)
  INTO v_hourly
  FROM (
    SELECT
      (fh.forecast_date + (fh.hour_of_day || ' hours')::interval) AS ts_hour,
      SUM(fh.forecast_sales) AS forecast_sales,
      -- Total hours = sales / SPLH goal
      CASE WHEN v_splh_goal > 0
        THEN SUM(fh.forecast_sales) / v_splh_goal
        ELSE 0
      END AS planned_hours_total,
      -- FOH/BOH split based on hour:
      --   prep (09-11): 100% BOH
      --   service (12-23): 60% FOH / 40% BOH
      CASE
        WHEN fh.hour_of_day < 12 THEN 0  -- prep = all BOH
        ELSE CASE WHEN v_splh_goal > 0
          THEN SUM(fh.forecast_sales) / v_splh_goal * 0.6
          ELSE 0 END
      END AS planned_hours_foh,
      CASE
        WHEN fh.hour_of_day < 12
          THEN CASE WHEN v_splh_goal > 0
            THEN SUM(fh.forecast_sales) / v_splh_goal
            ELSE 0 END  -- prep = all BOH
        ELSE CASE WHEN v_splh_goal > 0
          THEN SUM(fh.forecast_sales) / v_splh_goal * 0.4
          ELSE 0 END
      END AS planned_hours_boh,
      -- Cost = FOH hours * FOH rate + BOH hours * BOH rate
      CASE
        WHEN fh.hour_of_day < 12
          THEN CASE WHEN v_splh_goal > 0
            THEN SUM(fh.forecast_sales) / v_splh_goal * v_hourly_rate_boh
            ELSE 0 END
        ELSE CASE WHEN v_splh_goal > 0
          THEN SUM(fh.forecast_sales) / v_splh_goal * (0.6 * v_hourly_rate_foh + 0.4 * v_hourly_rate_boh)
          ELSE 0 END
      END AS planned_cost
    FROM forecast_hourly_metrics fh
    WHERE fh.location_id = ANY(p_location_ids)
      AND fh.data_source = v_ds
      AND fh.forecast_date BETWEEN p_from AND p_to
    GROUP BY fh.forecast_date, fh.hour_of_day
  ) h;

  -- 5) Daily aggregation with KPIs
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',                  d.day,
      'forecast_sales',        ROUND(d.forecast_sales, 2),
      'planned_hours_total',   ROUND(d.planned_hours_total, 2),
      'planned_hours_foh',     ROUND(d.planned_hours_foh, 2),
      'planned_hours_boh',     ROUND(d.planned_hours_boh, 2),
      'planned_cost',          ROUND(d.planned_cost, 2),
      'splh',                  CASE WHEN d.planned_hours_total > 0
                                 THEN ROUND(d.forecast_sales / d.planned_hours_total, 2)
                                 ELSE 0 END,
      'col_pct',               CASE WHEN d.forecast_sales > 0
                                 THEN ROUND(d.planned_cost / d.forecast_sales * 100, 2)
                                 ELSE 0 END,
      'understaff_risk',       d.planned_hours_total > 0
                                 AND d.forecast_sales / NULLIF(d.planned_hours_total, 0) > v_splh_goal * 1.15
    ) ORDER BY d.day
  ), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      fh.forecast_date AS day,
      SUM(fh.forecast_sales) AS forecast_sales,
      CASE WHEN v_splh_goal > 0
        THEN SUM(fh.forecast_sales) / v_splh_goal
        ELSE 0 END AS planned_hours_total,
      -- FOH: only service hours (12+)
      CASE WHEN v_splh_goal > 0
        THEN SUM(CASE WHEN fh.hour_of_day >= 12
               THEN fh.forecast_sales ELSE 0 END) / v_splh_goal * 0.6
        ELSE 0 END AS planned_hours_foh,
      -- BOH: prep hours (all) + service hours (40%)
      CASE WHEN v_splh_goal > 0
        THEN SUM(CASE WHEN fh.hour_of_day < 12
               THEN fh.forecast_sales ELSE 0 END) / v_splh_goal
             + SUM(CASE WHEN fh.hour_of_day >= 12
               THEN fh.forecast_sales ELSE 0 END) / v_splh_goal * 0.4
        ELSE 0 END AS planned_hours_boh,
      -- Cost
      CASE WHEN v_splh_goal > 0
        THEN SUM(CASE WHEN fh.hour_of_day < 12
               THEN fh.forecast_sales ELSE 0 END) / v_splh_goal * v_hourly_rate_boh
             + SUM(CASE WHEN fh.hour_of_day >= 12
               THEN fh.forecast_sales ELSE 0 END) / v_splh_goal
                 * (0.6 * v_hourly_rate_foh + 0.4 * v_hourly_rate_boh)
        ELSE 0 END AS planned_cost
    FROM forecast_hourly_metrics fh
    WHERE fh.location_id = ANY(p_location_ids)
      AND fh.data_source = v_ds
      AND fh.forecast_date BETWEEN p_from AND p_to
    GROUP BY fh.forecast_date
  ) d;

  -- 6) Flags
  v_flags := jsonb_build_object(
    'estimated_rates', v_estimated_rates,
    'data_quality', jsonb_build_object(
      'total_days', v_total_days,
      'data_sufficiency_level', v_sufficiency
    )
  );

  -- 7) Return
  RETURN jsonb_build_object(
    'metadata', jsonb_build_object(
      'data_source',   v_ds,
      'mode',          v_mode,
      'reason',        v_reason,
      'last_synced_at', v_last_synced,
      'splh_goal',     v_splh_goal,
      'target_col_pct', v_target_col_pct,
      'hourly_rate_foh', v_hourly_rate_foh,
      'hourly_rate_boh', v_hourly_rate_boh
    ),
    'hourly', v_hourly,
    'daily',  v_daily,
    'flags',  v_flags
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_labor_plan_unified(uuid, uuid[], date, date)
  TO authenticated;
