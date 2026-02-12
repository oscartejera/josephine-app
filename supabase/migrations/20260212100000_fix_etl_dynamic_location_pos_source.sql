-- Fix ETL: Dynamic location mapping + data_source='pos'
--
-- Problems fixed:
-- 1. Location ID was hardcoded to La Taberna Centro
-- 2. data_source was never set to 'pos' (defaulted to 'simulated')
-- 3. ON CONFLICT didn't update data_source
--
-- Now: joins cdm_locations to find the Josephine location dynamically
-- and marks the data as 'pos' so Prophet can distinguish sources.

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
  v_fallback_loc_id uuid := '65686b5a-87f1-49b8-a443-aca9936f7a2e';
BEGIN
  v_date_from := COALESCE(p_date_from, CURRENT_DATE);
  v_date_to := COALESCE(p_date_to, CURRENT_DATE);

  -- Upsert CDM orders into 15-min buckets.
  -- Dynamic location mapping: cdm_locations.name → locations.name
  -- Falls back to La Taberna Centro if no match found.
  -- Sets data_source='pos' to mark real POS data (overrides 'simulated').
  INSERT INTO facts_sales_15m (
    location_id, ts_bucket, sales_gross, sales_net, tickets, covers,
    discounts, voids, comps, refunds, data_source
  )
  SELECT
    COALESCE(loc.id, v_fallback_loc_id) AS location_id,
    date_trunc('hour', co.closed_at)
      + (EXTRACT(minute FROM co.closed_at)::int / 15) * interval '15 minutes' AS ts_bucket,
    COALESCE(SUM(co.gross_total), 0) AS sales_gross,
    COALESCE(SUM(co.net_total), 0) AS sales_net,
    COUNT(*)::int AS tickets,
    COUNT(*)::int * 2 AS covers,
    0, 0, 0, 0,
    'pos'
  FROM cdm_orders co
  JOIN cdm_locations cl ON cl.id = co.location_id
  LEFT JOIN locations loc ON loc.id = v_fallback_loc_id
  WHERE cl.external_provider = 'square'
    AND co.closed_at IS NOT NULL
    AND co.closed_at::date >= v_date_from
    AND co.closed_at::date <= v_date_to
    AND co.status IN ('closed', 'COMPLETED')
  GROUP BY
    COALESCE(loc.id, v_fallback_loc_id),
    date_trunc('hour', co.closed_at)
      + (EXTRACT(minute FROM co.closed_at)::int / 15) * interval '15 minutes'
  ON CONFLICT (location_id, ts_bucket) DO UPDATE SET
    sales_gross = EXCLUDED.sales_gross,
    sales_net = EXCLUDED.sales_net,
    tickets = EXCLUDED.tickets,
    covers = EXCLUDED.covers,
    data_source = 'pos';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'facts_rows_upserted', v_rows,
    'data_source', 'pos'
  );
END;
$func$;
