-- ============================================================
-- Labour Data Pipeline Upgrade
-- 1) Rewrite RPCs to read from labour_daily + forecast_daily_metrics
-- 2) Backfill 90 days of coherent labour + forecast data
-- 3) Generate 30-day forward forecast
-- 4) Upgrade daily generator to roll forecast window
-- ============================================================

-- ============================================================
-- PART 1: Rewrite RPCs
-- ============================================================

-- 1.1  get_labour_kpis
CREATE OR REPLACE FUNCTION get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
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

-- 1.2  get_labour_timeseries
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

-- 1.3  get_labour_locations_table
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

-- ============================================================
-- PART 2: Backfill 90 days + 30-day forecast
-- ============================================================

DO $$
DECLARE
  v_loc record;
  v_day date;
  v_dow int;
  v_nm  numeric;
  v_hr  numeric;
  v_sb  numeric := 0;
  v_sr  numeric := 0;
  v_ob  integer := 0;
  v_ors integer := 0;
  v_lhb numeric := 0;
  v_lr  numeric := 0;
  v_ns  numeric;
  v_oc  integer;
  v_gs  numeric;
  v_pc  numeric;
  v_pk  numeric;
  v_po  numeric;
  v_ra  numeric;
  v_da  numeric;
  v_ca  numeric;
  v_va  numeric;
  v_lh  numeric;
  v_lc  numeric;
  v_cg  numeric;
  v_fs  numeric;
  v_fo  integer;
  v_plh numeric;
  v_plc numeric;
  v_is_future boolean;
BEGIN
  FOR v_loc IN
    SELECT id,
      CASE id
        WHEN '57f62bae-4d5b-44b0-8055-fdde12ee5a96' THEN 1.15
        WHEN '9c501324-66e4-40e8-bfcb-7cc855f3754e' THEN 1.00
        WHEN '9469ef7a-c1b1-4314-8349-d0ea253ba483' THEN 0.90
        WHEN 'fe0717f7-6fa7-4e5e-8467-6c9585b03022' THEN 0.85
        ELSE 1.0
      END AS lm
    FROM locations WHERE active = true
  LOOP
    FOR v_day IN SELECT generate_series(
      (CURRENT_DATE - 90)::date,
      (CURRENT_DATE + 30)::date,
      '1 day'::interval
    )::date LOOP

      v_is_future := (v_day > CURRENT_DATE);
      v_dow := EXTRACT(DOW FROM v_day)::int;

      IF v_dow = 0 THEN v_sb:=1100; v_sr:=400; v_ob:=55; v_ors:=25; v_lhb:=18; v_lr:=6;
      ELSIF v_dow = 1 THEN v_sb:=1200; v_sr:=300; v_ob:=60; v_ors:=20; v_lhb:=20; v_lr:=5;
      ELSIF v_dow = 2 THEN v_sb:=1350; v_sr:=350; v_ob:=68; v_ors:=22; v_lhb:=22; v_lr:=5;
      ELSIF v_dow = 3 THEN v_sb:=1450; v_sr:=350; v_ob:=72; v_ors:=22; v_lhb:=24; v_lr:=5;
      ELSIF v_dow = 4 THEN v_sb:=1650; v_sr:=400; v_ob:=82; v_ors:=25; v_lhb:=28; v_lr:=6;
      ELSIF v_dow = 5 THEN v_sb:=2400; v_sr:=600; v_ob:=120; v_ors:=35; v_lhb:=36; v_lr:=8;
      ELSIF v_dow = 6 THEN v_sb:=2800; v_sr:=700; v_ob:=140; v_ors:=40; v_lhb:=40; v_lr:=10;
      END IF;

      v_nm := 1.0 + (random() - 0.5) * 0.24;
      v_hr := 13.5 + random() * 3.0;

      v_ns := ROUND((v_sb + random() * v_sr) * v_loc.lm * v_nm, 2);
      v_oc := GREATEST(1, FLOOR((v_ob + random() * v_ors) * v_loc.lm * v_nm))::integer;
      v_gs := ROUND(v_ns * (1.03 + random() * 0.03), 2);
      v_pc := ROUND(v_ns * (0.20 + random() * 0.10), 2);
      v_pk := ROUND(v_ns * (0.62 + random() * 0.10), 2);
      v_po := ROUND(GREATEST(0, v_ns - v_pc - v_pk), 2);
      v_ra := ROUND(v_ns * (0.002 + random() * 0.006), 2);
      v_da := ROUND(v_ns * (0.015 + random() * 0.020), 2);
      v_ca := ROUND(v_ns * (0.005 + random() * 0.010), 2);
      v_va := ROUND(v_ns * (0.004 + random() * 0.008), 2);

      v_lh := ROUND((v_lhb + random() * v_lr) * v_loc.lm * v_nm, 2);
      v_lc := ROUND(v_lh * v_hr, 2);
      v_cg := ROUND(v_ns * (0.26 + random() * 0.04), 2);

      v_fs := ROUND(v_ns * (0.88 + random() * 0.24), 2);
      v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random() * 0.20)))::integer;
      v_plh := ROUND(v_lh * (0.90 + random() * 0.20), 2);
      v_plc := ROUND(v_plh * v_hr, 2);

      IF NOT v_is_future THEN
        INSERT INTO pos_daily_finance (id, date, location_id, net_sales, gross_sales, orders_count,
          payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
          discounts_amount, comps_amount, voids_amount, created_at, data_source)
        VALUES (gen_random_uuid(), v_day, v_loc.id, v_ns, v_gs, v_oc,
          v_pc, v_pk, v_po, v_ra, FLOOR(random()*3)::integer,
          v_da, v_ca, v_va, NOW(), 'demo')
        ON CONFLICT (date, location_id, data_source) DO NOTHING;

        INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
        VALUES (gen_random_uuid(), v_day, v_loc.id, v_lc, v_lh, NOW())
        ON CONFLICT (date, location_id) DO UPDATE
          SET labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

        INSERT INTO cogs_daily (location_id, date, cogs_amount)
        VALUES (v_loc.id, v_day, v_cg)
        ON CONFLICT DO NOTHING;

        INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
        VALUES (gen_random_uuid(), v_day, v_loc.id,
          ROUND(v_sb * v_loc.lm * 1.05, 2),
          ROUND(v_sb * v_loc.lm * 0.22, 2),
          ROUND(v_sb * v_loc.lm * 0.28, 2), NOW())
        ON CONFLICT DO NOTHING;
      END IF;

      INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, created_at)
      VALUES (gen_random_uuid(), v_day, v_loc.id, v_fs, v_fo, v_plh, v_plc, NOW())
      ON CONFLICT DO NOTHING;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Backfilled 90 days + 30 day forecast for all active locations';
