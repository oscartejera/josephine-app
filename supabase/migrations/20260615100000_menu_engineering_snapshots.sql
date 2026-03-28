-- ============================================================
-- Menu Engineering Classification Snapshots
-- Persists periodic snapshots of item classifications so we can
-- show trend / quadrant migration over time (Sprint 2B).
-- ============================================================

-- Table: one row per (product × period)
CREATE TABLE IF NOT EXISTS menu_engineering_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Multi-tenancy (matches pattern: orgs.id, locations.id)
  org_id          uuid NOT NULL,
  location_id     uuid REFERENCES locations(id) ON DELETE SET NULL,
  -- Product reference (no FK for resilience — product could be removed)
  product_id      uuid NOT NULL,
  product_name    text NOT NULL,
  category        text,
  -- Snapshot period
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  -- Kasavana-Smith classification
  classification  text NOT NULL CHECK (classification IN ('star','plow_horse','puzzle','dog')),
  -- Key metrics at time of snapshot
  selling_price   numeric(10,2) NOT NULL DEFAULT 0,
  unit_food_cost  numeric(10,2) NOT NULL DEFAULT 0,
  unit_gross_profit numeric(10,2) NOT NULL DEFAULT 0,
  units_sold      integer NOT NULL DEFAULT 0,
  popularity_pct  numeric(6,2) NOT NULL DEFAULT 0,
  food_cost_pct   numeric(6,2) NOT NULL DEFAULT 0,
  -- Pavesic CMAM classification (Sprint 2A)
  pavesic_classification text CHECK (pavesic_classification IN ('prime','standard','sleeper','problem')),
  -- Metadata
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate snapshots for same product + period
  UNIQUE (org_id, location_id, product_id, period_start, period_end)
);

-- Index for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_me_snapshots_org_period
  ON menu_engineering_snapshots (org_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_me_snapshots_product_period
  ON menu_engineering_snapshots (product_id, period_start DESC);

-- RLS: users can only see their org's snapshots
ALTER TABLE menu_engineering_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'menu_engineering_snapshots'
      AND policyname = 'org_isolation'
  ) THEN
    CREATE POLICY org_isolation ON menu_engineering_snapshots
      FOR ALL
      USING (
        org_id IN (
          SELECT om.org_id
          FROM org_memberships om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RPC: Get classification timeline for a product or all products
CREATE OR REPLACE FUNCTION get_menu_engineering_timeline(
  p_org_id      uuid,
  p_location_id uuid DEFAULT NULL,
  p_product_id  uuid DEFAULT NULL,
  p_limit       integer DEFAULT 6
)
RETURNS TABLE (
  product_id              uuid,
  product_name            text,
  category                text,
  period_start            date,
  period_end              date,
  classification          text,
  pavesic_classification  text,
  selling_price           numeric,
  unit_gross_profit       numeric,
  food_cost_pct           numeric,
  units_sold              integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    s.product_id,
    s.product_name,
    s.category,
    s.period_start,
    s.period_end,
    s.classification,
    s.pavesic_classification,
    s.selling_price,
    s.unit_gross_profit,
    s.food_cost_pct,
    s.units_sold
  FROM menu_engineering_snapshots s
  WHERE s.org_id = p_org_id
    AND (p_location_id IS NULL OR s.location_id = p_location_id)
    AND (p_product_id  IS NULL OR s.product_id  = p_product_id)
  ORDER BY s.period_start DESC
  LIMIT p_limit * (
    SELECT count(DISTINCT s2.product_id)
    FROM menu_engineering_snapshots s2
    WHERE s2.org_id = p_org_id
      AND (p_location_id IS NULL OR s2.location_id = p_location_id)
  )
$$;

NOTIFY pgrst, 'reload schema';
