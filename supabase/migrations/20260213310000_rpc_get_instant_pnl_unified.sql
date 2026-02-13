-- ============================================================
-- RPC: get_instant_pnl_unified
--
-- Per-location P&L snapshot via resolve_data_source.
-- Replaces direct pos_daily_finance + forecast_daily_metrics queries.
-- COGS is estimated (flagged as such).
-- ============================================================

CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id       uuid,
  p_location_ids uuid[],
  p_from         date,
  p_to           date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_resolve     jsonb;
  v_ds          text;
  v_mode        text;
  v_reason      text;
  v_last_synced timestamptz;
  v_locations   jsonb;
BEGIN
  v_resolve     := resolve_data_source(p_org_id);
  v_ds          := v_resolve->>'data_source';
  v_mode        := v_resolve->>'mode';
  v_reason      := v_resolve->>'reason';
  v_last_synced := (v_resolve->>'last_synced_at')::timestamptz;

  SELECT COALESCE(jsonb_agg(loc_row ORDER BY loc_row->>'locationName'), '[]'::jsonb)
  INTO v_locations
  FROM (
    SELECT jsonb_build_object(
      'locationId',       l.id,
      'locationName',     l.name,
      'salesActual',      COALESCE(act.net_sales, 0),
      'salesForecast',    COALESCE(fct.forecast_sales, 0),
      'labourForecast',   COALESCE(fct.planned_labor_cost, 0),
      'labourActual',     COALESCE(lab.labor_cost, 0),
      'labourHoursActual', COALESCE(lab.labor_hours, 0),
      'estimated_cogs',   true,
      'estimated_labour', (COALESCE(lab.labor_cost, 0) = 0)
    ) AS loc_row
    FROM locations l
    LEFT JOIN LATERAL (
      SELECT SUM(pdf.net_sales) AS net_sales
      FROM v_pos_daily_finance_unified pdf
      WHERE pdf.location_id = l.id
        AND pdf.data_source_unified = v_ds
        AND pdf.date BETWEEN p_from AND p_to
    ) act ON true
    LEFT JOIN LATERAL (
      SELECT
        SUM(fd.forecast_sales) AS forecast_sales,
        SUM(fd.planned_labor_cost) AS planned_labor_cost
      FROM forecast_daily_metrics fd
      WHERE fd.location_id = l.id
        AND fd.data_source = v_ds
        AND fd.date BETWEEN p_from AND p_to
    ) fct ON true
    LEFT JOIN LATERAL (
      SELECT
        SUM(pdm.labor_cost) AS labor_cost,
        SUM(pdm.labor_hours) AS labor_hours
      FROM pos_daily_metrics pdm
      WHERE pdm.location_id = l.id
        AND pdm.date BETWEEN p_from AND p_to
    ) lab ON true
    WHERE l.id = ANY(p_location_ids)
  ) sub;

  RETURN jsonb_build_object(
    'data_source',   v_ds,
    'mode',          v_mode,
    'reason',        v_reason,
    'last_synced_at', v_last_synced,
    'locations',     v_locations,
    'flags', jsonb_build_object(
      'estimated_cogs', true,
      'cogs_note', 'COGS calculado con ratio estimado (25-32%). Conecta inventario para datos reales.'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, uuid[], date, date)
  TO authenticated;
