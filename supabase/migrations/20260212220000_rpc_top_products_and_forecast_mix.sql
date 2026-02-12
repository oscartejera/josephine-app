-- ============================================================
-- A) get_top_products_unified
-- B) get_forecast_items_mix_unified
--
-- Both use resolve_data_source() for demo/pos routing.
-- Legacy mapping: product_sales_daily uses 'simulated'|'pos',
-- forecast_daily_metrics uses 'demo'|'pos'.
-- ============================================================


-- ============================================================
-- A) get_top_products_unified
-- ============================================================
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id       uuid,
  p_location_ids uuid[],
  p_from         date,
  p_to           date,
  p_limit        int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve    jsonb;
  v_ds         text;
  v_ds_legacy  text;
  v_items      jsonb;
  v_total_sales numeric;
BEGIN
  v_resolve   := resolve_data_source(p_org_id);
  v_ds        := v_resolve->>'data_source';
  v_ds_legacy := CASE WHEN v_ds = 'pos' THEN 'pos' ELSE 'simulated' END;

  -- Total sales for share calculation
  SELECT COALESCE(SUM(psd.net_sales), 0)
    INTO v_total_sales
    FROM product_sales_daily psd
   WHERE psd.location_id = ANY(p_location_ids)
     AND psd.data_source  = v_ds_legacy
     AND psd.date BETWEEN p_from AND p_to;

  -- Top products
  SELECT COALESCE(jsonb_agg(row_j ORDER BY row_j->>'sales' DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'product_id', p.id,
        'name',       p.name,
        'category',   COALESCE(p.category, 'Sin categoría'),
        'sales',      SUM(psd.net_sales),
        'qty',        SUM(psd.units_sold),
        'share',      CASE
                        WHEN v_total_sales > 0
                        THEN ROUND(SUM(psd.net_sales) / v_total_sales * 100, 2)
                        ELSE 0
                      END
      ) AS row_j
      FROM product_sales_daily psd
      JOIN products p ON p.id = psd.product_id
      WHERE psd.location_id = ANY(p_location_ids)
        AND psd.data_source  = v_ds_legacy
        AND psd.date BETWEEN p_from AND p_to
      GROUP BY p.id, p.name, p.category
      ORDER BY SUM(psd.net_sales) DESC
      LIMIT p_limit
    ) sub;

  RETURN jsonb_build_object(
    'data_source',   v_ds,
    'mode',          v_resolve->>'mode',
    'reason',        v_resolve->>'reason',
    'last_synced_at', v_resolve->>'last_synced_at',
    'total_sales',   v_total_sales,
    'items',         v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_products_unified(uuid, uuid[], date, date, int)
  TO authenticated;


-- ============================================================
-- B) get_forecast_items_mix_unified
--
-- Approach (all on-the-fly, no new tables):
--
-- 1) Compute historical mix_share per (product, day_of_week)
--    using the last 4-8 weeks of product_sales_daily.
--    mix_share(p, dow) = AVG( product_net_sales / day_total_sales )
--    Clamped to [0, 1].
--
-- 2) If a product has < 3 data points for a DOW, fall back to
--    its global mix_share (across all DOWs).
--
-- 3) For each future day in [today .. today + p_horizon_days]:
--    forecast_item_sales = forecast_daily_sales * mix_share(p, dow)
--    forecast_item_qty   = forecast_item_sales / avg_unit_price_hist
--    where avg_unit_price_hist = SUM(net_sales) / NULLIF(SUM(units_sold), 0)
--    If qty=0 or price not computable, forecast_item_qty = null.
--
-- 4) Return top products by cumulative forecast_item_sales.
-- ============================================================
CREATE OR REPLACE FUNCTION get_forecast_items_mix_unified(
  p_org_id        uuid,
  p_location_ids  uuid[],
  p_from          date,
  p_to            date,
  p_horizon_days  int DEFAULT 14,
  p_limit         int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve      jsonb;
  v_ds           text;
  v_ds_legacy    text;
  v_hist_from    date;
  v_hist_to      date;
  v_horizon_from date;
  v_horizon_to   date;
  v_items        jsonb;
  v_daily_detail jsonb;
BEGIN
  v_resolve   := resolve_data_source(p_org_id);
  v_ds        := v_resolve->>'data_source';
  v_ds_legacy := CASE WHEN v_ds = 'pos' THEN 'pos' ELSE 'simulated' END;

  -- Historical window: last 8 weeks from p_from
  v_hist_to   := p_from - 1;
  v_hist_from := v_hist_to - 55;  -- ~8 weeks

  -- Forecast horizon
  v_horizon_from := CURRENT_DATE;
  v_horizon_to   := CURRENT_DATE + p_horizon_days - 1;

  -- -------------------------------------------------------
  -- Main query: CTE pipeline
  -- -------------------------------------------------------
  WITH
  -- 1) Daily totals for the historical window
  day_totals AS (
    SELECT
      psd.date,
      EXTRACT(ISODOW FROM psd.date)::int AS dow,
      SUM(psd.net_sales) AS total_sales
    FROM product_sales_daily psd
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source  = v_ds_legacy
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.date
    HAVING SUM(psd.net_sales) > 0
  ),

  -- 2) Per-product per-day share
  product_day AS (
    SELECT
      psd.product_id,
      psd.date,
      dt.dow,
      SUM(psd.net_sales) AS product_sales,
      dt.total_sales,
      LEAST(GREATEST(SUM(psd.net_sales) / dt.total_sales, 0), 1) AS day_share
    FROM product_sales_daily psd
    JOIN day_totals dt ON dt.date = psd.date
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source  = v_ds_legacy
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.product_id, psd.date, dt.dow, dt.total_sales
  ),

  -- 3) Mix share by (product, dow) — with sample count
  mix_by_dow AS (
    SELECT
      product_id,
      dow,
      AVG(day_share) AS mix_share,
      COUNT(*)       AS sample_count
    FROM product_day
    GROUP BY product_id, dow
  ),

  -- 4) Global mix share (fallback for sparse DOWs)
  mix_global AS (
    SELECT
      product_id,
      AVG(day_share) AS mix_share_global
    FROM product_day
    GROUP BY product_id
  ),

  -- 5) Resolved mix: use DOW-specific if >= 3 samples, else global
  mix_resolved AS (
    SELECT
      COALESCE(md.product_id, mg.product_id) AS product_id,
      COALESCE(md.dow, gen.dow)              AS dow,
      CASE
        WHEN md.sample_count >= 3 THEN md.mix_share
        ELSE COALESCE(mg.mix_share_global, 0)
      END AS mix_share
    FROM mix_global mg
    CROSS JOIN generate_series(1, 7) AS gen(dow)
    LEFT JOIN mix_by_dow md
      ON md.product_id = mg.product_id AND md.dow = gen.dow
  ),

  -- 6) Historical avg unit price per product
  avg_prices AS (
    SELECT
      psd.product_id,
      CASE
        WHEN SUM(psd.units_sold) > 0
        THEN SUM(psd.net_sales) / SUM(psd.units_sold)
        ELSE NULL
      END AS avg_unit_price
    FROM product_sales_daily psd
    WHERE psd.location_id = ANY(p_location_ids)
      AND psd.data_source  = v_ds_legacy
      AND psd.date BETWEEN v_hist_from AND v_hist_to
    GROUP BY psd.product_id
  ),

  -- 7) Forecast daily sales (from forecast_daily_metrics)
  forecast_days AS (
    SELECT
      fd.date AS forecast_date,
      EXTRACT(ISODOW FROM fd.date)::int AS dow,
      SUM(fd.forecast_sales) AS forecast_sales
    FROM forecast_daily_metrics fd
    WHERE fd.location_id = ANY(p_location_ids)
      AND fd.data_source  = v_ds
      AND fd.date BETWEEN v_horizon_from AND v_horizon_to
    GROUP BY fd.date
  ),

  -- 8) Explode: forecast per product per day
  forecast_items AS (
    SELECT
      mr.product_id,
      fdy.forecast_date,
      fdy.forecast_sales * mr.mix_share       AS forecast_item_sales,
      CASE
        WHEN ap.avg_unit_price IS NOT NULL AND ap.avg_unit_price > 0
        THEN ROUND(fdy.forecast_sales * mr.mix_share / ap.avg_unit_price, 1)
        ELSE NULL
      END AS forecast_item_qty
    FROM forecast_days fdy
    JOIN mix_resolved mr ON mr.dow = fdy.dow
    LEFT JOIN avg_prices ap ON ap.product_id = mr.product_id
    WHERE mr.mix_share > 0
  ),

  -- 9) Aggregate per product across horizon
  product_totals AS (
    SELECT
      fi.product_id,
      SUM(fi.forecast_item_sales)  AS total_forecast_sales,
      SUM(fi.forecast_item_qty)    AS total_forecast_qty
    FROM forecast_items fi
    GROUP BY fi.product_id
    ORDER BY SUM(fi.forecast_item_sales) DESC
    LIMIT p_limit
  )

  -- Build the two result sets
  SELECT
    jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id',          pt.product_id,
            'name',                p.name,
            'category',            COALESCE(p.category, 'Sin categoría'),
            'total_forecast_sales', ROUND(pt.total_forecast_sales, 2),
            'total_forecast_qty',   pt.total_forecast_qty,
            'avg_unit_price',       ROUND(COALESCE(ap.avg_unit_price, 0), 2),
            'daily', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'date',           fi2.forecast_date,
                  'forecast_sales', ROUND(fi2.forecast_item_sales, 2),
                  'forecast_qty',   fi2.forecast_item_qty
                ) ORDER BY fi2.forecast_date
              )
              FROM forecast_items fi2
              WHERE fi2.product_id = pt.product_id
            ), '[]'::jsonb)
          ) ORDER BY pt.total_forecast_sales DESC
        )
        FROM product_totals pt
        JOIN products p ON p.id = pt.product_id
        LEFT JOIN avg_prices ap ON ap.product_id = pt.product_id
      ), '[]'::jsonb)
    )
  INTO v_items;

  RETURN jsonb_build_object(
    'data_source',    v_ds,
    'mode',           v_resolve->>'mode',
    'reason',         v_resolve->>'reason',
    'last_synced_at', v_resolve->>'last_synced_at',
    'hist_window',    jsonb_build_object('from', v_hist_from, 'to', v_hist_to),
    'horizon',        jsonb_build_object('from', v_horizon_from, 'to', v_horizon_to),
    'items',          v_items->'items'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_forecast_items_mix_unified(uuid, uuid[], date, date, int, int)
  TO authenticated;


-- ============================================================
-- TEST QUERIES (replace UUIDs with real values):
--
-- A) Top products:
-- SELECT get_top_products_unified(
--   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
--   ARRAY['11111111-2222-3333-4444-555555555555'::uuid],
--   '2026-02-01'::date,
--   '2026-02-12'::date,
--   10
-- );
--
-- B) Forecast item mix:
-- SELECT get_forecast_items_mix_unified(
--   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
--   ARRAY['11111111-2222-3333-4444-555555555555'::uuid],
--   '2026-02-01'::date,
--   '2026-02-12'::date,
--   14,
--   20
-- );
--
-- Via REST API:
-- curl -X POST "https://<project>.supabase.co/rest/v1/rpc/get_top_products_unified" \
--   -H "apikey: <key>" -H "Authorization: Bearer <key>" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "p_org_id": "aaaaaaaa-...",
--     "p_location_ids": ["11111111-..."],
--     "p_from": "2026-02-01",
--     "p_to": "2026-02-12",
--     "p_limit": 10
--   }'
--
-- curl -X POST "https://<project>.supabase.co/rest/v1/rpc/get_forecast_items_mix_unified" \
--   -H "apikey: <key>" -H "Authorization: Bearer <key>" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "p_org_id": "aaaaaaaa-...",
--     "p_location_ids": ["11111111-..."],
--     "p_from": "2026-02-01",
--     "p_to": "2026-02-12",
--     "p_horizon_days": 14,
--     "p_limit": 20
--   }'
-- ============================================================
