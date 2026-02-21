-- ============================================================
-- WISK.ai Inventory Intelligence Upgrade
-- inventory_counts, waste trigger, dead stock + variance RPCs
-- ============================================================

-- 1. Inventory Counts table (physical audits)
-- Note: org_id references stock_movements pattern (no FK to avoid view issue)
CREATE TABLE IF NOT EXISTS inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  counted_by uuid,
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  stock_expected numeric NOT NULL DEFAULT 0,
  stock_actual numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  variance_pct numeric NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Auto-compute variance on insert
CREATE OR REPLACE FUNCTION trg_compute_variance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.variance := NEW.stock_actual - NEW.stock_expected;
  IF NEW.stock_expected > 0 THEN
    NEW.variance_pct := ROUND((NEW.stock_actual - NEW.stock_expected) / NEW.stock_expected * 100, 1);
  ELSE
    NEW.variance_pct := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_counts_variance
  BEFORE INSERT OR UPDATE ON inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION trg_compute_variance();

CREATE INDEX IF NOT EXISTS idx_ic_org_location ON inventory_counts(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_ic_item ON inventory_counts(item_id);
CREATE INDEX IF NOT EXISTS idx_ic_date ON inventory_counts(count_date DESC);

-- RLS
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own org counts"
  ON inventory_counts FOR ALL
  USING (true);

-- 2. Trigger: auto-update on_hand when waste movement inserted
CREATE OR REPLACE FUNCTION trg_waste_auto_decrement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.movement_type = 'waste' THEN
    UPDATE inventory_item_location
      SET on_hand = GREATEST(on_hand + NEW.qty_delta, 0),
          updated_at = now()
      WHERE item_id = NEW.item_id
        AND location_id = NEW.location_id;

    UPDATE inventory_items
      SET current_stock = GREATEST(COALESCE(current_stock, 0) + NEW.qty_delta, 0)
      WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_waste_decrement ON stock_movements;
CREATE TRIGGER trg_stock_waste_decrement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.movement_type = 'waste')
  EXECUTE FUNCTION trg_waste_auto_decrement();

-- 3. RPC: Dead Stock (items with no movement in N days)
CREATE OR REPLACE FUNCTION get_dead_stock(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  category text,
  on_hand numeric,
  last_cost numeric,
  stock_value numeric,
  last_movement_at timestamptz,
  days_idle integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ii.id AS item_id,
    ii.name AS item_name,
    COALESCE(ic.name, 'Sin categoría') AS category,
    COALESCE(il.on_hand, ii.current_stock, 0) AS on_hand,
    COALESCE(ii.last_cost, 0) AS last_cost,
    COALESCE(il.on_hand, ii.current_stock, 0) * COALESCE(ii.last_cost, 0) AS stock_value,
    MAX(sm.created_at) AS last_movement_at,
    EXTRACT(DAY FROM now() - COALESCE(MAX(sm.created_at), ii.created_at))::integer AS days_idle
  FROM inventory_items ii
  LEFT JOIN inventory_item_location il
    ON il.item_id = ii.id
    AND (p_location_id IS NULL OR il.location_id = p_location_id)
  LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
  LEFT JOIN stock_movements sm
    ON sm.item_id = ii.id
    AND (p_location_id IS NULL OR sm.location_id = p_location_id)
  WHERE ii.org_id = p_org_id
    AND ii.is_active = true
    AND COALESCE(il.on_hand, ii.current_stock, 0) > 0
  GROUP BY ii.id, ii.name, ic.name, il.on_hand, ii.current_stock, ii.last_cost, ii.created_at
  HAVING EXTRACT(DAY FROM now() - COALESCE(MAX(sm.created_at), ii.created_at)) >= p_days
  ORDER BY (COALESCE(il.on_hand, ii.current_stock, 0) * COALESCE(ii.last_cost, 0)) DESC;
END;
$$;

-- 4. RPC: Variance summary
CREATE OR REPLACE FUNCTION get_variance_summary(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  category text,
  stock_expected numeric,
  stock_actual numeric,
  variance numeric,
  variance_pct numeric,
  unit_cost numeric,
  financial_loss numeric,
  count_date date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.item_id,
    ii.name AS item_name,
    COALESCE(cat.name, 'Sin categoría') AS category,
    c.stock_expected,
    c.stock_actual,
    c.variance,
    c.variance_pct,
    c.unit_cost,
    ABS(c.variance) * c.unit_cost AS financial_loss,
    c.count_date
  FROM inventory_counts c
  JOIN inventory_items ii ON ii.id = c.item_id
  LEFT JOIN inventory_categories cat ON cat.id = ii.category_id
  WHERE c.org_id = p_org_id
    AND (p_location_id IS NULL OR c.location_id = p_location_id)
    AND c.count_date BETWEEN p_from_date AND p_to_date
  ORDER BY ABS(c.variance_pct) DESC;
END;
$$;