END;
$$;

-- ============================================================
-- PART 3: Upgrade daily generator
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_daily_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date date := CURRENT_DATE;
  v_forecast_date date := CURRENT_DATE + 30;
  v_loc record;
  v_nm numeric;
  v_ns numeric;
  v_gs numeric;
  v_oc integer;
  v_pc numeric;
  v_pk numeric;
  v_po numeric;
  v_ra numeric;
  v_da numeric;
  v_ca numeric;
  v_va numeric;
  v_lh numeric;
  v_lc numeric;
  v_cg numeric;
  v_fs numeric;
  v_fo integer;
  v_plh numeric;
  v_plc numeric;
  v_hr numeric;
  v_dow integer;
  v_sb numeric := 0;
  v_sr numeric := 0;
  v_ob integer := 0;
  v_ors integer := 0;
  v_lhb numeric := 0;
  v_lr numeric := 0;
  v_fdow integer;
  v_fsb numeric := 0;
  v_fsr numeric := 0;
  v_fob integer := 0;
  v_fors integer := 0;
  v_flhb numeric := 0;
  v_flr numeric := 0;
  v_fnm numeric;
  v_fhr numeric;
  v_fns numeric;
  v_foc integer;
  v_flh numeric;
  v_fplh numeric;
  v_fplc numeric;
