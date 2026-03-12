-- Fix get_top_products_unified: remove cross-join bug in matview branch
--
-- BUG: The matview branch had:
--   SELECT SUM(mv.net_sales), jsonb_agg(...)
--   FROM (subquery) sub, product_sales_daily_unified_mv mv
-- This creates a cartesian product, inflating total by N× (where N = subquery rows).
--
-- FIX: Compute items and total independently, matching the pos_daily_products fallback.

CREATE OR REPLACE FUNCTION get_top_products_unified(
    p_org_id uuid,
    p_location_ids uuid[],
    p_from date,
    p_to date,
    p_limit integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $fn$
DECLARE
    result jsonb;
    matview_has_data boolean;
    total numeric;
    items_arr jsonb;
    source_name text;
BEGIN
    -- Check if the matview has data for the requested date range
    SELECT EXISTS(
        SELECT 1 FROM product_sales_daily_unified_mv
        WHERE org_id = p_org_id
          AND location_id = ANY(p_location_ids)
          AND day BETWEEN p_from AND p_to
        LIMIT 1
    ) INTO matview_has_data;

    IF matview_has_data THEN
        source_name := 'matview';

        -- Compute total sales independently
        SELECT COALESCE(SUM(mv.net_sales), 0) INTO total
        FROM product_sales_daily_unified_mv mv
        WHERE mv.org_id = p_org_id
          AND mv.location_id = ANY(p_location_ids)
          AND mv.day BETWEEN p_from AND p_to;

        -- Compute top items independently
        SELECT COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY sub.sales DESC), '[]'::jsonb)
        INTO items_arr
        FROM (
            SELECT
                mv.product_id,
                mv.product_name AS name,
                mv.product_category AS category,
                SUM(mv.units_sold) AS qty,
                SUM(mv.net_sales) AS sales,
                CASE WHEN total > 0
                     THEN ROUND((SUM(mv.net_sales) / total) * 100, 1)
                     ELSE 0 END AS share,
                SUM(COALESCE(mv.cogs, 0)) AS cogs
            FROM product_sales_daily_unified_mv mv
            WHERE mv.org_id = p_org_id
              AND mv.location_id = ANY(p_location_ids)
              AND mv.day BETWEEN p_from AND p_to
            GROUP BY mv.product_id, mv.product_name, mv.product_category
            ORDER BY sales DESC
            LIMIT p_limit
        ) sub;
    ELSE
        source_name := 'pos_daily_products';

        -- Compute total independently
        SELECT COALESCE(SUM(p.net_sales), 0) INTO total
        FROM pos_daily_products p
        WHERE p.group_id = p_org_id
          AND p.location_id = ANY(p_location_ids)
          AND p.date BETWEEN p_from AND p_to;

        -- Compute top items independently
        SELECT COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY sub.sales DESC), '[]'::jsonb)
        INTO items_arr
        FROM (
            SELECT
                p.product_id,
                p.product_name AS name,
                p.product_category AS category,
                SUM(p.units_sold) AS qty,
                SUM(p.net_sales) AS sales,
                CASE WHEN total > 0
                     THEN ROUND((SUM(p.net_sales) / total) * 100, 1)
                     ELSE 0 END AS share,
                SUM(COALESCE(p.cogs, 0)) AS cogs
            FROM pos_daily_products p
            WHERE p.group_id = p_org_id
              AND p.location_id = ANY(p_location_ids)
              AND p.date BETWEEN p_from AND p_to
            GROUP BY p.product_id, p.product_name, p.product_category
            ORDER BY sales DESC
            LIMIT p_limit
        ) sub;
    END IF;

    result := jsonb_build_object(
        'data_source', source_name,
        'mode', 'unified',
        'reason', 'aggregated from ' || source_name,
        'last_synced_at', now()::text,
        'total_sales', COALESCE(total, 0),
        'items', COALESCE(items_arr, '[]'::jsonb)
    );

    RETURN result;
END;
$fn$;
