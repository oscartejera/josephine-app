-- ============================================================
-- PR3: Contract patch — normalize 'simulated' -> 'demo'
-- Safety: NO DROP, NO CASCADE, NO MV rebuilds / refresh
-- Strategy:
--   - Replace hardcoded literals in plain views
--   - Override data_source in wrapper views (explicit columns, no SELECT *)
--   - Update DEFAULT parameters in labour + menu_engineering RPCs
-- ============================================================

-- ------------------------------------------------------------
-- 1) sales_daily_unified: only change literal data_source
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
  'demo'::text                                                  AS data_source
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
-- 2) forecast_daily_unified: only change literal data_source
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
  'demo'::text                                                             AS data_source
FROM forecast_points fp
JOIN latest_runs lr ON lr.id = fp.forecast_run_id
LEFT JOIN avg_checks ac ON ac.org_id = fp.org_id AND ac.location_id = fp.location_id;

GRANT SELECT ON forecast_daily_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) sales_hourly_unified wrapper: explicit columns + override data_source
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW sales_hourly_unified AS
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
  'demo'::text AS data_source
FROM sales_hourly_unified_mv mv;

GRANT SELECT ON sales_hourly_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 4) product_sales_daily_unified wrapper: explicit columns + override data_source
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW product_sales_daily_unified AS
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
  'demo'::text AS data_source
FROM product_sales_daily_unified_mv mv;

GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;

-- ============================================================
-- 5) Labour RPCs: change DEFAULT 'simulated' -> DEFAULT 'demo'
-- Bodies unchanged
-- ============================================================

CREATE OR REPLACE FUNCTION get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_actual_sales   numeric;
  v_actual_hours   numeric;
  v_actual_cost    numeric;
  v_forecast_sales numeric;
  v_forecast_orders numeric;
  v_planned_hours  numeric;
  v_planned_cost   numeric;
  v_actual_orders  numeric;
