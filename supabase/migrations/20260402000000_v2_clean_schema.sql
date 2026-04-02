-- =============================================================================
-- JOSEPHINE DB v2 — CLEAN SCHEMA
-- Generated: 2026-04-02
-- Architecture: Nory-inspired, 5-domain model
-- Contract: All view/RPC names match frontend (rpc-contracts.ts, types.ts)
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- §0  EXTENSIONS & SCHEMAS
-- ═══════════════════════════════════════════════════════════════════════════
-- Extensions (pg_cron is managed by Supabase platform, not via migrations)
CREATE SCHEMA IF NOT EXISTS ops;


-- ═══════════════════════════════════════════════════════════════════════════
-- §1  ENUMS
-- ═══════════════════════════════════════════════════════════════════════════
DO $$ BEGIN CREATE TYPE org_role AS ENUM ('owner','manager','employee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE integration_provider AS ENUM ('square','toast','lightspeed','clover','demo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stock_movement_type AS ENUM ('purchase','waste','sale_estimate','adjustment','transfer','return'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE budget_status AS ENUM ('draft','published','frozen','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2  CORE DOMAIN
-- ═══════════════════════════════════════════════════════════════════════════

-- groups (legacy name for orgs — kept for FK compatibility)
CREATE TABLE IF NOT EXISTS groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE,
  plan       text DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  full_name  text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- org_memberships
CREATE TABLE IF NOT EXISTS org_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- org_settings
CREATE TABLE IF NOT EXISTS org_settings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  data_source_mode          text DEFAULT 'auto',
  demo_fallback_after_hours int DEFAULT 24,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- locations
CREATE TABLE IF NOT EXISTS locations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Legacy alias (some queries use group_id)
  group_id         uuid,
  name             text NOT NULL,
  address          text,
  timezone         text DEFAULT 'Europe/Madrid',
  latitude         double precision,
  longitude        double precision,
  geofence_radius_m int NOT NULL DEFAULT 200,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- location_memberships
CREATE TABLE IF NOT EXISTS location_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'employee',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id)
);

-- location_settings
CREATE TABLE IF NOT EXISTS location_settings (
  location_id         uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  target_col_percent  numeric DEFAULT 30,
  splh_goal           numeric DEFAULT 50,
  default_hourly_cost numeric DEFAULT 14.50,
  default_cogs_pct    numeric DEFAULT 28,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- legal_entities (for payroll)
CREATE TABLE IF NOT EXISTS legal_entities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name       text NOT NULL,
  cif        text,
  iban       text,
  bic        text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §3  INTEGRATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  provider    text NOT NULL DEFAULT 'square',
  status      text NOT NULL DEFAULT 'inactive',
  is_enabled  boolean DEFAULT true,
  credentials jsonb DEFAULT '{}'::jsonb,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id      uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  account_name        text,
  metadata            jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id, external_account_id)
);

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'running',
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  records_synced  int DEFAULT 0,
  error_message   text
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §4  SALES DOMAIN
-- ═══════════════════════════════════════════════════════════════════════════

-- Products / Menu items (canonical)
CREATE TABLE IF NOT EXISTS menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text DEFAULT 'Other',
  selling_price numeric DEFAULT 0,
  vat_rate      numeric DEFAULT 10,
  is_active     boolean DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- CDM Items (POS-synced product catalog)
CREATE TABLE IF NOT EXISTS cdm_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text DEFAULT 'Other',
  external_id text,
  is_active   boolean DEFAULT true,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- CDM Orders (POS orders, also used for demo)
CREATE TABLE IF NOT EXISTS cdm_orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id            uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  external_id            text,
  opened_at              timestamptz,
  closed_at              timestamptz,
  net_sales              numeric DEFAULT 0,
  gross_sales            numeric DEFAULT 0,
  tax                    numeric DEFAULT 0,
  tips                   numeric DEFAULT 0,
  discounts              numeric DEFAULT 0,
  comps                  numeric DEFAULT 0,
  voids                  numeric DEFAULT 0,
  refunds                numeric DEFAULT 0,
  payments_total         numeric DEFAULT 0,
  provider               text,
  integration_account_id uuid REFERENCES integration_accounts(id),
  metadata               jsonb DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- CDM Order Lines
