-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: P3 — Implicit Waste (Merma Implícita)
--
-- Calculates the gap between theoretical and actual inventory usage.
-- Formula: Implicit Waste = Opening Stock + Purchases - Theoretical Consumption - Closing Stock
--
-- Theoretical Consumption = POS sales qty × recipe ingredient qty
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. RPC: calculate_implicit_waste ─────────────────────────────────────
-- Compares stock counts against theoretical consumption derived from
-- POS sales × recipes for a given location and date range.

CREATE OR REPLACE FUNCTION public.calculate_implicit_waste(
  p_org_id uuid,
  p_location_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(item_data)), '[]'::jsonb)
  INTO v_result
  FROM (
    WITH
    -- 1) Opening stock: most recent count on or before p_from
    opening AS (
      SELECT DISTINCT ON (ic.item_id)
        ic.item_id,
        ic.stock_actual AS opening_qty,
        ic.unit_cost,
        ic.count_date AS opening_date
      FROM inventory_counts ic
      WHERE ic.org_id = p_org_id
        AND ic.location_id = p_location_id
        AND ic.count_date <= p_from
      ORDER BY ic.item_id, ic.count_date DESC
    ),

    -- 2) Closing stock: most recent count on or before p_to
    closing AS (
      SELECT DISTINCT ON (ic.item_id)
        ic.item_id,
        ic.stock_actual AS closing_qty,
        ic.count_date AS closing_date
      FROM inventory_counts ic
      WHERE ic.org_id = p_org_id
        AND ic.location_id = p_location_id
        AND ic.count_date <= p_to
      ORDER BY ic.item_id, ic.count_date DESC
    ),

    -- 3) Purchases in the period (stock_movements type = 'purchase')
    purchases AS (
      SELECT
        sm.item_id,
        COALESCE(SUM(ABS(sm.qty_delta)), 0) AS purchase_qty
      FROM stock_movements sm
      WHERE sm.org_id = p_org_id
        AND sm.location_id = p_location_id
        AND sm.movement_type = 'purchase'
        AND (sm.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_from AND p_to
      GROUP BY sm.item_id
    ),

    -- 4) Theoretical consumption: POS sales × recipe ingredients
    -- For each sold menu item, look up its recipe and expand to ingredients
    theoretical AS (
      SELECT
        ri.inventory_item_id AS item_id,
        COALESCE(SUM(
          ol.qty * ri.qty_net / GREATEST(r.yield_qty, 1)
        ), 0) AS theoretical_qty
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      JOIN recipes r ON r.menu_item_id = ol.item_id AND r.group_id = p_org_id
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id AND ri.inventory_item_id IS NOT NULL
      WHERE o.org_id = p_org_id
        AND o.location_id = p_location_id
        AND o.closed_at::date BETWEEN p_from AND p_to
        AND o.closed_at IS NOT NULL
        AND ol.qty > 0
      GROUP BY ri.inventory_item_id
    ),

    -- 5) Explicit waste already recorded
    explicit_waste AS (
      SELECT
        sm.item_id,
        COALESCE(SUM(ABS(sm.qty_delta)), 0) AS waste_qty
      FROM stock_movements sm
      WHERE sm.org_id = p_org_id
        AND sm.location_id = p_location_id
        AND sm.movement_type = 'waste'
        AND (sm.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_from AND p_to
      GROUP BY sm.item_id
    ),

    -- 6) Combine all data per inventory item
    combined AS (
      SELECT
        COALESCE(o.item_id, c.item_id, t.item_id, p.item_id) AS item_id,
        COALESCE(o.opening_qty, 0) AS opening_qty,
        COALESCE(p.purchase_qty, 0) AS purchase_qty,
        COALESCE(t.theoretical_qty, 0) AS theoretical_qty,
        COALESCE(c.closing_qty, 0) AS closing_qty,
        COALESCE(ew.waste_qty, 0) AS explicit_waste_qty,
        COALESCE(o.unit_cost, 0) AS unit_cost,
        o.opening_date,
        c.closing_date
      FROM opening o
      FULL OUTER JOIN closing c ON c.item_id = o.item_id
      FULL OUTER JOIN theoretical t ON t.item_id = COALESCE(o.item_id, c.item_id)
      FULL OUTER JOIN purchases p ON p.item_id = COALESCE(o.item_id, c.item_id, t.item_id)
      FULL OUTER JOIN explicit_waste ew ON ew.item_id = COALESCE(o.item_id, c.item_id, t.item_id)
    )

    SELECT
      cb.item_id,
      ii.name AS item_name,
      ii.unit,
      ii.category_name AS category,
      cb.opening_qty,
      cb.purchase_qty,
      cb.theoretical_qty,
      cb.explicit_waste_qty,
      cb.closing_qty,
      -- Implicit waste = Opening + Purchases - Theoretical - Explicit Waste - Closing
      -- Positive = unaccounted loss (shrinkage)
      -- Negative = potential over-portioning or stock gain
      ROUND(
        (cb.opening_qty + cb.purchase_qty - cb.theoretical_qty - cb.explicit_waste_qty - cb.closing_qty)::numeric,
        2
      ) AS implicit_waste_qty,
      cb.unit_cost,
      ROUND(
        (cb.opening_qty + cb.purchase_qty - cb.theoretical_qty - cb.explicit_waste_qty - cb.closing_qty)
        * cb.unit_cost, 2
      ) AS implicit_waste_cost,
      -- Variance % relative to theoretical consumption
      CASE WHEN cb.theoretical_qty > 0 THEN
        ROUND(
          ((cb.opening_qty + cb.purchase_qty - cb.theoretical_qty - cb.explicit_waste_qty - cb.closing_qty)
           / cb.theoretical_qty * 100)::numeric, 1
        )
      ELSE NULL END AS variance_pct,
      cb.opening_date,
      cb.closing_date
    FROM combined cb
    JOIN inventory_items ii ON ii.id = cb.item_id
    WHERE (cb.opening_qty > 0 OR cb.closing_qty > 0 OR cb.theoretical_qty > 0)
    ORDER BY
      ROUND(
        (cb.opening_qty + cb.purchase_qty - cb.theoretical_qty - cb.explicit_waste_qty - cb.closing_qty)
        * cb.unit_cost, 2
      ) DESC
  ) item_data;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'location_id', p_location_id,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'items', v_result,
    'summary', (
      SELECT jsonb_build_object(
        'total_items', COUNT(*),
        'items_with_variance', COUNT(*) FILTER (WHERE val > 0),
        'total_implicit_waste_cost', ROUND(SUM(cost)::numeric, 2),
        'total_explicit_waste_cost', ROUND(SUM(ewc)::numeric, 2),
        'avg_variance_pct', ROUND(AVG(vp)::numeric, 1)
      )
      FROM (
        SELECT
          (elem->>'implicit_waste_qty')::numeric AS val,
          (elem->>'implicit_waste_cost')::numeric AS cost,
          (elem->>'explicit_waste_qty')::numeric * (elem->>'unit_cost')::numeric AS ewc,
          (elem->>'variance_pct')::numeric AS vp
        FROM jsonb_array_elements(v_result) AS elem
      ) agg
    )
  );