BEGIN
  SELECT COALESCE(SUM(net_sales), 0), COALESCE(SUM(orders_count), 0)
  INTO v_actual_sales, v_actual_orders
  FROM sales_daily_unified
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(labour_hours), 0), COALESCE(SUM(labour_cost), 0)
  INTO v_actual_hours, v_actual_cost
  FROM labour_daily
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT COALESCE(SUM(forecast_sales), 0),
         COALESCE(SUM(forecast_orders), 0),
         COALESCE(SUM(planned_labor_hours), 0),
         COALESCE(SUM(planned_labor_cost), 0)
  INTO v_forecast_sales, v_forecast_orders, v_planned_hours, v_planned_cost
  FROM forecast_daily_metrics
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  RETURN jsonb_build_object(
    'actual_sales',        v_actual_sales,
    'actual_labor_cost',   v_actual_cost,
    'actual_labor_hours',  v_actual_hours,
    'actual_orders',       v_actual_orders,
    'forecast_sales',      v_forecast_sales,
    'planned_labor_cost',  v_planned_cost,
    'planned_labor_hours', v_planned_hours,
    'forecast_orders',     v_forecast_orders,
    'actual_col_pct',  CASE WHEN v_actual_sales > 0 THEN ROUND(v_actual_cost / v_actual_sales * 100, 2) ELSE 0 END,
    'actual_splh',     CASE WHEN v_actual_hours > 0 THEN ROUND(v_actual_sales / v_actual_hours, 2) ELSE 0 END,
    'actual_oplh',     CASE WHEN v_actual_hours > 0 THEN ROUND(v_actual_orders / v_actual_hours, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND(v_planned_cost / v_forecast_sales * 100, 2) ELSE 0 END,
    'planned_splh',    CASE WHEN v_planned_hours > 0 THEN ROUND(v_forecast_sales / v_planned_hours, 2) ELSE 0 END,
    'planned_oplh',    CASE WHEN v_planned_hours > 0 THEN ROUND(v_forecast_orders / v_planned_hours, 2) ELSE 0 END,
    'sales_delta_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND((v_actual_sales - v_forecast_sales) / v_forecast_sales * 100, 1) ELSE 0 END,
    'col_delta_pct',   CASE WHEN v_forecast_sales > 0 AND v_actual_sales > 0
      THEN ROUND((v_actual_cost / v_actual_sales * 100) - (v_planned_cost / v_forecast_sales * 100), 1) ELSE 0 END,
    'hours_delta_pct', CASE WHEN v_planned_hours > 0 THEN ROUND((v_actual_hours - v_planned_hours) / v_planned_hours * 100, 1) ELSE 0 END,
    'splh_delta_pct',  CASE WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_sales > 0
      THEN ROUND(((v_actual_sales / v_actual_hours) - (v_forecast_sales / v_planned_hours)) / (v_forecast_sales / v_planned_hours) * 100, 1) ELSE 0 END,
    'oplh_delta_pct',  CASE WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_orders > 0
      THEN ROUND(((v_actual_orders / v_actual_hours) - (v_forecast_orders / v_planned_hours)) / (v_forecast_orders / v_planned_hours) * 100, 1) ELSE 0 END,
    'total_actual_hours',    v_actual_hours,
    'total_actual_cost',     v_actual_cost,
    'total_scheduled_hours', v_planned_hours,
    'total_scheduled_cost',  v_planned_cost,
    'avg_headcount', 0,
    'total_sales',   v_actual_sales,
    'splh',          CASE WHEN v_actual_hours > 0 THEN ROUND(v_actual_sales / v_actual_hours, 2) ELSE 0 END,
    'col_pct',       CASE WHEN v_actual_sales > 0 THEN ROUND(v_actual_cost / v_actual_sales * 100, 2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_labour_kpis(date, date, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_labour_timeseries(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day), '[]'::jsonb)
    FROM (
      SELECT
        ld.date AS day,
        COALESCE(SUM(ld.labour_hours), 0) AS actual_hours,
        COALESCE(SUM(ld.labour_cost), 0)  AS actual_cost,
        COALESCE(SUM(fm.planned_labor_hours), 0) AS planned_hours,
        COALESCE(SUM(fm.planned_labor_cost), 0)  AS planned_cost,
        COALESCE(SUM(fm.planned_labor_hours), 0) AS scheduled_hours,
        COALESCE(SUM(fm.planned_labor_cost), 0)  AS scheduled_cost,
        0 AS scheduled_headcount,
        (COALESCE(SUM(ld.labour_hours), 0) - COALESCE(SUM(fm.planned_labor_hours), 0)) AS hours_variance,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0
          THEN ROUND(((COALESCE(SUM(ld.labour_hours), 0) - SUM(fm.planned_labor_hours)) / SUM(fm.planned_labor_hours) * 100)::numeric, 1)
          ELSE 0 END AS hours_variance_pct,
        COALESCE(SUM(s.net_sales), 0) AS sales,
        COALESCE(SUM(s.orders_count), 0) AS orders,
        COALESCE(SUM(fm.forecast_sales), 0) AS forecast_sales,
        COALESCE(SUM(fm.forecast_orders), 0) AS forecast_orders,
        CASE WHEN COALESCE(SUM(ld.labour_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(s.net_sales), 0) / SUM(ld.labour_hours))::numeric, 2) ELSE 0 END AS actual_splh,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.forecast_sales), 0) / SUM(fm.planned_labor_hours))::numeric, 2) ELSE 0 END AS planned_splh,
        CASE WHEN COALESCE(SUM(s.net_sales), 0) > 0
          THEN ROUND((COALESCE(SUM(ld.labour_cost), 0) / SUM(s.net_sales) * 100)::numeric, 2) ELSE 0 END AS actual_col_pct,
        CASE WHEN COALESCE(SUM(fm.forecast_sales), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.planned_labor_cost), 0) / SUM(fm.forecast_sales) * 100)::numeric, 2) ELSE 0 END AS planned_col_pct,
        CASE WHEN COALESCE(SUM(ld.labour_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(s.orders_count), 0)::numeric / SUM(ld.labour_hours))::numeric, 2) ELSE 0 END AS actual_oplh,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.forecast_orders), 0)::numeric / SUM(fm.planned_labor_hours))::numeric, 2) ELSE 0 END AS planned_oplh,
        COALESCE(SUM(s.net_sales), 0) AS actual_sales,
        COALESCE(SUM(ld.labour_cost), 0) AS actual_labor_cost,
        COALESCE(SUM(fm.planned_labor_cost), 0) AS planned_labor_cost,
        COALESCE(SUM(s.orders_count), 0) AS actual_orders
      FROM labour_daily ld
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales, SUM(orders_count) AS orders_count
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ld.date AND s.location_id = ld.location_id
      LEFT JOIN forecast_daily_metrics fm ON fm.date = ld.date AND fm.location_id = ld.location_id
      WHERE ld.date BETWEEN date_from AND date_to
        AND (selected_location_id IS NULL OR ld.location_id = selected_location_id)
      GROUP BY ld.date
    ) d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_labour_timeseries(date, date, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_labour_locations_table(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        l.id AS location_id,
        l.name AS location_name,
        COALESCE(SUM(s.net_sales), 0) AS sales_actual,
        COALESCE(SUM(fm.forecast_sales), 0) AS sales_projected,
        CASE WHEN COALESCE(SUM(fm.forecast_sales), 0) > 0
          THEN ROUND(((COALESCE(SUM(s.net_sales), 0) - SUM(fm.forecast_sales)) / SUM(fm.forecast_sales) * 100)::numeric, 1) ELSE 0 END AS sales_delta_pct,
        CASE WHEN COALESCE(SUM(s.net_sales), 0) > 0
          THEN ROUND((COALESCE(SUM(ld.labour_cost), 0) / SUM(s.net_sales) * 100)::numeric, 1) ELSE 0 END AS col_actual_pct,
        CASE WHEN COALESCE(SUM(fm.forecast_sales), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.planned_labor_cost), 0) / SUM(fm.forecast_sales) * 100)::numeric, 1) ELSE 0 END AS col_projected_pct,
        CASE WHEN COALESCE(SUM(fm.forecast_sales), 0) > 0 AND COALESCE(SUM(s.net_sales), 0) > 0
          THEN ROUND(((COALESCE(SUM(ld.labour_cost), 0) / SUM(s.net_sales) * 100) - (COALESCE(SUM(fm.planned_labor_cost), 0) / SUM(fm.forecast_sales) * 100))::numeric, 1) ELSE 0 END AS col_delta_pct,
        CASE WHEN COALESCE(SUM(ld.labour_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(s.net_sales), 0) / SUM(ld.labour_hours))::numeric, 2) ELSE 0 END AS splh_actual,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.forecast_sales), 0) / SUM(fm.planned_labor_hours))::numeric, 2) ELSE 0 END AS splh_projected,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0 AND COALESCE(SUM(ld.labour_hours), 0) > 0
          THEN ROUND(((COALESCE(SUM(s.net_sales), 0) / SUM(ld.labour_hours)) - (COALESCE(SUM(fm.forecast_sales), 0) / SUM(fm.planned_labor_hours))) / (COALESCE(SUM(fm.forecast_sales), 0) / SUM(fm.planned_labor_hours)) * 100, 1)::numeric ELSE 0 END AS splh_delta_pct,
        CASE WHEN COALESCE(SUM(ld.labour_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(s.orders_count), 0)::numeric / SUM(ld.labour_hours))::numeric, 2) ELSE 0 END AS oplh_actual,
        CASE WHEN COALESCE(SUM(fm.planned_labor_hours), 0) > 0
          THEN ROUND((COALESCE(SUM(fm.forecast_orders), 0)::numeric / SUM(fm.planned_labor_hours))::numeric, 2) ELSE 0 END AS oplh_projected,
        0::numeric AS oplh_delta_pct,
        COALESCE(SUM(ld.labour_cost), 0)  AS labor_cost_actual,
        COALESCE(SUM(fm.planned_labor_cost), 0) AS labor_cost_projected,
        COALESCE(SUM(ld.labour_hours), 0) AS hours_actual,
        COALESCE(SUM(fm.planned_labor_hours), 0) AS hours_projected,
        false AS is_summary
      FROM locations l
      LEFT JOIN labour_daily ld
        ON ld.location_id = l.id AND ld.date BETWEEN date_from AND date_to
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales, SUM(orders_count) AS orders_count
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ld.date AND s.location_id = l.id
      LEFT JOIN forecast_daily_metrics fm
        ON fm.date = ld.date AND fm.location_id = l.id
      WHERE (selected_location_id IS NULL OR l.id = selected_location_id)
        AND l.active = true
      GROUP BY l.id, l.name
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_labour_locations_table(date, date, uuid, text) TO anon, authenticated;