CREATE TABLE IF NOT EXISTS cdm_order_lines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  order_id               uuid NOT NULL REFERENCES cdm_orders(id) ON DELETE CASCADE,
  item_id                uuid,
  name                   text,
  qty                    numeric DEFAULT 1,
  gross                  numeric DEFAULT 0,
  net                    numeric DEFAULT 0,
  discount               numeric DEFAULT 0,
  tax                    numeric DEFAULT 0,
  provider               text,
  integration_account_id uuid REFERENCES integration_accounts(id),
  metadata               jsonb DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Daily Sales (aggregated, source of truth for views)
CREATE TABLE IF NOT EXISTS daily_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day            date NOT NULL,
  net_sales      numeric NOT NULL DEFAULT 0,
  gross_sales    numeric DEFAULT 0,
  orders_count   integer NOT NULL DEFAULT 0,
  covers         integer DEFAULT 0,
  payments_total numeric DEFAULT 0,
  payments_cash  numeric DEFAULT 0,
  payments_card  numeric DEFAULT 0,
  payments_other numeric DEFAULT 0,
  refunds        numeric DEFAULT 0,
  discounts      numeric DEFAULT 0,
  comps          numeric DEFAULT 0,
  voids          numeric DEFAULT 0,
  data_source    text DEFAULT 'demo',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_id, day)
);

-- POS Daily Finance (legacy, kept for backward compat with some views)
CREATE TABLE IF NOT EXISTS pos_daily_finance (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date NOT NULL,
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  net_sales        numeric DEFAULT 0,
  gross_sales      numeric DEFAULT 0,
  orders_count     integer DEFAULT 0,
  payments_cash    numeric DEFAULT 0,
  payments_card    numeric DEFAULT 0,
  payments_other   numeric DEFAULT 0,
  refunds_amount   numeric DEFAULT 0,
  refunds_count    integer DEFAULT 0,
  discounts_amount numeric DEFAULT 0,
  comps_amount     numeric DEFAULT 0,
  voids_amount     numeric DEFAULT 0,
  data_source      text DEFAULT 'demo',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_id, data_source)
);

-- Hourly Sales (optional, for hourly breakdowns)
CREATE TABLE IF NOT EXISTS sales_hourly_raw (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day          date NOT NULL,
  hour_of_day  int NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  net_sales    numeric DEFAULT 0,
  orders_count integer DEFAULT 0,
  covers       integer DEFAULT 0,
  data_source  text DEFAULT 'demo',
  UNIQUE(org_id, location_id, day, hour_of_day, data_source)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §5  WORKFORCE DOMAIN
-- ═══════════════════════════════════════════════════════════════════════════

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id      uuid REFERENCES locations(id) ON DELETE SET NULL,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name        text NOT NULL,
  email            text,
  role_name        text DEFAULT 'Staff',
  hourly_cost      numeric DEFAULT 0,
  contracted_hours numeric DEFAULT 40,
  status           text DEFAULT 'active',
  active           boolean DEFAULT true,
  hire_date        date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Employee Availability
CREATE TABLE IF NOT EXISTS employee_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week  int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time,
  end_time     time,
  is_available boolean DEFAULT true,
  UNIQUE(employee_id, location_id, day_of_week)
);

-- Employee Contracts (for payroll)
CREATE TABLE IF NOT EXISTS employee_contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES locations(id),
  contract_type   text DEFAULT 'indefinido',
  start_date      date,
  end_date        date,
  gross_monthly   numeric DEFAULT 0,
  ss_number       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Schedules (weekly)
CREATE TABLE IF NOT EXISTS schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, week_start)
);

