-- ============================================================
-- Hotfix: menu_items uses 'category' NOT 'category_name'
-- The category_name column is on inventory_items, NOT menu_items.
-- ============================================================

-- Fix menu_engineering_summary — revert to mi.category
CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')        AS product_name,
        COALESCE(mi.category, ci.category, 'Other')  AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint               AS units_sold,
        COALESCE(SUM(ol.gross),0)                      AS net_sales,
        0::numeric                                      AS cogs,
        COALESCE(SUM(ol.gross),0)                      AS gross_profit,
        100::numeric                                    AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name, pd.product_category,
        pd.units_sold, pd.net_sales, pd.cogs, pd.gross_profit, pd.margin_pct,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct <  COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM product_data pd, stats s
      ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;


-- Fix get_top_products_unified — revert to mi.category
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds jsonb;
  v_total numeric;
  v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(SUM(net_sales),0) INTO v_total
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000')::text AS product_id,
      COALESCE(mi.name, ci.name, 'Unknown')        AS name,
      COALESCE(mi.category, ci.category, 'Other')  AS category,
      SUM(COALESCE(ol.gross,0))::numeric AS sales,
      SUM(COALESCE(ol.qty,0))::numeric         AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(ol.gross,0))/v_total ELSE 0 END AS share
    FROM cdm_orders o
    JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN cdm_items ci ON ci.id = ol.item_id
    LEFT JOIN menu_items mi ON mi.id = ol.item_id
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY 1,2,3
    ORDER BY sales DESC
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'total_sales',v_total,'items',v_items
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
