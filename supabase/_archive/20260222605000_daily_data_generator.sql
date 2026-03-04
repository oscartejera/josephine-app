-- ============================================================
-- Daily data auto-generator
-- Generates realistic data for all locations each day at midnight
-- Also generates a 7-day forecast rolling window
-- ============================================================

-- Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Daily generator function ────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_daily_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date date := CURRENT_DATE;
  v_loc record;
  v_profile record;
  v_lm numeric;
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
  v_sb numeric;
  v_sr numeric;
  v_ob integer;
  v_or integer;
  v_lhb numeric;
  v_lr numeric;
  v_nm numeric;
BEGIN
  v_dow := EXTRACT(DOW FROM v_date)::int;

  -- Day-of-week profile
  CASE v_dow
    WHEN 0 THEN v_sb:=1100; v_sr:=400; v_ob:=55; v_or:=25; v_lhb:=18; v_lr:=6;
    WHEN 1 THEN v_sb:=1200; v_sr:=300; v_ob:=60; v_or:=20; v_lhb:=20; v_lr:=5;
    WHEN 2 THEN v_sb:=1350; v_sr:=350; v_ob:=68; v_or:=22; v_lhb:=22; v_lr:=5;
    WHEN 3 THEN v_sb:=1450; v_sr:=350; v_ob:=72; v_or:=22; v_lhb:=24; v_lr:=5;
    WHEN 4 THEN v_sb:=1650; v_sr:=400; v_ob:=82; v_or:=25; v_lhb:=28; v_lr:=6;
    WHEN 5 THEN v_sb:=2400; v_sr:=600; v_ob:=120; v_or:=35; v_lhb:=36; v_lr:=8;
    WHEN 6 THEN v_sb:=2800; v_sr:=700; v_ob:=140; v_or:=40; v_lhb:=40; v_lr:=10;
  END CASE;

  -- Loop each active location
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
    -- Random noise ±12%
    v_nm := 1.0 + (random() - 0.5) * 0.24;
    v_hr := 13.5 + random() * 3.0;

    -- Sales
    v_ns := ROUND((v_sb + random() * v_sr) * v_loc.lm * v_nm, 2);
    v_oc := GREATEST(1, FLOOR((v_ob + random() * v_or) * v_loc.lm * v_nm));
    v_gs := ROUND(v_ns * (1.03 + random() * 0.03), 2);
    v_pc := ROUND(v_ns * (0.20 + random() * 0.10), 2);
    v_pk := ROUND(v_ns * (0.62 + random() * 0.10), 2);
    v_po := ROUND(GREATEST(0, v_ns - v_pc - v_pk), 2);
    v_ra := ROUND(v_ns * (0.002 + random() * 0.006), 2);
    v_da := ROUND(v_ns * (0.015 + random() * 0.020), 2);
    v_ca := ROUND(v_ns * (0.005 + random() * 0.010), 2);
    v_va := ROUND(v_ns * (0.004 + random() * 0.008), 2);

    -- Labour
    v_lh := ROUND((v_lhb + random() * v_lr) * v_loc.lm * v_nm, 2);
    v_lc := ROUND(v_lh * v_hr, 2);

    -- COGS
    v_cg := ROUND(v_ns * (0.26 + random() * 0.04), 2);

    -- Forecast (±5-12% from actual)
    v_fs := ROUND(v_ns * (0.88 + random() * 0.24), 2);
    v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random() * 0.20)));
    v_plh := ROUND(v_lh * (0.90 + random() * 0.20), 2);
    v_plc := ROUND(v_plh * v_hr, 2);

    -- INSERT pos_daily_finance
    INSERT INTO pos_daily_finance (id, date, location_id, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount, created_at, data_source)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_ns, v_gs, v_oc,
      v_pc, v_pk, v_po, v_ra, FLOOR(random()*3),
      v_da, v_ca, v_va, NOW(), 'demo')
    ON CONFLICT (date, location_id, data_source) DO UPDATE
      SET net_sales=EXCLUDED.net_sales, gross_sales=EXCLUDED.gross_sales, orders_count=EXCLUDED.orders_count;

    -- INSERT labour_daily
    INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_lc, v_lh, NOW())
    ON CONFLICT (date, location_id) DO UPDATE
      SET labour_cost=EXCLUDED.labour_cost, labour_hours=EXCLUDED.labour_hours;

    -- INSERT cogs_daily
    INSERT INTO cogs_daily (id, date, location_id, cogs_amount, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_cg, NOW())
    ON CONFLICT DO NOTHING;

    -- INSERT forecast_daily_metrics
    INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
      planned_labor_hours, planned_labor_cost, created_at, model_version, generated_at,
      mse, mape, confidence, data_source)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_fs, v_fo, v_plh, v_plc,
      NOW(), 'AVG_28D_v1', NOW(), 0, 0, 75, 'demo')
    ON CONFLICT DO NOTHING;

    -- INSERT budgets_daily
    INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id,
      ROUND(v_sb * v_loc.lm * 1.05, 2),
      ROUND(v_sb * v_loc.lm * 0.20, 2),
      ROUND(v_sb * v_loc.lm * 0.28, 2), NOW())
    ON CONFLICT DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Daily data generated for %', v_date;
END;
$$;

-- ─── Schedule: run daily at 00:05 UTC ────────────────────────
SELECT cron.schedule(
  'generate-daily-data',
  '5 0 * * *',           -- 00:05 UTC every day
  'SELECT generate_daily_data()'
);