-- Shifts (within a schedule)
CREATE TABLE IF NOT EXISTS shifts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id         uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  start_at            timestamptz NOT NULL,
  end_at              timestamptz NOT NULL,
  required_headcount  int DEFAULT 1,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Shift Assignments (pivot: shift ↔ employee)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE(shift_id, employee_id)
);

-- Planned Shifts (denormalized for fast queries — used by many RPCs)
CREATE TABLE IF NOT EXISTS planned_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_date    date NOT NULL,
  start_time    text,
  end_time      text,
  planned_hours numeric NOT NULL DEFAULT 0,
  role_name     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Time Entries (real clocked hours)
CREATE TABLE IF NOT EXISTS time_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in    timestamptz NOT NULL,
  clock_out   timestamptz,
  source      text DEFAULT 'app',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Employee Clock Records (geofenced entries)
CREATE TABLE IF NOT EXISTS employee_clock_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  clock_in      timestamptz NOT NULL DEFAULT now(),
  clock_out     timestamptz,
  clock_in_lat  double precision,
  clock_in_lng  double precision,
  clock_out_lat double precision,
  clock_out_lng double precision,
  source        text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','geo','kiosk','api')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Employee Breaks
CREATE TABLE IF NOT EXISTS employee_breaks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_record_id uuid NOT NULL REFERENCES employee_clock_records(id) ON DELETE CASCADE,
  break_start     timestamptz NOT NULL DEFAULT now(),
  break_end       timestamptz,
  break_type      text NOT NULL DEFAULT 'unpaid' CHECK (break_type IN ('paid','unpaid','meal')),
  duration_minutes int,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Labour Daily (aggregated labour costs per day/location)
CREATE TABLE IF NOT EXISTS labour_daily (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  labour_cost  numeric DEFAULT 0,
  labour_hours numeric DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Payroll
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES legal_entities(id),
  period_year     int NOT NULL,
  period_month    int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          text NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(legal_entity_id, period_year, period_month)
);

CREATE TABLE IF NOT EXISTS payslips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id  uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_pay       numeric DEFAULT 0,
  net_pay         numeric DEFAULT 0,
  irpf_withheld   numeric DEFAULT 0,
  employee_ss     numeric DEFAULT 0,
  employer_ss     numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payslip_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id  uuid NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  concept_code text NOT NULL,
  description text,
  amount      numeric NOT NULL DEFAULT 0,
  type        text NOT NULL DEFAULT 'earning'
);

-- Labour Rules (configurable thresholds)
CREATE TABLE IF NOT EXISTS labour_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid,
  rule_key    text NOT NULL,
  rule_value  numeric NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, rule_key)
);

-- Labour Alerts
CREATE TABLE IF NOT EXISTS labour_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  alert_type  text NOT NULL CHECK (alert_type IN (
    'overtime_warning','overtime_breach','rest_violation',
    'max_hours_warning','schedule_drift','cost_anomaly')),
  severity    text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message     text NOT NULL,
  details     jsonb DEFAULT '{}'::jsonb,
  is_read     boolean DEFAULT false,
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Compliance Tokens
CREATE TABLE IF NOT EXISTS compliance_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id uuid NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('tgss','aeat','sepe','other')),
  certificate_ref text,
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Employee Reviews
CREATE TABLE IF NOT EXISTS employee_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  employee_id    uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id    uuid NOT NULL,
  location_id    uuid REFERENCES locations(id) ON DELETE SET NULL,
  review_date    date NOT NULL DEFAULT CURRENT_DATE,
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  categories     jsonb NOT NULL DEFAULT '{}'::jsonb,
  strengths      text,
  improvements   text,
  goals          text,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Training Records
CREATE TABLE IF NOT EXISTS training_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_name    text NOT NULL,
  cert_type    text NOT NULL DEFAULT 'food_safety' CHECK (cert_type IN ('food_safety','alcohol','first_aid','fire','allergen','haccp','custom')),
  issued_date  date,
  expiry_date  date,
  status       text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expiring','expired','pending')),
  document_url text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Tips
