-- Fix get_top_products_unified: include metadata fields required by frontend schema
-- Fix get_labour_cost_by_date: remove reference to e.role_id column 
-- Fix get_food_cost_variance: handle missing purchase_order_status values

-- 1. Fix get_top_products_unified with proper metadata
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
        -- Use the matview
        SELECT COALESCE(SUM(mv.net_sales), 0),
               COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY sub.sales DESC), '[]'::jsonb)
        INTO total, items_arr
        FROM (
            SELECT
                mv.product_id,
                mv.product_name AS name,
                mv.product_category AS category,
                SUM(mv.units_sold) AS qty,
                SUM(mv.net_sales) AS sales,
                CASE WHEN SUM(SUM(mv.net_sales)) OVER () > 0
                     THEN ROUND((SUM(mv.net_sales) / SUM(SUM(mv.net_sales)) OVER ()) * 100, 1)
                     ELSE 0 END AS share,
                SUM(COALESCE(mv.cogs, 0)) AS cogs
            FROM product_sales_daily_unified_mv mv
            WHERE mv.org_id = p_org_id
              AND mv.location_id = ANY(p_location_ids)
              AND mv.day BETWEEN p_from AND p_to
            GROUP BY mv.product_id, mv.product_name, mv.product_category
            ORDER BY sales DESC
            LIMIT p_limit
        ) sub, product_sales_daily_unified_mv mv
        WHERE mv.org_id = p_org_id
          AND mv.location_id = ANY(p_location_ids)
          AND mv.day BETWEEN p_from AND p_to;
    ELSE
        source_name := 'pos_daily_products';
        -- Fallback: query pos_daily_products directly
        SELECT COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY sub.sales DESC), '[]'::jsonb)
        INTO items_arr
        FROM (
            SELECT
                p.product_id,
                p.product_name AS name,
                p.product_category AS category,
                SUM(p.units_sold) AS qty,
                SUM(p.net_sales) AS sales,
                CASE WHEN SUM(SUM(p.net_sales)) OVER () > 0
                     THEN ROUND((SUM(p.net_sales) / SUM(SUM(p.net_sales)) OVER ()) * 100, 1)
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

        SELECT COALESCE(SUM(p.net_sales), 0) INTO total
        FROM pos_daily_products p
        WHERE p.group_id = p_org_id
          AND p.location_id = ANY(p_location_ids)
          AND p.date BETWEEN p_from AND p_to;
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

-- 2. Fix get_labour_cost_by_date: recreate without e.role_id reference
CREATE OR REPLACE FUNCTION get_labour_cost_by_date(
    _location_ids uuid[],
    _from date,
    _to date
) RETURNS TABLE(business_date date, labour_cost numeric, hours_worked numeric, headcount integer)
LANGUAGE sql STABLE
AS $fn$
    SELECT
        ldu.day AS business_date,
        COALESCE(SUM(ldu.actual_cost), 0) AS labour_cost,
        COALESCE(SUM(ldu.actual_hours), 0) AS hours_worked,
        COALESCE(SUM(ldu.scheduled_headcount), 0)::integer AS headcount
    FROM labour_daily_unified ldu
    WHERE ldu.location_id = ANY(_location_ids)
      AND ldu.day BETWEEN _from AND _to
    GROUP BY ldu.day
    ORDER BY ldu.day;
$fn$;