END;
$$;

-- ── 2. View: implicit_waste_summary ──────────────────────────────────────
-- Lightweight view that the Dashboard can query for the "shrinkage" KPI
-- without running the full RPC.

CREATE OR REPLACE VIEW implicit_waste_summary AS
WITH latest_counts AS (
  SELECT DISTINCT ON (ic.org_id, ic.location_id, ic.item_id)
    ic.org_id,
    ic.location_id,
    ic.item_id,
    ic.stock_actual,
    ic.stock_expected,
    ic.variance,
    ic.variance_pct,
    ic.unit_cost,
    ic.count_date
  FROM inventory_counts ic
  ORDER BY ic.org_id, ic.location_id, ic.item_id, ic.count_date DESC
)
SELECT
  lc.org_id,
  lc.location_id,
  lc.item_id,
  ii.name AS item_name,
  ii.unit,
  lc.stock_expected,
  lc.stock_actual,
  lc.variance AS variance_qty,
  lc.variance_pct,
  ROUND(ABS(lc.variance) * COALESCE(lc.unit_cost, 0), 2) AS variance_cost,
  lc.count_date,
  CASE
    WHEN ABS(lc.variance_pct) > 10 THEN 'high'
    WHEN ABS(lc.variance_pct) > 5 THEN 'medium'
    ELSE 'low'
  END AS severity
FROM latest_counts lc
JOIN inventory_items ii ON ii.id = lc.item_id
WHERE ABS(lc.variance) > 0;
