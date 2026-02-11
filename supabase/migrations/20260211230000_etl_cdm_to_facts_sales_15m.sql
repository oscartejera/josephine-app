-- ETL: CDM Orders → facts_sales_15m
--
-- Converts Square POS orders (stored in cdm_orders after square-sync)
-- into 15-minute aggregated buckets in facts_sales_15m, which is
-- the table Prophet reads for training data.
--
-- Called by the square-daily-simulator after each sync batch.
-- Maps Square POS location to "La Taberna Centro" (65686b5a).
--
-- Usage:
--   SELECT etl_cdm_to_facts_sales_15m();              -- today only
--   SELECT etl_cdm_to_facts_sales_15m('2026-02-01');  -- specific date range

CREATE OR REPLACE FUNCTION public.etl_cdm_to_facts_sales_15m(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_date_from date;
  v_date_to date;
  v_rows int := 0;
  v_josephine_loc_id uuid := '65686b5a-87f1-49b8-a443-aca9936f7a2e'; -- La Taberna Centro
BEGIN
  v_date_from := COALESCE(p_date_from, CURRENT_DATE);
  v_date_to := COALESCE(p_date_to, CURRENT_DATE);

  -- Aggregate CDM orders into 15-min buckets and upsert into facts_sales_15m
  INSERT INTO facts_sales_15m (
    location_id, ts_bucket, sales_gross, sales_net, tickets, covers,
    discounts, voids, comps, refunds
  )
  SELECT
    v_josephine_loc_id AS location_id,
    date_trunc('hour', co.closed_at)
      + (EXTRACT(minute FROM co.closed_at)::int / 15) * interval '15 minutes' AS ts_bucket,
    COALESCE(SUM(co.gross_total), 0) AS sales_gross,
    COALESCE(SUM(co.net_total), 0) AS sales_net,
    COUNT(*)::int AS tickets,
    COUNT(*)::int * 2 AS covers,
    0, 0, 0, 0
  FROM cdm_orders co
  JOIN cdm_locations cl ON cl.id = co.location_id
  WHERE cl.external_provider = 'square'
    AND co.closed_at IS NOT NULL
    AND co.closed_at::date >= v_date_from
    AND co.closed_at::date <= v_date_to
    AND co.status IN ('closed', 'COMPLETED')
  GROUP BY
    date_trunc('hour', co.closed_at)
      + (EXTRACT(minute FROM co.closed_at)::int / 15) * interval '15 minutes'
  ON CONFLICT (location_id, ts_bucket) DO UPDATE SET
    sales_gross = EXCLUDED.sales_gross,
    sales_net = EXCLUDED.sales_net,
    tickets = EXCLUDED.tickets,
    covers = EXCLUDED.covers;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'josephine_location_id', v_josephine_loc_id,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'facts_rows_upserted', v_rows
  );
END;
$func$;