CREATE TABLE IF NOT EXISTS tip_distribution_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  rule_name       text NOT NULL DEFAULT 'default',
  method          text NOT NULL DEFAULT 'hours_worked' CHECK (method IN ('hours_worked','equal_split','role_weighted','custom')),
  pool_percentage numeric(5,2) NOT NULL DEFAULT 100.00 CHECK (pool_percentage BETWEEN 0 AND 100),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, rule_name)
);

CREATE TABLE IF NOT EXISTS tip_role_weights (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id   uuid NOT NULL REFERENCES tip_distribution_rules(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  weight    numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  UNIQUE(rule_id, role_name)
);

CREATE TABLE IF NOT EXISTS tip_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date        date NOT NULL,
  total_tips  numeric(10,2) NOT NULL DEFAULT 0,
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','pos_import')),
  notes       text,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, date)
);

CREATE TABLE IF NOT EXISTS tip_distributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_entry_id  uuid NOT NULL REFERENCES tip_entries(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL,
  employee_name text,
  role_name     text,
  hours_worked  numeric(5,2) DEFAULT 0,
  weight        numeric(5,2) DEFAULT 1.0,
  share_amount  numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §6  INVENTORY & COST DOMAIN
-- ═══════════════════════════════════════════════════════════════════════════

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Legacy alias
  group_id      uuid,
  category_id   uuid REFERENCES inventory_categories(id) ON DELETE SET NULL,
  name          text NOT NULL,
  category      text DEFAULT 'Other',
  category_name text DEFAULT 'Other',
  unit          text DEFAULT 'unidad',
  order_unit    text,
  order_unit_qty numeric DEFAULT 1,
  par_level     numeric DEFAULT 0,
  last_cost     numeric DEFAULT 0,
  price         numeric,
  current_stock numeric DEFAULT 0,
  vat_rate      numeric DEFAULT 10,
  type          text DEFAULT 'Food',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Inventory Item Location (per-location stock levels)
CREATE TABLE IF NOT EXISTS inventory_item_location (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  on_hand       numeric DEFAULT 0,
  reorder_point numeric DEFAULT 0,
  safety_stock  numeric DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(item_id, location_id)
);

-- Recipes (Escandallos)
CREATE TABLE IF NOT EXISTS recipes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  menu_item_name text NOT NULL,
  selling_price  numeric,
  category       text DEFAULT 'Main',
  yield_qty      numeric DEFAULT 1,
  yield_unit     text DEFAULT 'portion',
  is_sub_recipe  boolean DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         uuid REFERENCES recipes(id) ON DELETE CASCADE,
  menu_item_id      uuid REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  sub_recipe_id     uuid REFERENCES recipes(id) ON DELETE CASCADE,
  quantity          numeric DEFAULT 0,
  qty_gross         numeric DEFAULT 0,
  qty_net           numeric DEFAULT 0,
  qty_base_units    numeric DEFAULT 0,
  unit              text DEFAULT 'kg',
  yield_pct         numeric DEFAULT 100,
  sort_order        integer DEFAULT 0
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_id       uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  -- Legacy alias
  inventory_item_id uuid,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','waste','sale_estimate','adjustment','transfer','return')),
  qty_delta     numeric NOT NULL DEFAULT 0,
  unit_cost     numeric DEFAULT 0,
  reason        text,
  source_ref    text,
  reference_id  uuid,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- Waste Events
CREATE TABLE IF NOT EXISTS waste_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid,
  location_id       uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  quantity          numeric DEFAULT 0,
  waste_value       numeric DEFAULT 0,
  reason            text,
  notes             text,
  logged_by         uuid,
  created_at        timestamptz DEFAULT now()
);

