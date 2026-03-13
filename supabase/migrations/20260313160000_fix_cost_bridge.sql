-- Fix food cost bridge: join by NAME not ID
--
-- Root cause: cdm_order_lines.item_id → cdm_items (demo data)
-- but recipe_ingredients.menu_item_id → menu_items (different table/IDs)
-- These UUID spaces don't overlap, so the direct ID join yields zero matches.
--
-- Fix: bridge via LOWER(TRIM(name)) matching between products and recipe costs.

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from    date,
  p_date_to      date,
  p_location_id  uuid    DEFAULT NULL,
  p_data_source  text    DEFAULT 'demo',
  p_category     text    DEFAULT NULL,
  p_vat_rate     numeric DEFAULT 0.10
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH
    -- Pre-compute food costs per menu_item NAME (single pass)
    food_costs_by_name AS (
      SELECT
        LOWER(TRIM(mi.name)) AS item_name_key,
        ROUND(SUM(COALESCE(ri.qty_gross, 0) * COALESCE(ii.last_cost, 0)), 2) AS food_cost
      FROM recipe_ingredients ri
      JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      JOIN menu_items mi ON mi.id = ri.menu_item_id
      WHERE ii.last_cost > 0
      GROUP BY LOWER(TRIM(mi.name))
    ),

    -- Aggregate order data per product
    raw_sales AS (
      SELECT
        COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')       AS name,
        COALESCE(mi.category, ci.category, 'Other')  AS category,
        COALESCE(SUM(ol.qty), 0)::bigint              AS units_sold,
        COALESCE(SUM(ol.gross), 0)                    AS gross_sales
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1, 2, 3
    ),

    -- Enrich with food cost via NAME bridge (not ID)
    enriched AS (
      SELECT
        rs.product_id,
        rs.name,
        rs.category,
        rs.units_sold,
        rs.gross_sales,
        CASE WHEN rs.units_sold > 0
          THEN ROUND(rs.gross_sales / rs.units_sold / (1 + p_vat_rate), 2)
          ELSE 0
        END AS selling_price_ex_vat,
        COALESCE(fc.food_cost, 0) AS unit_food_cost_raw,
        CASE
          WHEN fc.food_cost IS NOT NULL AND fc.food_cost > 0 THEN 'recipe_actual'
          ELSE 'unknown'
        END AS cost_source_raw
      FROM raw_sales rs
      LEFT JOIN food_costs_by_name fc ON fc.item_name_key = LOWER(TRIM(rs.name))
    ),

    -- Category-level fallback cost
    category_avg_cost AS (
      SELECT
        category,
        CASE WHEN COUNT(*) FILTER (WHERE cost_source_raw = 'recipe_actual') > 0
          THEN SUM(unit_food_cost_raw) FILTER (WHERE cost_source_raw = 'recipe_actual')
               / COUNT(*) FILTER (WHERE cost_source_raw = 'recipe_actual')
          ELSE 0
        END AS avg_food_cost
      FROM enriched
      GROUP BY category
    ),

    -- Final cost with fallback chain
    costed AS (
      SELECT
        e.product_id, e.name, e.category,
        e.units_sold, e.gross_sales, e.selling_price_ex_vat,
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN e.unit_food_cost_raw
          WHEN ca.avg_food_cost > 0 THEN ROUND(ca.avg_food_cost, 2)
          ELSE 0
        END AS unit_food_cost,
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN 'recipe_actual'
          WHEN ca.avg_food_cost > 0 THEN 'fallback_average'
          ELSE 'unknown'
        END AS cost_source,
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN 'high'
          WHEN ca.avg_food_cost > 0 THEN 'medium'
          ELSE 'low'
        END AS data_confidence
      FROM enriched e
      LEFT JOIN category_avg_cost ca ON ca.category = e.category
    ),

    -- Filter category + exclude unknowns
    category_filtered AS (
      SELECT * FROM costed
      WHERE (p_category IS NULL OR category = p_category)
        AND name <> 'Unknown'
    ),

    -- Derived metrics
    with_metrics AS (
      SELECT
        cf.*,
        ROUND(cf.selling_price_ex_vat - cf.unit_food_cost, 2) AS unit_gross_profit,
        ROUND((cf.selling_price_ex_vat - cf.unit_food_cost) * cf.units_sold, 2) AS total_gross_profit,
        CASE WHEN cf.selling_price_ex_vat > 0
          THEN ROUND((cf.unit_food_cost / cf.selling_price_ex_vat) * 100, 1)
          ELSE 0
        END AS food_cost_pct
      FROM category_filtered cf
    ),

    -- Category totals
    category_totals AS (
      SELECT
        COALESCE(SUM(units_sold), 0) AS total_units,
        COALESCE(SUM(gross_sales), 0) AS total_sales,
        COUNT(*) AS item_count,
        CASE WHEN COUNT(*) > 0
          THEN ROUND((100.0 / COUNT(*)) * 0.70, 2)
          ELSE 0
        END AS ideal_average_popularity,
        CASE WHEN SUM(units_sold) > 0
          THEN ROUND(SUM(total_gross_profit) / SUM(units_sold), 2)
          ELSE 0
        END AS average_gross_profit
      FROM with_metrics
    ),

    -- Classify
    classified AS (
      SELECT
        m.product_id, m.name, m.category, m.units_sold,
        m.gross_sales AS sales,
        ROUND(m.gross_sales / (1 + p_vat_rate), 2) AS sales_ex_vat,
        m.selling_price_ex_vat, m.unit_food_cost,
        m.food_cost_pct,
        m.unit_gross_profit, m.total_gross_profit,
        CASE WHEN ct.total_units > 0
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2) ELSE 0
        END AS popularity_pct,
        ct.ideal_average_popularity,
        ct.average_gross_profit,
        m.unit_food_cost AS cogs,
        CASE WHEN m.selling_price_ex_vat > 0
          THEN ROUND(((m.selling_price_ex_vat - m.unit_food_cost) / m.selling_price_ex_vat) * 100, 1) ELSE 0
        END AS margin_pct,
        m.unit_gross_profit AS profit_per_sale,
        m.total_gross_profit AS profit_eur,
        CASE WHEN ct.total_units > 0
              AND (m.units_sold::numeric / ct.total_units * 100) >= ct.ideal_average_popularity
          THEN 'high' ELSE 'low'
        END AS popularity_class,
        CASE WHEN m.unit_gross_profit >= ct.average_gross_profit
          THEN 'high' ELSE 'low'
        END AS profitability_class,

        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'star'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit THEN 'plow_horse'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'puzzle'
          ELSE 'dog'
        END AS classification,

        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'Maintain'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit THEN 'Review cost'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'Promote'
          ELSE 'Evaluate'
        END AS action_tag,

        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'Pop ' || ROUND(m.units_sold::numeric / ct.total_units * 100, 1) || '% ≥ ' || ct.ideal_average_popularity || '% · GP €' || m.unit_gross_profit || ' ≥ €' || ct.average_gross_profit
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit
            THEN 'Pop ' || ROUND(m.units_sold::numeric / ct.total_units * 100, 1) || '% ≥ ' || ct.ideal_average_popularity || '% · GP €' || m.unit_gross_profit || ' < €' || ct.average_gross_profit
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'Pop ' || ROUND(m.units_sold::numeric / ct.total_units * 100, 1) || '% < ' || ct.ideal_average_popularity || '% · GP €' || m.unit_gross_profit || ' ≥ €' || ct.average_gross_profit
          ELSE 'Pop ' || ROUND(m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100, 1) || '% < ' || ct.ideal_average_popularity || '% · GP €' || m.unit_gross_profit || ' < €' || ct.average_gross_profit
        END AS classification_reason,

        m.cost_source, m.data_confidence,

        CASE WHEN ct.total_units > 0
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2) ELSE 0
        END AS popularity_share,
        CASE WHEN ct.total_sales > 0
          THEN ROUND((m.gross_sales / ct.total_sales) * 100, 2) ELSE 0
        END AS sales_share,
        CASE WHEN p_category IS NOT NULL THEN true ELSE false END AS is_canonical,
        ARRAY[]::text[] AS badges,
        ct.item_count, ct.total_units, ct.total_sales
      FROM with_metrics m, category_totals ct
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (SELECT * FROM classified ORDER BY total_gross_profit DESC) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text, text, numeric) TO anon, authenticated;


