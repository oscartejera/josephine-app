-- =============================================================================
-- FIX: get_instant_pnl_unified — P&L per-location cards
-- Returns the contract the frontend expects:
-- { data_source, mode, reason, last_synced_at, locations: [...], flags: {...} }
-- =============================================================================

DROP FUNCTION IF EXISTS get_instant_pnl_unified(uuid, text[], date, date);

CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids text[],
  p_from date,
  p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $function$
DECLARE v_ds jsonb; v_locs jsonb; v_loc_uuids uuid[];
BEGIN
  -- Resolve data source metadata
  v_ds := resolve_data_source(p_org_id);

  -- Cast text[] to uuid[] once
  v_loc_uuids := p_location_ids::uuid[];

  -- Build per-location metrics
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id,
      l.name AS location_name,
      -- Sales (actual from daily_sales via sales_daily_unified)
      COALESCE(s.net_sales, 0)::numeric AS actual_sales,
      -- Sales (forecast)
      COALESCE(fc.forecast_sales, 0)::numeric AS forecast_sales,
      -- COGS estimated at 32% of sales (no POS COGS yet)
      ROUND(COALESCE(s.net_sales, 0) * 0.32, 2)::numeric AS actual_cogs,
      ROUND(COALESCE(fc.forecast_sales, 0) * 0.32, 2)::numeric AS forecast_cogs,
      -- Labour (actual from labour_daily via labour_daily_unified)
      COALESCE(lb.labour_cost, 0)::numeric AS actual_labour,
      COALESCE(lb.labour_hours, 0)::numeric AS actual_labour_hours,
      -- Labour (forecast)
      COALESCE(fc.planned_labor_cost, 0)::numeric AS forecast_labour,
      COALESCE(fc.planned_labor_hours, 0)::numeric AS forecast_labour_hours,
      -- Gross Profit = Sales - COGS - Labour
      (COALESCE(s.net_sales, 0)
        - ROUND(COALESCE(s.net_sales, 0) * 0.32, 2)
        - COALESCE(lb.labour_cost, 0))::numeric AS actual_gp,
      (COALESCE(fc.forecast_sales, 0)
        - ROUND(COALESCE(fc.forecast_sales, 0) * 0.32, 2)
        - COALESCE(fc.planned_labor_cost, 0))::numeric AS forecast_gp,
      -- Estimation flags
      true AS estimated_cogs,
      CASE WHEN COALESCE(lb.labour_cost, 0) = 0 AND COALESCE(s.net_sales, 0) > 0
        THEN true ELSE false END AS estimated_labour
    FROM locations l
    -- Sales aggregated from sales_daily_unified (view over daily_sales)
    LEFT JOIN (
      SELECT sdu.location_id::uuid AS location_id, SUM(sdu.net_sales) AS net_sales
      FROM sales_daily_unified sdu
      WHERE sdu.org_id = p_org_id AND sdu.date BETWEEN p_from AND p_to
      GROUP BY 1
    ) s ON s.location_id = l.id
    -- Labour aggregated from labour_daily_unified (view over labour_daily)
    LEFT JOIN (
      SELECT ldu.location_id::uuid AS location_id,
             SUM(ldu.labour_cost) AS labour_cost,
             SUM(ldu.labour_hours) AS labour_hours
      FROM labour_daily_unified ldu
      WHERE ldu.org_id = p_org_id AND ldu.date BETWEEN p_from AND p_to
      GROUP BY 1
    ) lb ON lb.location_id = l.id
    -- Forecast aggregated from forecast_daily_unified (view over forecast_daily_metrics)
    LEFT JOIN (
      SELECT fdu.location_id::uuid AS location_id,
             SUM(fdu.forecast_sales) AS forecast_sales,
             SUM(fdu.planned_labor_cost) AS planned_labor_cost,
             SUM(fdu.planned_labor_hours) AS planned_labor_hours
      FROM forecast_daily_unified fdu
      WHERE fdu.org_id = p_org_id AND fdu.date BETWEEN p_from AND p_to
      GROUP BY 1
    ) fc ON fc.location_id = l.id
    WHERE l.id = ANY(v_loc_uuids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source', v_ds->>'data_source',
    'mode',        v_ds->>'mode',
    'reason',      v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'locations',   v_locs,
    'flags',       jsonb_build_object('estimated_cogs', true, 'cogs_note', 'COGS estimated at 32% of sales')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, text[], date, date) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
