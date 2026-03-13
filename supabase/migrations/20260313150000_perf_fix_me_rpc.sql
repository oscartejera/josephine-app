-- Performance fix for Menu Engineering & OMNES RPCs
--
-- Problem: LATERAL JOIN calling get_recipe_food_cost() per row = N+1 query pattern
-- Solution: Inline food cost calculation with a single JOIN, no function calls
--
-- Also:
-- - Add indexes on hot join columns
-- - Translate Spanish action_tag labels to English

-- ═══════════════════════════════════════════
-- Step 1: Add missing indexes for performance
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cdm_orders_closed_at ON cdm_orders (closed_at);
CREATE INDEX IF NOT EXISTS idx_cdm_orders_location_id ON cdm_orders (location_id);
CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_order_id ON cdm_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_item_id ON cdm_order_lines (item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_menu_item_id ON recipe_ingredients (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item_id ON recipe_ingredients (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_name_lower ON menu_items (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_recipes_name_lower ON recipes (LOWER(menu_item_name));

-- ═══════════════════════════════════════════
-- Step 2: Rebuild menu_engineering_summary WITHOUT the LATERAL JOIN
-- ═══════════════════════════════════════════
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
    -- Pre-compute food costs per menu_item in ONE pass (not per-row)
    food_costs AS (
      SELECT
        ri.menu_item_id,
        ROUND(SUM(COALESCE(ri.qty_gross, 0) * COALESCE(ii.last_cost, 0)), 2) AS food_cost
      FROM recipe_ingredients ri
      JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      GROUP BY ri.menu_item_id
    ),

    -- Bridge recipes → menu_items for name-based matching
    recipe_costs AS (
      SELECT
        mi.id AS menu_item_id,
        fc.food_cost
      FROM recipes r
      JOIN menu_items mi ON LOWER(TRIM(mi.name)) = LOWER(TRIM(r.menu_item_name))
      JOIN food_costs fc ON fc.menu_item_id = mi.id
      WHERE fc.food_cost > 0
    ),

    -- Aggregate order data per product
    raw_sales AS (
      SELECT
        COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')       AS name,
        COALESCE(mi.category, ci.category, 'Other')  AS category,
        ol.item_id,
        COALESCE(SUM(ol.qty), 0)::bigint              AS units_sold,
        COALESCE(SUM(ol.gross), 0)                    AS gross_sales
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1, 2, 3, 4
    ),

    -- Enrich with food cost (single join, no function call)
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
        -- Food cost: direct lookup from pre-computed table, or recipe bridge
        COALESCE(fc.food_cost, rc.food_cost, 0) AS unit_food_cost_raw,
        CASE
          WHEN fc.food_cost IS NOT NULL AND fc.food_cost > 0 THEN 'recipe_actual'
          WHEN rc.food_cost IS NOT NULL AND rc.food_cost > 0 THEN 'recipe_actual'
          ELSE 'unknown'
        END AS cost_source_raw
      FROM raw_sales rs
      LEFT JOIN food_costs fc ON fc.menu_item_id = rs.item_id
      LEFT JOIN recipe_costs rc ON rc.menu_item_id = rs.item_id AND fc.food_cost IS NULL
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

    -- Final cost assignment with fallback chain
    costed AS (
      SELECT
        e.product_id,
        e.name,
        e.category,
        e.units_sold,
        e.gross_sales,
        e.selling_price_ex_vat,
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

    -- Filter to selected category
    category_filtered AS (
      SELECT * FROM costed
      WHERE (p_category IS NULL OR category = p_category)
        AND name <> 'Unknown'
    ),

    -- Compute derived metrics
    with_metrics AS (
      SELECT
        cf.*,
        ROUND(cf.selling_price_ex_vat - cf.unit_food_cost, 2) AS unit_gross_profit,
        ROUND((cf.selling_price_ex_vat - cf.unit_food_cost) * cf.units_sold, 2) AS total_gross_profit
      FROM category_filtered cf
    ),

    -- Category-level aggregates for thresholds
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

    -- Classify each item
    classified AS (
      SELECT
        m.product_id, m.name, m.category, m.units_sold,
        m.gross_sales AS sales,
        ROUND(m.gross_sales / (1 + p_vat_rate), 2) AS sales_ex_vat,
        m.selling_price_ex_vat, m.unit_food_cost,
        m.unit_gross_profit, m.total_gross_profit,
        CASE WHEN ct.total_units > 0
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2)
          ELSE 0
        END AS popularity_pct,
        ct.ideal_average_popularity,
        ct.average_gross_profit,
        m.unit_food_cost AS cogs,
        CASE WHEN m.selling_price_ex_vat > 0
          THEN ROUND(((m.selling_price_ex_vat - m.unit_food_cost) / m.selling_price_ex_vat) * 100, 1)
          ELSE 0
        END AS margin_pct,
        m.unit_gross_profit AS profit_per_sale,
        m.total_gross_profit AS profit_eur,

        -- Popularity class
        CASE WHEN ct.total_units > 0
              AND (m.units_sold::numeric / ct.total_units * 100) >= ct.ideal_average_popularity
          THEN 'high' ELSE 'low'
        END AS popularity_class,

        -- Profitability class
        CASE WHEN m.unit_gross_profit >= ct.average_gross_profit
          THEN 'high' ELSE 'low'
        END AS profitability_class,

        -- Classification
        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'star'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit THEN 'plow_horse'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'puzzle'
          ELSE 'dog'
        END AS classification,

        -- Action tag (English)
        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'Maintain'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit THEN 'Review cost'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit THEN 'Promote'
          ELSE 'Evaluate'
        END AS action_tag,

        -- Classification reason
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
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2)
          ELSE 0
        END AS popularity_share,
        CASE WHEN ct.total_sales > 0
          THEN ROUND((m.gross_sales / ct.total_sales) * 100, 2)
          ELSE 0
        END AS sales_share,
        CASE WHEN p_category IS NOT NULL THEN true ELSE false END AS is_canonical,
        ARRAY[]::text[] AS badges,
        ct.item_count, ct.total_units, ct.total_sales
      FROM with_metrics m, category_totals ct
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT * FROM classified
      ORDER BY total_gross_profit DESC
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text, text, numeric) TO anon, authenticated;

-- ═══════════════════════════════════════════
-- Step 3: Also update action_tag references in MenuEngineeringTable
-- ═══════════════════════════════════════════
-- (The frontend now uses English labels: Maintain, Review cost, Promote, Evaluate)