-- Also fix pricing_omnes_summary to use same name-bridge for consistency
CREATE OR REPLACE FUNCTION pricing_omnes_summary(
  p_date_from    date,
  p_date_to      date,
  p_location_id  uuid    DEFAULT NULL,
  p_data_source  text    DEFAULT 'demo',
  p_category     text    DEFAULT NULL,
  p_vat_rate     numeric DEFAULT 0.10
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH
    raw_sales AS (
      SELECT
        COALESCE(mi.name, ci.name, 'Unknown')       AS name,
        COALESCE(mi.category, ci.category, 'Other')  AS category,
        COALESCE(SUM(ol.qty), 0)::bigint              AS units_sold,
        COALESCE(SUM(ol.gross), 0)                    AS gross_sales
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1, 2
    ),

    with_price AS (
      SELECT
        rs.name, rs.category, rs.units_sold, rs.gross_sales,
        CASE WHEN rs.units_sold > 0
          THEN ROUND(rs.gross_sales / rs.units_sold / (1 + p_vat_rate), 2) ELSE 0
        END AS listed_price,
        ROUND(rs.gross_sales / (1 + p_vat_rate), 2) AS item_revenue
      FROM raw_sales rs
      WHERE (p_category IS NULL OR rs.category = p_category)
        AND rs.name <> 'Unknown'
    ),

    cat_agg AS (
      SELECT
        category, COUNT(*) AS item_count,
        MAX(listed_price) AS max_price,
        MIN(CASE WHEN listed_price > 0 THEN listed_price ELSE NULL END) AS min_price,
        SUM(units_sold) AS total_units_sold,
        SUM(item_revenue) AS total_revenue,
        AVG(listed_price) AS avg_menu_price
      FROM with_price GROUP BY category
    ),

    omnes AS (
      SELECT
        ca.category, ca.item_count,
        COALESCE(ca.max_price, 0) AS max_price,
        COALESCE(ca.min_price, 0) AS min_price,
        CASE WHEN ca.min_price > 0 THEN ROUND(ca.max_price / ca.min_price, 2) ELSE 0 END AS price_range_ratio,
        CASE
          WHEN ca.min_price IS NULL OR ca.min_price = 0 THEN 'too_narrow'
          WHEN ROUND(ca.max_price / ca.min_price, 2) < 2.5 THEN 'too_narrow'
          WHEN ROUND(ca.max_price / ca.min_price, 2) <= 3.0 THEN 'healthy'
          ELSE 'too_wide'
        END AS price_range_state,
        COALESCE(ca.max_price - ca.min_price, 0) AS range_length,
        CASE WHEN ca.max_price > ca.min_price THEN ROUND((ca.max_price - ca.min_price) / 3.0, 2) ELSE 0 END AS band_width,
        CASE WHEN ca.total_units_sold > 0 THEN ROUND(ca.total_revenue / ca.total_units_sold, 2) ELSE 0 END AS average_check_per_plate,
        ROUND(COALESCE(ca.avg_menu_price, 0), 2) AS average_menu_price,
        CASE WHEN ca.avg_menu_price > 0 AND ca.total_units_sold > 0
          THEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2) ELSE 0
        END AS category_ratio,
        CASE
          WHEN ca.avg_menu_price = 0 OR ca.total_units_sold = 0 THEN 'healthy'
          WHEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2) < 0.90 THEN 'too_expensive'
          WHEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2) <= 1.00 THEN 'healthy'
          ELSE 'underpriced'
        END AS pricing_health_state,
        ca.total_units_sold, ca.total_revenue
      FROM cat_agg ca
    ),

    item_bands AS (
      SELECT
        wp.name, wp.category, wp.listed_price, wp.units_sold, wp.item_revenue,
        om.band_width, om.min_price,
        CASE
          WHEN wp.listed_price <= om.min_price + om.band_width THEN 'lower'
          WHEN wp.listed_price <= om.min_price + 2 * om.band_width THEN 'middle'
          ELSE 'upper'
        END AS band,
        CASE
          WHEN wp.listed_price > om.min_price + om.band_width
               AND wp.listed_price <= om.min_price + 2 * om.band_width THEN true ELSE false
        END AS is_promotion_candidate
      FROM with_price wp JOIN omnes om ON om.category = wp.category
    ),

    band_counts AS (
      SELECT
        category,
        COUNT(*) FILTER (WHERE band = 'lower') AS lower_band_count,
        COUNT(*) FILTER (WHERE band = 'middle') AS middle_band_count,
        COUNT(*) FILTER (WHERE band = 'upper') AS upper_band_count,
        COUNT(*) AS total_items
      FROM item_bands GROUP BY category
    ),

    final AS (
      SELECT
        om.*,
        ROUND(om.min_price + om.band_width, 2) AS lower_band_max,
        ROUND(om.min_price + 2 * om.band_width, 2) AS middle_band_max,
        COALESCE(bc.lower_band_count, 0) AS lower_band_count,
        COALESCE(bc.middle_band_count, 0) AS middle_band_count,
        COALESCE(bc.upper_band_count, 0) AS upper_band_count,
        CASE WHEN bc.total_items > 0 THEN ROUND((bc.lower_band_count::numeric / bc.total_items) * 100, 1) ELSE 0 END AS lower_band_pct,
        CASE WHEN bc.total_items > 0 THEN ROUND((bc.middle_band_count::numeric / bc.total_items) * 100, 1) ELSE 0 END AS middle_band_pct,
        CASE WHEN bc.total_items > 0 THEN ROUND((bc.upper_band_count::numeric / bc.total_items) * 100, 1) ELSE 0 END AS upper_band_pct,
        CASE
          WHEN bc.total_items > 0 AND ROUND((bc.middle_band_count::numeric / bc.total_items) * 100, 1) < 35 THEN 'weak_middle'
          WHEN bc.total_items > 0 AND ROUND((bc.lower_band_count::numeric / bc.total_items) * 100, 1) > 40 THEN 'too_many_lower'
          WHEN bc.total_items > 0 AND ROUND((bc.upper_band_count::numeric / bc.total_items) * 100, 1) > 40 THEN 'too_many_upper'
          ELSE 'balanced'
        END AS band_distribution_state,
        CASE WHEN COALESCE(bc.middle_band_count, 0) > 0 THEN 'middle' ELSE 'none' END AS promotion_zone,
        (SELECT COALESCE(jsonb_agg(row_to_json(ib)::jsonb ORDER BY ib.listed_price), '[]'::jsonb)
         FROM item_bands ib WHERE ib.category = om.category) AS items
      FROM omnes om
      LEFT JOIN band_counts bc ON bc.category = om.category
    )
    SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb) FROM final f
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pricing_omnes_summary(date, date, uuid, text, text, numeric) TO anon, authenticated;
