-- ============================================================
-- POS Daily Data Generator
-- Generates realistic restaurant data for POS-connected orgs
-- Mirrors generate_daily_data() but writes to CDM tables and
-- shared tables (labour, cogs, waste, reviews, cash, etc.)
-- Runs daily at 00:10 UTC via pg_cron
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_pos_daily_data(p_target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org  record;
  v_loc  record;
  v_date date := COALESCE(p_target_date, CURRENT_DATE);
  v_dow  int;
  v_base_sales  numeric;
  v_sales_range numeric;
  v_base_orders int;
  v_order_range int;
  v_base_hours  numeric;
  v_hour_range  numeric;
  v_noise       numeric;
  v_order_count int;
  v_labour_h    numeric;
  v_labour_c    numeric;
  v_cogs_amt    numeric;
  v_hourly_rate numeric;
  v_order_id    uuid;
  v_h           int;
  v_order_net   numeric;
  v_order_gross numeric;
  v_items_per   int;
  v_qty         int;
  v_line_gross  numeric;
  v_line_net    numeric;
  v_total_net   numeric;
  v_total_gross numeric;
  v_total_orders int;
  v_item_ids    uuid[];
  v_item_names  text[];
  v_item_count  int;
  v_idx         int;
  v_cash_amt    numeric;
  v_f_sales     numeric;
  v_f_orders    int;
  v_f_labour_h  numeric;
  v_waste_val   numeric;
  v_inv_item    record;
BEGIN
  v_dow := EXTRACT(DOW FROM v_date)::int;

  CASE v_dow
    WHEN 0 THEN v_base_sales:=1100; v_sales_range:=400; v_base_orders:=45; v_order_range:=20; v_base_hours:=16; v_hour_range:=4;
    WHEN 1 THEN v_base_sales:=1200; v_sales_range:=350; v_base_orders:=50; v_order_range:=18; v_base_hours:=18; v_hour_range:=4;
    WHEN 2 THEN v_base_sales:=1350; v_sales_range:=400; v_base_orders:=55; v_order_range:=20; v_base_hours:=20; v_hour_range:=4;
    WHEN 3 THEN v_base_sales:=1450; v_sales_range:=400; v_base_orders:=60; v_order_range:=22; v_base_hours:=22; v_hour_range:=5;
    WHEN 4 THEN v_base_sales:=1700; v_sales_range:=500; v_base_orders:=70; v_order_range:=25; v_base_hours:=26; v_hour_range:=5;
    WHEN 5 THEN v_base_sales:=2500; v_sales_range:=700; v_base_orders:=100; v_order_range:=35; v_base_hours:=34; v_hour_range:=8;
    WHEN 6 THEN v_base_sales:=2800; v_sales_range:=800; v_base_orders:=120; v_order_range:=40; v_base_hours:=38; v_hour_range:=8;
  END CASE;

  FOR v_org IN
    SELECT DISTINCT i.org_id, ia.id AS account_id
    FROM integrations i
    JOIN integration_accounts ia ON ia.integration_id = i.id
    WHERE i.provider = 'square' AND i.status = 'active' AND i.is_enabled = true
  LOOP
    SELECT array_agg(id), array_agg(name)
    INTO v_item_ids, v_item_names
    FROM cdm_items WHERE org_id = v_org.org_id AND is_active = true;

    v_item_count := COALESCE(array_length(v_item_ids, 1), 0);
    IF v_item_count = 0 THEN CONTINUE; END IF;

    FOR v_loc IN
      SELECT id, name FROM locations WHERE group_id = v_org.org_id AND active = true
    LOOP
      -- Skip if already seeded
      PERFORM 1 FROM cdm_orders
      WHERE org_id = v_org.org_id AND location_id = v_loc.id
        AND closed_at::date = v_date AND integration_account_id = v_org.account_id LIMIT 1;
      IF FOUND THEN CONTINUE; END IF;

      v_noise := (1.0 + (random() - 0.5) * 0.30)::numeric;
      v_hourly_rate := (12.5 + random() * 3.5)::numeric;
      v_order_count := GREATEST(10, floor((v_base_orders + random() * v_order_range) * v_noise)::int);
      v_total_net := 0; v_total_gross := 0; v_total_orders := 0;

      -- ═══ CDM Orders + Lines ═══
      FOR i IN 1..v_order_count LOOP
        v_order_id := gen_random_uuid();
        IF random() < 0.60 THEN v_h := 12 + floor(random()*4)::int;
        ELSIF random() < 0.875 THEN v_h := 19 + floor(random()*4)::int;
        ELSE v_h := 10 + floor(random()*2)::int;
        END IF;

        v_order_net := 0; v_order_gross := 0;
        v_items_per := 1 + floor(random()*4)::int;

        INSERT INTO cdm_orders (
          id, org_id, location_id, external_id, opened_at, closed_at,
          net_sales, tax, tips, discounts, comps, voids, refunds, payments_total, gross_sales,
          provider, integration_account_id
        ) VALUES (
          v_order_id, v_org.org_id, v_loc.id,
          'pg_' || v_date || '_' || v_loc.id || '_' || i,
          v_date + make_interval(hours => v_h, mins => floor(random()*55)::int),
          v_date + make_interval(hours => v_h, mins => floor(random()*55)::int + 5),
          0, 0, 0, 0, 0, 0, 0, 0, 0, 'square', v_org.account_id
        );

        FOR j IN 1..v_items_per LOOP
          v_idx := 1 + floor(random() * v_item_count)::int;
          v_qty := 1 + floor(random()*3)::int;
          v_line_gross := round(((6.0 + random()*22.0) * v_qty)::numeric, 2);
          v_line_net := round(v_line_gross * 0.90, 2);

          INSERT INTO cdm_order_lines (
            id, org_id, order_id, item_id, name, qty, gross, net, discount, tax,
            provider, integration_account_id
          ) VALUES (
            gen_random_uuid(), v_org.org_id, v_order_id, v_item_ids[v_idx], v_item_names[v_idx],
            v_qty, v_line_gross, v_line_net,
            CASE WHEN random() > 0.90 THEN round(v_line_gross * 0.10, 2) ELSE 0 END,
            round(v_line_gross * 0.10, 2), 'square', v_org.account_id
          );
          v_order_net := v_order_net + v_line_net;
          v_order_gross := v_order_gross + v_line_gross;
        END LOOP;

        UPDATE cdm_orders SET
          net_sales = v_order_net, gross_sales = v_order_gross,
          tax = round(v_order_net * 0.10, 2),
          tips = CASE WHEN random() > 0.75 THEN round(v_order_net * 0.05, 2) ELSE 0 END,
          discounts = CASE WHEN random() > 0.85 THEN round(v_order_net * 0.08, 2) ELSE 0 END,
          refunds = CASE WHEN random() > 0.97 THEN round(v_order_net * 0.15, 2) ELSE 0 END,
          payments_total = v_order_net + round(v_order_net * 0.10, 2)
        WHERE id = v_order_id;

        v_total_net := v_total_net + v_order_net;
        v_total_gross := v_total_gross + v_order_gross;
        v_total_orders := v_total_orders + 1;
      END LOOP;

      -- ═══ Labour ═══
      v_labour_h := round(((v_base_hours + random() * v_hour_range) * v_noise)::numeric, 2);
      v_labour_c := round(v_labour_h * v_hourly_rate, 2);
      DELETE FROM labour_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id, v_labour_c, v_labour_h, NOW());

      -- Note: cogs_daily is a VIEW (auto-computed), no insert needed

      -- ═══ Cash ═══
      v_cash_amt := round(v_total_net * (0.18 + random() * 0.12)::numeric, 2);
      DELETE FROM cash_counts_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO cash_counts_daily (id, date, location_id, cash_counted, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id, v_cash_amt, NOW());

      -- ═══ Forecast ═══
      v_f_sales := round((v_total_net * (0.90 + random() * 0.20))::numeric, 2);
      v_f_orders := GREATEST(1, floor(v_total_orders * (0.88 + random() * 0.24))::int);
      v_f_labour_h := round((v_labour_h * (0.92 + random() * 0.16))::numeric, 2);
      DELETE FROM forecast_daily_metrics WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO forecast_daily_metrics (
        id, date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, created_at
      ) VALUES (
        gen_random_uuid(), v_date, v_loc.id, v_f_sales, v_f_orders,
        v_f_labour_h, round(v_f_labour_h * v_hourly_rate, 2), NOW()
      );

      -- ═══ Budgets ═══
      DELETE FROM budgets_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id,
        round(v_base_sales * 1.05, 2), round(v_base_sales * 0.22, 2), round(v_base_sales * 0.28, 2), NOW());

      -- ═══ Waste events (2-5/day) ═══
      FOR w IN 1..(2 + floor(random()*4)::int) LOOP
        FOR v_inv_item IN SELECT id, last_cost FROM inventory_items WHERE group_id=v_org.org_id ORDER BY random() LIMIT 1 LOOP
          v_waste_val := round((v_inv_item.last_cost * (0.5 + random()*2.0))::numeric, 2);
          INSERT INTO waste_events (id, location_id, inventory_item_id, quantity, reason, waste_value, created_at)
          VALUES (gen_random_uuid(), v_loc.id, v_inv_item.id,
            round((0.2 + random()*2.0)::numeric, 2),
            (ARRAY['Caducado','Dañado','Sobreproducción','Error preparación','Merma natural'])[1+floor(random()*5)::int],
            v_waste_val, NOW());
        END LOOP;
      END LOOP;

      -- ═══ Reviews (1-3/day) ═══
      FOR r IN 1..(1 + floor(random()*3)::int) LOOP
        INSERT INTO reviews (id, org_id, location_id, platform, rating, review_text, sentiment, reviewer_name, review_date, created_at)
        VALUES (gen_random_uuid(), v_org.org_id, v_loc.id,
          (ARRAY['google','tripadvisor','yelp','thefork'])[1+floor(random()*4)::int],
          (3.0 + round((random()*2.0)::numeric, 1)),
          (ARRAY['Excelente comida y servicio, volveremos seguro.','Muy buena relación calidad-precio.','Ambiente acogedor y personal atento.','La carne estaba en su punto.','Buen restaurante pero un poco ruidoso.','Comida correcta, nada especial pero cumple.','El servicio fue un poco lento pero la comida compensó.','Volveremos. Los postres caseros son espectaculares.','Menú del día muy completo por buen precio.','Buenas tapas y buen ambiente.'])[1+floor(random()*10)::int],
          CASE WHEN random()>0.3 THEN 'positive' WHEN random()>0.5 THEN 'neutral' ELSE 'negative' END,
          (ARRAY['María G.','Carlos R.','Ana L.','Pedro M.','Laura S.','José A.','Marta V.','Pablo D.'])[1+floor(random()*8)::int],
          v_date, NOW());
      END LOOP;

      -- ═══ Stock movements (3-6/day) ═══
      FOR s IN 1..(3 + floor(random()*4)::int) LOOP
        FOR v_inv_item IN SELECT id, last_cost FROM inventory_items WHERE group_id=v_org.org_id ORDER BY random() LIMIT 1 LOOP
          INSERT INTO stock_movements (id, org_id, location_id, item_id, movement_type, qty_delta, unit_cost, reason, source_ref, created_at)
          VALUES (gen_random_uuid(), v_org.org_id, v_loc.id, v_inv_item.id,
            (ARRAY['purchase','waste','sale_estimate','adjustment'])[1+floor(random()*4)::int]::stock_movement_type,
            round((1+random()*10)::numeric, 2),
            round((v_inv_item.last_cost)::numeric, 2),
            'Auto POS data', 'pos_gen',
            v_date + make_interval(hours => 10+floor(random()*12)::int));
        END LOOP;
      END LOOP;

    END LOOP; -- locations
  END LOOP; -- orgs
END;
$$;

-- ─── Schedule: run daily at 00:10 UTC ────────────────────────
SELECT cron.schedule(
  'generate-pos-daily-data',
  '10 0 * * *',
  'SELECT generate_pos_daily_data()'
);

-- ─── Backfill: last 30 days ─────────────────────────────────
DO $$
DECLARE d date;
BEGIN
  FOR d IN SELECT generate_series(
    (CURRENT_DATE - INTERVAL '30 days')::date, CURRENT_DATE, '1 day')::date
  LOOP
    PERFORM generate_pos_daily_data(d);
  END LOOP;
END $$;