-- Stock Counts
CREATE TABLE IF NOT EXISTS stock_counts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id    uuid NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL,
  opening_qty       numeric DEFAULT 0,
  deliveries_qty    numeric DEFAULT 0,
  transfers_net_qty numeric DEFAULT 0,
  closing_qty       numeric DEFAULT 0,
  used_qty          numeric DEFAULT 0,
  sales_qty         numeric DEFAULT 0,
  variance_qty      numeric DEFAULT 0,
  batch_balance     numeric DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Inventory Counts (variance tracking)
CREATE TABLE IF NOT EXISTS inventory_counts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  location_id    uuid NOT NULL REFERENCES locations(id),
  item_id        uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  counted_by     uuid,
  count_date     date NOT NULL DEFAULT CURRENT_DATE,
  stock_expected numeric NOT NULL DEFAULT 0,
  stock_actual   numeric NOT NULL DEFAULT 0,
  variance       numeric NOT NULL DEFAULT 0,
  variance_pct   numeric NOT NULL DEFAULT 0,
  unit_cost      numeric DEFAULT 0,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- Monthly Cost Entries (manual COGS)
CREATE TABLE IF NOT EXISTS monthly_cost_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid,
  location_id  text,
  period_year  int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  category     text NOT NULL CHECK (category IN ('food','beverage','packaging','supplies','other')),
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  source       text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','accounting_import')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, period_year, period_month, category)
);

-- COGS Daily (simple table replacing complex view)
CREATE TABLE IF NOT EXISTS cogs_daily (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date        date NOT NULL,
  cogs_amount numeric NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(location_id, date)
);

-- Cash Counts
CREATE TABLE IF NOT EXISTS cash_counts_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date          date NOT NULL,
  day           date,
  cash_expected numeric DEFAULT 0,
  cash_counted  numeric DEFAULT 0,
  variance      numeric DEFAULT 0,
  counted_by    uuid,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(location_id, date)
);

-- Menu Engineering Actions
CREATE TABLE IF NOT EXISTS menu_engineering_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id),
  location_id           uuid REFERENCES locations(id),
  date_from             date NOT NULL,
  date_to               date NOT NULL,
  product_id            uuid,
  action_type           text NOT NULL,
  classification        text NOT NULL,
  estimated_impact_eur  numeric,
  created_at            timestamptz DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §7  INTELLIGENCE & PLANNING DOMAIN
-- ═══════════════════════════════════════════════════════════════════════════

-- Forecast Runs
CREATE TABLE IF NOT EXISTS forecast_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  model       text DEFAULT 'ensemble_v6',
  status      text NOT NULL DEFAULT 'pending',
  started_at  timestamptz,
  finished_at timestamptz,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Forecast Points
CREATE TABLE IF NOT EXISTS forecast_points (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id  uuid NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL,
  location_id      uuid NOT NULL,
  day              date NOT NULL,
  yhat             numeric NOT NULL DEFAULT 0,
  yhat_lower       numeric DEFAULT 0,
  yhat_upper       numeric DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Forecast Daily Metrics (legacy, kept for compat)
CREATE TABLE IF NOT EXISTS forecast_daily_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                date NOT NULL,
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_sales      numeric DEFAULT 0,
  forecast_orders     integer DEFAULT 0,
  planned_labor_hours numeric DEFAULT 0,
  planned_labor_cost  numeric DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Budget Daily (FLAT — simplified from 3-table EAV)
CREATE TABLE IF NOT EXISTS budgets_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  budget_sales  numeric DEFAULT 0,
  budget_labour numeric DEFAULT 0,
  budget_cogs   numeric DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Budget Versions (kept for backward compat with some UI)
CREATE TABLE IF NOT EXISTS budget_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  location_id  uuid,
  name         text NOT NULL DEFAULT '',
  start_date   date,
  end_date     date,
  period_start date,
  period_end   date,
  scope        text DEFAULT 'org',
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','frozen','archived')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Budget Days & Metrics (kept for backward compat)
CREATE TABLE IF NOT EXISTS budget_days (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL,
  location_id       uuid,
  day               date NOT NULL,
  UNIQUE(budget_version_id, location_id, day)
);

CREATE TABLE IF NOT EXISTS budget_metrics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_day_id uuid NOT NULL REFERENCES budget_days(id) ON DELETE CASCADE,
  metric        text NOT NULL,
  value         numeric NOT NULL DEFAULT 0,
  layer         text NOT NULL DEFAULT 'final' CHECK (layer IN ('base','adjustment','final')),
  UNIQUE(budget_day_id, metric, layer)
);

