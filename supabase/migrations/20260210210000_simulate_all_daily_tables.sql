-- ====================================================================
-- Update simulate_today_partial_data() to also populate:
--   labour_daily, cogs_daily, cash_counts_daily
-- Previously only pos_daily_finance + pos_daily_metrics were updated.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.simulate_today_partial_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location RECORD;
  v_progress numeric;
  v_forecast RECORD;
  v_net_sales numeric;
BEGIN
  -- Calculate what fraction of the business day has passed (10am-11pm = 13 hours)
  v_progress := GREATEST(0, LEAST(1,
    (EXTRACT(HOUR FROM NOW()) - 10.0) / 13.0
  ));

  -- If before opening (10am), set small initial values
  IF v_progress <= 0 THEN
    v_progress := 0.02;
  END IF;

  FOR v_location IN SELECT id, name FROM locations LOOP
    SELECT * INTO v_forecast
    FROM forecast_daily_metrics
    WHERE date = CURRENT_DATE AND location_id = v_location.id
    LIMIT 1;

    IF v_forecast IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate net_sales once so derived values (COGS, cash) stay consistent
    v_net_sales := ROUND((v_forecast.forecast_sales * v_progress * (0.92 + random() * 0.16))::numeric, 2);

    -- 1) pos_daily_finance
    INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount)
    VALUES (
      CURRENT_DATE, v_location.id,
      v_net_sales,
      ROUND((v_net_sales * 1.05)::numeric, 2),
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_net_sales * 0.25)::numeric, 2),
      ROUND((v_net_sales * 0.70)::numeric, 2),
      ROUND((v_net_sales * 0.05)::numeric, 2),
      ROUND((v_net_sales * 0.005)::numeric, 2),
      1,
      ROUND((v_net_sales * 0.03)::numeric, 2),
      ROUND((v_net_sales * 0.01)::numeric, 2),
      ROUND((v_net_sales * 0.008)::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      gross_sales = EXCLUDED.gross_sales,
      orders_count = EXCLUDED.orders_count,
      payments_cash = EXCLUDED.payments_cash,
      payments_card = EXCLUDED.payments_card,
      payments_other = EXCLUDED.payments_other,
      refunds_amount = EXCLUDED.refunds_amount,
      discounts_amount = EXCLUDED.discounts_amount,
      comps_amount = EXCLUDED.comps_amount,
      voids_amount = EXCLUDED.voids_amount;

    -- 2) pos_daily_metrics
    INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
    VALUES (
      CURRENT_DATE, v_location.id,
      v_net_sales,
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_forecast.planned_labor_hours * v_progress * (0.92 + random() * 0.12))::numeric, 1),
      ROUND((v_forecast.planned_labor_cost * v_progress * (0.92 + random() * 0.12))::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      orders = EXCLUDED.orders,
      labor_hours = EXCLUDED.labor_hours,
      labor_cost = EXCLUDED.labor_cost;

    -- 3) labour_daily
    INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_forecast.planned_labor_cost * v_progress * (0.92 + random() * 0.12))::numeric, 2),
      ROUND((v_forecast.planned_labor_hours * v_progress * (0.92 + random() * 0.12))::numeric, 1)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      labour_cost = EXCLUDED.labour_cost,
      labour_hours = EXCLUDED.labour_hours;

    -- 4) cogs_daily (COGS = 28% of net_sales, typical for casual dining)
    INSERT INTO cogs_daily (date, location_id, cogs_amount)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_net_sales * 0.28)::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      cogs_amount = EXCLUDED.cogs_amount;

    -- 5) cash_counts_daily (cash counted ≈ 25% of net_sales with small ±0.5% variance)
    INSERT INTO cash_counts_daily (date, location_id, cash_counted)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_net_sales * 0.25 * (0.995 + random() * 0.01))::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      cash_counted = EXCLUDED.cash_counted;

  END LOOP;
END;
$$;