-- ============================================================
-- 6) menu_engineering_summary: DEFAULT 'simulated' -> DEFAULT 'demo'
-- Body unchanged
-- ============================================================
CREATE OR REPLACE FUNCTION public.menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(ci.name, 'Unknown') AS product_name,
        COALESCE(ci.category, 'Other') AS product_category,
        COALESCE(SUM(ol.qty), 0)::bigint AS units_sold,
        COALESCE(SUM(ol.gross), 0)::numeric AS net_sales,
        ROUND(
          COALESCE(SUM(ol.gross), 0) *
          CASE COALESCE(ci.category, 'Other')
            WHEN 'Bebidas' THEN 0.25
            WHEN 'Postres' THEN 0.28
            WHEN 'Entrantes' THEN 0.30
            WHEN 'Pastas' THEN 0.30
            WHEN 'Carnes' THEN 0.35
            WHEN 'Pescados' THEN 0.38
            ELSE 0.32
          END, 2
        )::numeric AS cogs
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1, 2, 3
    ),
    enriched AS (
      SELECT
        product_id,
        product_name,
        product_category,
        units_sold,
        net_sales,
        cogs,
        (net_sales - cogs) AS gross_profit,
        CASE WHEN net_sales > 0 THEN ROUND(((net_sales - cogs) / net_sales) * 100, 1) ELSE 0 END AS margin_pct,
        CASE WHEN units_sold > 0 THEN ROUND((net_sales - cogs) / units_sold, 2) ELSE 0 END AS cm_per_unit,
        CASE WHEN SUM(units_sold) OVER () > 0
          THEN ROUND((units_sold::numeric / SUM(units_sold) OVER ()) * 100, 2)
          ELSE 0 END AS popularity_share,
        CASE WHEN SUM(net_sales) OVER () > 0
          THEN ROUND((net_sales / SUM(net_sales) OVER ()) * 100, 2)
          ELSE 0 END AS sales_share
      FROM product_data
      WHERE units_sold > 0
    ),
    thresholds AS (
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN (1.0 / COUNT(*)::numeric) * 0.7 * 100
          ELSE 0 END AS pop_threshold,
        CASE WHEN SUM(units_sold) > 0
          THEN SUM(cm_per_unit * units_sold) / SUM(units_sold)
          ELSE 0 END AS cm_threshold
      FROM enriched
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        e.product_id,
        e.product_name AS name,
        e.product_category AS category,
        e.units_sold AS units,
        e.net_sales AS sales,
        e.cogs,
        e.gross_profit AS profit_eur,
        e.margin_pct,
        e.cm_per_unit AS profit_per_sale,
        e.popularity_share,
        e.sales_share,
        CASE
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'star'
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit < t.cm_threshold THEN 'plow_horse'
          WHEN e.popularity_share < t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'puzzle'
          ELSE 'dog'
        END AS classification,
        CASE
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'Mantener'
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit < t.cm_threshold THEN 'Subir precio'
          WHEN e.popularity_share < t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'Promocionar'
          ELSE 'Revisar'
        END AS action_tag,
        ARRAY[]::text[] AS badges
      FROM enriched e, thresholds t
      ORDER BY e.net_sales DESC
    ) r
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.menu_engineering_summary(date, date, uuid, text) TO anon, authenticated;

-- Optional but recommended so PostgREST sees updated defaults/views quickly
NOTIFY pgrst, 'reload schema';