BEGIN
  v_dow := EXTRACT(DOW FROM v_date)::int;

  IF v_dow = 0 THEN v_sb:=1100; v_sr:=400; v_ob:=55; v_ors:=25; v_lhb:=18; v_lr:=6;
  ELSIF v_dow = 1 THEN v_sb:=1200; v_sr:=300; v_ob:=60; v_ors:=20; v_lhb:=20; v_lr:=5;
  ELSIF v_dow = 2 THEN v_sb:=1350; v_sr:=350; v_ob:=68; v_ors:=22; v_lhb:=22; v_lr:=5;
  ELSIF v_dow = 3 THEN v_sb:=1450; v_sr:=350; v_ob:=72; v_ors:=22; v_lhb:=24; v_lr:=5;
  ELSIF v_dow = 4 THEN v_sb:=1650; v_sr:=400; v_ob:=82; v_ors:=25; v_lhb:=28; v_lr:=6;
  ELSIF v_dow = 5 THEN v_sb:=2400; v_sr:=600; v_ob:=120; v_ors:=35; v_lhb:=36; v_lr:=8;
  ELSIF v_dow = 6 THEN v_sb:=2800; v_sr:=700; v_ob:=140; v_ors:=40; v_lhb:=40; v_lr:=10;
  END IF;

  v_fdow := EXTRACT(DOW FROM v_forecast_date)::int;
  IF v_fdow = 0 THEN v_fsb:=1100; v_fsr:=400; v_fob:=55; v_fors:=25; v_flhb:=18; v_flr:=6;
  ELSIF v_fdow = 1 THEN v_fsb:=1200; v_fsr:=300; v_fob:=60; v_fors:=20; v_flhb:=20; v_flr:=5;
  ELSIF v_fdow = 2 THEN v_fsb:=1350; v_fsr:=350; v_fob:=68; v_fors:=22; v_flhb:=22; v_flr:=5;
  ELSIF v_fdow = 3 THEN v_fsb:=1450; v_fsr:=350; v_fob:=72; v_fors:=22; v_flhb:=24; v_flr:=5;
  ELSIF v_fdow = 4 THEN v_fsb:=1650; v_fsr:=400; v_fob:=82; v_fors:=25; v_flhb:=28; v_flr:=6;
  ELSIF v_fdow = 5 THEN v_fsb:=2400; v_fsr:=600; v_fob:=120; v_fors:=35; v_flhb:=36; v_flr:=8;
  ELSIF v_fdow = 6 THEN v_fsb:=2800; v_fsr:=700; v_fob:=140; v_fors:=40; v_flhb:=40; v_flr:=10;
  END IF;

  FOR v_loc IN
    SELECT id,
      CASE id
        WHEN '57f62bae-4d5b-44b0-8055-fdde12ee5a96' THEN 1.15
        WHEN '9c501324-66e4-40e8-bfcb-7cc855f3754e' THEN 1.00
        WHEN '9469ef7a-c1b1-4314-8349-d0ea253ba483' THEN 0.90
        WHEN 'fe0717f7-6fa7-4e5e-8467-6c9585b03022' THEN 0.85
        ELSE 1.0
      END AS lm
    FROM locations
    WHERE active = true
      AND id IN (
        '57f62bae-4d5b-44b0-8055-fdde12ee5a96',
        '9c501324-66e4-40e8-bfcb-7cc855f3754e',
        '9469ef7a-c1b1-4314-8349-d0ea253ba483',
        'fe0717f7-6fa7-4e5e-8467-6c9585b03022'
      )
  LOOP
    v_nm := 1.0 + (random() - 0.5) * 0.24;
    v_hr := 13.5 + random() * 3.0;

    v_ns := ROUND((v_sb + random() * v_sr) * v_loc.lm * v_nm, 2);
    v_oc := GREATEST(1, FLOOR((v_ob + random() * v_ors) * v_loc.lm * v_nm))::integer;
    v_gs := ROUND(v_ns * (1.03 + random() * 0.03), 2);
    v_pc := ROUND(v_ns * (0.20 + random() * 0.10), 2);
    v_pk := ROUND(v_ns * (0.62 + random() * 0.10), 2);
    v_po := ROUND(GREATEST(0, v_ns - v_pc - v_pk), 2);
    v_ra := ROUND(v_ns * (0.002 + random() * 0.006), 2);
    v_da := ROUND(v_ns * (0.015 + random() * 0.020), 2);
    v_ca := ROUND(v_ns * (0.005 + random() * 0.010), 2);
    v_va := ROUND(v_ns * (0.004 + random() * 0.008), 2);
    v_lh := ROUND((v_lhb + random() * v_lr) * v_loc.lm * v_nm, 2);
    v_lc := ROUND(v_lh * v_hr, 2);
    v_cg := ROUND(v_ns * (0.26 + random() * 0.04), 2);
    v_fs := ROUND(v_ns * (0.88 + random() * 0.24), 2);
    v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random() * 0.20)))::integer;
    v_plh := ROUND(v_lh * (0.90 + random() * 0.20), 2);
    v_plc := ROUND(v_plh * v_hr, 2);

    INSERT INTO pos_daily_finance (id, date, location_id, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount, created_at, data_source)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_ns, v_gs, v_oc,
      v_pc, v_pk, v_po, v_ra, FLOOR(random()*3)::integer,
      v_da, v_ca, v_va, NOW(), 'demo')
    ON CONFLICT (date, location_id, data_source) DO UPDATE
      SET net_sales=EXCLUDED.net_sales, gross_sales=EXCLUDED.gross_sales, orders_count=EXCLUDED.orders_count;

    INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_lc, v_lh, NOW())
    ON CONFLICT (date, location_id) DO UPDATE
      SET labour_cost=EXCLUDED.labour_cost, labour_hours=EXCLUDED.labour_hours;

    INSERT INTO cogs_daily (location_id, date, cogs_amount)
    VALUES (v_loc.id, v_date, v_cg)
    ON CONFLICT DO NOTHING;

    INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
      planned_labor_hours, planned_labor_cost, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_fs, v_fo, v_plh, v_plc, NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id,
      ROUND(v_sb * v_loc.lm * 1.05, 2),
      ROUND(v_sb * v_loc.lm * 0.22, 2),
      ROUND(v_sb * v_loc.lm * 0.28, 2), NOW())
    ON CONFLICT DO NOTHING;

    -- Forecast day +30
    v_fnm := 1.0 + (random() - 0.5) * 0.10;
    v_fhr := 14.0 + random() * 2.0;
    v_fns := ROUND((v_fsb + random() * v_fsr) * v_loc.lm * v_fnm, 2);
    v_foc := GREATEST(1, FLOOR((v_fob + random() * v_fors) * v_loc.lm * v_fnm))::integer;
    v_flh := ROUND((v_flhb + random() * v_flr) * v_loc.lm * v_fnm, 2);
    v_fplh := v_flh;
    v_fplc := ROUND(v_fplh * v_fhr, 2);

    INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
      planned_labor_hours, planned_labor_cost, created_at)
    VALUES (gen_random_uuid(), v_forecast_date, v_loc.id, v_fns, v_foc, v_fplh, v_fplc, NOW())
    ON CONFLICT DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Daily data generated for % + forecast for %', v_date, v_forecast_date;
END;
$$;
