-- Menu Engineering v2 — Canonical Kasavana-Smith implementation
--
-- Fixes:
--   1. COGS was hardcoded to 0 → now uses recipe food cost or category average
--   2. Profitability axis was margin_pct → now unit_gross_profit (€)
--   3. Classification was across ALL categories → now per-category
--   4. VAT handling: prices normalized to ex-VAT
--   5. New fields: selling_price_ex_vat, unit_food_cost, unit_gross_profit,
--      popularity_pct, ideal_average_popularity, average_gross_profit,
--      popularity_class, profitability_class, classification_reason,
--      cost_source, data_confidence
--
-- Canonical formulas (Kasavana & Smith, 1982):
--   popularity_pct = units_sold / total_units_in_category × 100
--   ideal_average_popularity = (100 / N) × 70  (the 70% rule)
--   unit_gross_profit = selling_price_ex_vat − unit_food_cost
--   average_gross_profit = Σ(unit_gross_profit × units_sold) / Σ(units_sold)
--   Star       = high popularity + high profitability
--   Plow Horse = high popularity + low profitability
--   Puzzle     = low popularity  + high profitability
--   Dog        = low popularity  + low profitability

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
    -- Step 1: Aggregate order data per product
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

    -- Step 2: Enrich with recipe cost data
    -- Try to match product name → recipe name for food cost
    enriched AS (
      SELECT
        rs.product_id,
        rs.name,
        rs.category,
        rs.units_sold,
        rs.gross_sales,
        -- VAT normalization: selling_price_ex_vat = gross / (1 + vat_rate)
        CASE WHEN rs.units_sold > 0
          THEN ROUND(rs.gross_sales / rs.units_sold / (1 + p_vat_rate), 2)
          ELSE 0
        END AS selling_price_ex_vat,
        -- Food cost: try recipe match first
        COALESCE(rc.food_cost, 0) AS unit_food_cost_raw,
        CASE
          WHEN rc.food_cost IS NOT NULL AND rc.food_cost > 0 THEN 'recipe_actual'
          ELSE 'unknown'
        END AS cost_source_raw
      FROM raw_sales rs
      LEFT JOIN LATERAL (
        SELECT get_recipe_food_cost(r.id) AS food_cost
        FROM recipes r
        WHERE LOWER(TRIM(r.menu_item_name)) = LOWER(TRIM(rs.name))
        LIMIT 1
      ) rc ON true
    ),

    -- Step 3: Compute category-level fallback cost (average of known costs)
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

    -- Step 4: Final cost assignment with fallback chain
    costed AS (
      SELECT
        e.product_id,
        e.name,
        e.category,
        e.units_sold,
        e.gross_sales,
        e.selling_price_ex_vat,
        -- Food cost with fallback: recipe → category average → 0 (unknown)
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN e.unit_food_cost_raw
          WHEN ca.avg_food_cost > 0 THEN ROUND(ca.avg_food_cost, 2)
          ELSE 0
        END AS unit_food_cost,
        -- Cost source tracking
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN 'recipe_actual'
          WHEN ca.avg_food_cost > 0 THEN 'fallback_average'
          ELSE 'unknown'
        END AS cost_source,
        -- Data confidence
        CASE
          WHEN e.cost_source_raw = 'recipe_actual' THEN 'high'
          WHEN ca.avg_food_cost > 0 THEN 'medium'
          ELSE 'low'
        END AS data_confidence
      FROM enriched e
      LEFT JOIN category_avg_cost ca ON ca.category = e.category
    ),

    -- Step 5: Filter to selected category (if provided)
    category_filtered AS (
      SELECT * FROM costed
      WHERE (p_category IS NULL OR category = p_category)
    ),

    -- Step 6: Compute derived metrics
    with_metrics AS (
      SELECT
        cf.*,
        -- unit_gross_profit = selling_price_ex_vat - unit_food_cost
        ROUND(cf.selling_price_ex_vat - cf.unit_food_cost, 2) AS unit_gross_profit,
        -- total_gross_profit = unit_gross_profit × units_sold
        ROUND((cf.selling_price_ex_vat - cf.unit_food_cost) * cf.units_sold, 2) AS total_gross_profit
      FROM category_filtered cf
    ),

    -- Step 7: Category-level aggregates for thresholds
    category_totals AS (
      SELECT
        COALESCE(SUM(units_sold), 0) AS total_units,
        COALESCE(SUM(gross_sales), 0) AS total_sales,
        COUNT(*) AS item_count,
        -- Kasavana-Smith 70% rule: ideal_average_popularity = (100 / N) × 70
        CASE WHEN COUNT(*) > 0
          THEN ROUND((100.0 / COUNT(*)) * 0.70, 2)
          ELSE 0
        END AS ideal_average_popularity,
        -- average_gross_profit = Σ(total_gross_profit) / Σ(units_sold)
        CASE WHEN SUM(units_sold) > 0
          THEN ROUND(SUM(total_gross_profit) / SUM(units_sold), 2)
          ELSE 0
        END AS average_gross_profit
      FROM with_metrics
    ),

    -- Step 8: Classify each item
    classified AS (
      SELECT
        m.product_id,
        m.name,
        m.category,
        m.units_sold,
        -- Sales data
        m.gross_sales AS sales,
        ROUND(m.gross_sales / (1 + p_vat_rate), 2) AS sales_ex_vat,
        -- Core Menu Engineering fields
        m.selling_price_ex_vat,
        m.unit_food_cost,
        m.unit_gross_profit,
        m.total_gross_profit,
        -- Popularity
        CASE WHEN ct.total_units > 0
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2)
          ELSE 0
        END AS popularity_pct,
        ct.ideal_average_popularity,
        -- Profitability thresholds
        ct.average_gross_profit,
        -- Legacy compat fields
        m.unit_food_cost AS cogs,
        CASE WHEN m.selling_price_ex_vat > 0
          THEN ROUND(((m.selling_price_ex_vat - m.unit_food_cost) / m.selling_price_ex_vat) * 100, 1)
          ELSE 0
        END AS margin_pct,
        m.unit_gross_profit AS profit_per_sale,
        m.total_gross_profit AS profit_eur,
        -- Popularity classification
        CASE WHEN ct.total_units > 0
              AND (m.units_sold::numeric / ct.total_units * 100) >= ct.ideal_average_popularity
          THEN 'high'
          ELSE 'low'
        END AS popularity_class,
        -- Profitability classification
        CASE WHEN m.unit_gross_profit >= ct.average_gross_profit
          THEN 'high'
          ELSE 'low'
        END AS profitability_class,
        -- Final classification (Kasavana-Smith matrix)
        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'star'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit
            THEN 'plow_horse'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'puzzle'
          ELSE 'dog'
        END AS classification,
        -- Action tag
        CASE
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'Mantener'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) >= ct.ideal_average_popularity
               AND m.unit_gross_profit < ct.average_gross_profit
            THEN 'Revisar coste'
          WHEN (m.units_sold::numeric / NULLIF(ct.total_units, 0) * 100) < ct.ideal_average_popularity
               AND m.unit_gross_profit >= ct.average_gross_profit
            THEN 'Promocionar'
          ELSE 'Evaluar'
        END AS action_tag,
        -- Classification reason (human-readable)
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
        -- Cost & confidence
        m.cost_source,
        m.data_confidence,
        -- Share fields for legacy compat
        CASE WHEN ct.total_units > 0
          THEN ROUND((m.units_sold::numeric / ct.total_units) * 100, 2)
          ELSE 0
        END AS popularity_share,
        CASE WHEN ct.total_sales > 0
          THEN ROUND((m.gross_sales / ct.total_sales) * 100, 2)
          ELSE 0
        END AS sales_share,
        -- Is this canonical (category-scoped)?
        CASE WHEN p_category IS NOT NULL THEN true ELSE false END AS is_canonical,
        -- Badges
        ARRAY[]::text[] AS badges,
        -- Category stats (for frontend threshold display)
        ct.item_count,
        ct.total_units,
        ct.total_sales
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
