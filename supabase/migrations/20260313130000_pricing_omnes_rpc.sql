-- Pricing / OMNES Analysis — Server-side RPC
--
-- Completely SEPARATE from menu_engineering_summary.
-- Does NOT compute classification, popularity, or gross profit.
--
-- Computes:
--   OMNES 1: price_range_ratio (max/min)
--   OMNES 2: price spread (3 equal bands)
--   OMNES 3: category_ratio (avg_check / avg_menu_price)

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
    -- Step 1: Aggregate order data per product
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

    -- Step 2: Compute selling_price_ex_vat per item
    with_price AS (
      SELECT
        rs.name,
        rs.category,
        rs.units_sold,
        rs.gross_sales,
        CASE WHEN rs.units_sold > 0
          THEN ROUND(rs.gross_sales / rs.units_sold / (1 + p_vat_rate), 2)
          ELSE 0
        END AS listed_price,
        ROUND(rs.gross_sales / (1 + p_vat_rate), 2) AS item_revenue
      FROM raw_sales rs
      WHERE (p_category IS NULL OR rs.category = p_category)
    ),

    -- Step 3: Category-level aggregates
    cat_agg AS (
      SELECT
        category,
        COUNT(*) AS item_count,
        MAX(listed_price) AS max_price,
        MIN(CASE WHEN listed_price > 0 THEN listed_price ELSE NULL END) AS min_price,
        SUM(units_sold) AS total_units_sold,
        SUM(item_revenue) AS total_revenue,
        AVG(listed_price) AS avg_menu_price
      FROM with_price
      GROUP BY category
    ),

    -- Step 4: OMNES metrics per category
    omnes AS (
      SELECT
        ca.category,
        ca.item_count,
        -- OMNES 1: Price Range Ratio
        COALESCE(ca.max_price, 0) AS max_price,
        COALESCE(ca.min_price, 0) AS min_price,
        CASE WHEN ca.min_price > 0
          THEN ROUND(ca.max_price / ca.min_price, 2)
          ELSE 0
        END AS price_range_ratio,
        CASE
          WHEN ca.min_price IS NULL OR ca.min_price = 0 THEN 'too_narrow'
          WHEN ROUND(ca.max_price / ca.min_price, 2) < 2.5 THEN 'too_narrow'
          WHEN ROUND(ca.max_price / ca.min_price, 2) <= 3.0 THEN 'healthy'
          ELSE 'too_wide'
        END AS price_range_state,
        -- OMNES 2: Band metrics
        COALESCE(ca.max_price - ca.min_price, 0) AS range_length,
        CASE WHEN ca.max_price > ca.min_price
          THEN ROUND((ca.max_price - ca.min_price) / 3.0, 2)
          ELSE 0
        END AS band_width,
        -- OMNES 3: Category Ratio
        CASE WHEN ca.total_units_sold > 0
          THEN ROUND(ca.total_revenue / ca.total_units_sold, 2)
          ELSE 0
        END AS average_check_per_plate,
        ROUND(COALESCE(ca.avg_menu_price, 0), 2) AS average_menu_price,
        CASE WHEN ca.avg_menu_price > 0 AND ca.total_units_sold > 0
          THEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2)
          ELSE 0
        END AS category_ratio,
        CASE
          WHEN ca.avg_menu_price = 0 OR ca.total_units_sold = 0 THEN 'healthy'
          WHEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2) < 0.90 THEN 'too_expensive'
          WHEN ROUND((ca.total_revenue / ca.total_units_sold) / ca.avg_menu_price, 2) <= 1.00 THEN 'healthy'
          ELSE 'underpriced'
        END AS pricing_health_state,
        ca.total_units_sold,
        ca.total_revenue
      FROM cat_agg ca
    ),

    -- Step 5: Per-item band assignment
    item_bands AS (
      SELECT
        wp.name,
        wp.category,
        wp.listed_price,
        wp.units_sold,
        wp.item_revenue,
        om.band_width,
        om.min_price,
        CASE
          WHEN wp.listed_price <= om.min_price + om.band_width THEN 'lower'
          WHEN wp.listed_price <= om.min_price + 2 * om.band_width THEN 'middle'
          ELSE 'upper'
        END AS band,
        CASE
          WHEN wp.listed_price > om.min_price + om.band_width
               AND wp.listed_price <= om.min_price + 2 * om.band_width
          THEN true ELSE false
        END AS is_promotion_candidate
      FROM with_price wp
      JOIN omnes om ON om.category = wp.category
    ),

    -- Step 6: Band counts per category
    band_counts AS (
      SELECT
        category,
        COUNT(*) FILTER (WHERE band = 'lower')  AS lower_band_count,
        COUNT(*) FILTER (WHERE band = 'middle') AS middle_band_count,
        COUNT(*) FILTER (WHERE band = 'upper')  AS upper_band_count,
        COUNT(*) AS total_items
      FROM item_bands
      GROUP BY category
    ),

    -- Step 7: Assemble final result
    final AS (
      SELECT
        om.*,
        -- Band boundaries
        ROUND(om.min_price + om.band_width, 2) AS lower_band_max,
        ROUND(om.min_price + 2 * om.band_width, 2) AS middle_band_max,
        -- Band counts
        COALESCE(bc.lower_band_count, 0) AS lower_band_count,
        COALESCE(bc.middle_band_count, 0) AS middle_band_count,
        COALESCE(bc.upper_band_count, 0) AS upper_band_count,
        -- Band percentages
        CASE WHEN bc.total_items > 0
          THEN ROUND((bc.lower_band_count::numeric / bc.total_items) * 100, 1)
          ELSE 0
        END AS lower_band_pct,
        CASE WHEN bc.total_items > 0
          THEN ROUND((bc.middle_band_count::numeric / bc.total_items) * 100, 1)
          ELSE 0
        END AS middle_band_pct,
        CASE WHEN bc.total_items > 0
          THEN ROUND((bc.upper_band_count::numeric / bc.total_items) * 100, 1)
          ELSE 0
        END AS upper_band_pct,
        -- Band distribution state
        CASE
          WHEN bc.total_items > 0 AND ROUND((bc.middle_band_count::numeric / bc.total_items) * 100, 1) < 35 THEN 'weak_middle'
          WHEN bc.total_items > 0 AND ROUND((bc.lower_band_count::numeric / bc.total_items) * 100, 1) > 40 THEN 'too_many_lower'
          WHEN bc.total_items > 0 AND ROUND((bc.upper_band_count::numeric / bc.total_items) * 100, 1) > 40 THEN 'too_many_upper'
          ELSE 'balanced'
        END AS band_distribution_state,
        -- Promotion zone
        CASE WHEN COALESCE(bc.middle_band_count, 0) > 0 THEN 'middle' ELSE 'none' END AS promotion_zone,
        -- Items with bands
        (SELECT COALESCE(jsonb_agg(row_to_json(ib)::jsonb ORDER BY ib.listed_price), '[]'::jsonb)
         FROM item_bands ib WHERE ib.category = om.category
        ) AS items
      FROM omnes om
      LEFT JOIN band_counts bc ON bc.category = om.category
    )
    SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb)
    FROM final f
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pricing_omnes_summary(date, date, uuid, text, text, numeric) TO anon, authenticated;
