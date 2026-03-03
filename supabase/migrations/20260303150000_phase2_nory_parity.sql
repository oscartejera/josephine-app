-- ============================================================
-- Phase 2: Nory Feature Parity — All Tables
-- 1. GPS Geofencing (locations ALTER)
-- 2. Manager Logbook (manager_logbook)
-- 3. AI Predictive Ordering (ai_order_guides)
-- 4. Weather Cache (weather_cache)
-- 5. Employee Reviews (employee_reviews)
-- ============================================================


-- ─── 1. GPS GEOFENCING ──────────────────────────────────────
-- Add geolocation columns to existing locations table

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m int NOT NULL DEFAULT 200;

COMMENT ON COLUMN locations.latitude IS 'GPS latitude for geofence validation';
COMMENT ON COLUMN locations.longitude IS 'GPS longitude for geofence validation';
COMMENT ON COLUMN locations.geofence_radius_m IS 'Allowed clock-in radius in meters (default 200m)';


-- ─── 2. MANAGER LOGBOOK ─────────────────────────────────────
-- Daily operations log per location/shift

CREATE TABLE IF NOT EXISTS manager_logbook (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  shift_date  date NOT NULL DEFAULT CURRENT_DATE,
  category    text NOT NULL DEFAULT 'general'
              CHECK (category IN ('general','incident','staffing','inventory','maintenance','customer')),
  content     text NOT NULL,
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','warning','critical')),
  resolved    boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logbook_location_date
  ON manager_logbook(location_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_org
  ON manager_logbook(org_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_unresolved
  ON manager_logbook(location_id)
  WHERE resolved = false;

ALTER TABLE manager_logbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logbook_select" ON manager_logbook
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "logbook_insert" ON manager_logbook
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logbook_update" ON manager_logbook
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logbook_delete" ON manager_logbook
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON manager_logbook TO authenticated;


-- ─── 3. AI PREDICTIVE ORDERING ──────────────────────────────
-- Stores generated order guides from recipes × forecast

CREATE TABLE IF NOT EXISTS ai_order_guides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL,
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_start_date   date NOT NULL,
  forecast_end_date     date NOT NULL,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','received','cancelled')),
  total_estimated_cost  numeric(12,2) NOT NULL DEFAULT 0,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Individual line items in the order guide
CREATE TABLE IF NOT EXISTS ai_order_guide_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_guide_id    uuid NOT NULL REFERENCES ai_order_guides(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  forecast_need_qty numeric(12,3) NOT NULL DEFAULT 0,
  on_hand_qty       numeric(12,3) NOT NULL DEFAULT 0,
  order_qty         numeric(12,3) NOT NULL DEFAULT 0,
  unit              text,
  unit_cost         numeric(10,2) NOT NULL DEFAULT 0,
  line_total        numeric(12,2) GENERATED ALWAYS AS (order_qty * unit_cost) STORED,
  supplier_name     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_guides_location
  ON ai_order_guides(location_id, forecast_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_guides_org
  ON ai_order_guides(org_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_guide_items_guide
  ON ai_order_guide_items(order_guide_id);
CREATE INDEX IF NOT EXISTS idx_order_guide_items_item
  ON ai_order_guide_items(inventory_item_id);

ALTER TABLE ai_order_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_order_guide_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_guides_select" ON ai_order_guides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_guides_insert" ON ai_order_guides
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_guides_update" ON ai_order_guides
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "order_guides_delete" ON ai_order_guides
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "order_guide_items_select" ON ai_order_guide_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_guide_items_insert" ON ai_order_guide_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_guide_items_update" ON ai_order_guide_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "order_guide_items_delete" ON ai_order_guide_items
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON ai_order_guides TO authenticated;
GRANT ALL ON ai_order_guide_items TO authenticated;


-- ─── 4. WEATHER CACHE ───────────────────────────────────────
-- Caches OpenWeatherMap forecasts per location/day

CREATE TABLE IF NOT EXISTS weather_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date    date NOT NULL,
  temperature_c    numeric(4,1),
  feels_like_c     numeric(4,1),
  condition        text,
  condition_detail text,
  icon_code        text,
  humidity_pct     int,
  wind_speed_ms    numeric(5,1),
  rain_mm          numeric(5,1) DEFAULT 0,
  sales_multiplier numeric(4,2) NOT NULL DEFAULT 1.00,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_location_date
  ON weather_cache(location_id, forecast_date);

ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_select" ON weather_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "weather_insert" ON weather_cache
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "weather_update" ON weather_cache
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON weather_cache TO authenticated;


-- ─── 5. EMPLOYEE REVIEWS ────────────────────────────────────
-- Performance reviews with category ratings

CREATE TABLE IF NOT EXISTS employee_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id   uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  review_date   date NOT NULL DEFAULT CURRENT_DATE,
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  categories    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. { "punctuality": 4, "teamwork": 5, "quality": 3, "initiative": 4, "attitude": 5 }
  strengths     text,
  improvements  text,
  goals         text,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','acknowledged')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_employee
  ON employee_reviews(employee_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_org
  ON employee_reviews(org_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_location
  ON employee_reviews(location_id, review_date DESC);

ALTER TABLE employee_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON employee_reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert" ON employee_reviews
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reviews_update" ON employee_reviews
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reviews_delete" ON employee_reviews
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON employee_reviews TO authenticated;