CREATE TABLE IF NOT EXISTS budget_drivers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_day_id       uuid NOT NULL REFERENCES budget_days(id) ON DELETE CASCADE,
  target_covers       numeric DEFAULT 0,
  target_avg_check    numeric DEFAULT 0,
  target_cogs_pct     numeric DEFAULT 0,
  target_labour_hours numeric DEFAULT 0,
  target_hourly_rate  numeric DEFAULT 0,
  UNIQUE(budget_day_id)
);

-- Event Calendar
CREATE TABLE IF NOT EXISTS event_calendar (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  location_id       uuid REFERENCES locations(id) ON DELETE CASCADE,
  event_date        date NOT NULL,
  name              text NOT NULL,
  event_type        text NOT NULL DEFAULT 'local' CHECK (event_type IN ('holiday','sports','concert','festival','local','weather','custom')),
  impact_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  recurrence        text DEFAULT 'none' CHECK (recurrence IN ('none','yearly','monthly','weekly')),
  city              text,
  source            text DEFAULT 'manual' CHECK (source IN ('manual','api','system')),
  is_active         boolean NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Weather Cache
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


-- ═══════════════════════════════════════════════════════════════════════════
-- §8  SUPPORTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Reviews (customer)
CREATE TABLE IF NOT EXISTS reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  platform      text NOT NULL DEFAULT 'google',
  rating        numeric NOT NULL,
  review_text   text,
  sentiment     text,
  reviewer_name text,
  review_date   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid,
  title       text NOT NULL,
  body        text,
  type        text NOT NULL DEFAULT 'info',
  pinned      boolean NOT NULL DEFAULT false,
  author_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Manager Logbook
CREATE TABLE IF NOT EXISTS manager_logbook (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  shift_date  date NOT NULL DEFAULT CURRENT_DATE,
  category    text NOT NULL DEFAULT 'general' CHECK (category IN ('general','incident','staffing','inventory','maintenance','customer')),
  content     text NOT NULL,
  severity    text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  resolved    boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  user_id     uuid NOT NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  tool_calls      jsonb,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- AI Order Guides
CREATE TABLE IF NOT EXISTS ai_order_guides (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL,
  location_id          uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_start_date  date NOT NULL,
  forecast_end_date    date NOT NULL,
  generated_at         timestamptz NOT NULL DEFAULT now(),
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  total_estimated_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

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

-- Jobs (async background tasks)
CREATE TABLE IF NOT EXISTS jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type    text NOT NULL,
  org_id      uuid,
  status      text NOT NULL DEFAULT 'queued',
  priority    int DEFAULT 0,
  payload     jsonb DEFAULT '{}'::jsonb,
  provider    text,
  attempts    int DEFAULT 0,
  last_error  text,
  locked_at   timestamptz,
  finished_at timestamptz,
  run_after   timestamptz DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  user_id    uuid,
  type       text NOT NULL DEFAULT 'info',
  title      text NOT NULL,
  body       text,
  is_read    boolean DEFAULT false,
  metadata   jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ops MV Refresh Log
CREATE TABLE IF NOT EXISTS ops.mv_refresh_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  duration_ms     integer,
  views_refreshed text[],
  triggered_by    text NOT NULL DEFAULT 'manual',
  status          text NOT NULL DEFAULT 'running',
  error_message   text,
  metadata        jsonb
);
