-- ============================================================
-- PR2: Missing Write Tables & Compatibility Columns
-- Creates all tables the frontend writes to that don't exist
-- in the new DB, plus compatibility columns on existing tables.
-- Idempotent: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.
-- ============================================================

-- ############################################################
-- SECTION 0: Compatibility columns on existing tables
-- ############################################################

-- ------------------------------------------------------------
-- 0.1  profiles  — add id (generated from user_id), group_id
-- AuthContext reads: .eq('id', userId) → .select('id, group_id, full_name')
-- ------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id uuid GENERATED ALWAYS AS (user_id) STORED;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS group_id uuid;

-- Backfill group_id from org_memberships for existing profiles
UPDATE profiles p
SET group_id = om.org_id
FROM org_memberships om
WHERE p.user_id = om.user_id AND p.group_id IS NULL;

-- Trigger: when a new org_membership is created, sync group_id to profiles
CREATE OR REPLACE FUNCTION sync_profile_group_id()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles SET group_id = NEW.org_id WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_group_id ON org_memberships;
CREATE TRIGGER trg_sync_profile_group_id
AFTER INSERT ON org_memberships
FOR EACH ROW EXECUTE FUNCTION sync_profile_group_id();

-- ------------------------------------------------------------
-- 0.2  locations  — add group_id (generated from org_id), city
-- AppContext reads: .eq('group_id', groupId).eq('active', true)
-- Columns: id, name, city
-- ------------------------------------------------------------

ALTER TABLE locations ADD COLUMN IF NOT EXISTS group_id uuid GENERATED ALWAYS AS (org_id) STORED;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city text;

-- ------------------------------------------------------------
-- 0.3  employees  — add location_id, role_name, hourly_cost, active, user_id
-- Frontend writes: location_id, full_name, role_name, hourly_cost, active
-- Frontend reads: .eq('user_id', userId), .eq('location_id', locId)
-- ------------------------------------------------------------

ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_cost numeric DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id uuid GENERATED ALWAYS AS (profile_user_id) STORED;

-- ------------------------------------------------------------
-- 0.4  suppliers  — add group_id, email, integration_type, is_template
-- Frontend writes: group_id, name, email, integration_type, is_template
-- Existing table uses org_id; we sync group_id ↔ org_id via trigger
-- ------------------------------------------------------------

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS integration_type text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- Backfill group_id from org_id for existing rows
UPDATE suppliers SET group_id = org_id WHERE group_id IS NULL AND org_id IS NOT NULL;

-- Generic trigger: sync group_id ↔ org_id
CREATE OR REPLACE FUNCTION sync_group_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND NEW.org_id IS NULL THEN
    NEW.org_id := NEW.group_id;
  ELSIF NEW.org_id IS NOT NULL AND NEW.group_id IS NULL THEN
    NEW.group_id := NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_sync_group_org ON suppliers;
CREATE TRIGGER trg_suppliers_sync_group_org
BEFORE INSERT OR UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION sync_group_org_id();

-- ------------------------------------------------------------
-- 0.5  inventory_items  — add group_id, current_stock, par_level, unit, last_cost
-- Frontend reads: .eq('group_id', orgId) → id, name, unit, current_stock, par_level
-- ------------------------------------------------------------

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS current_stock numeric DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS par_level numeric DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_cost numeric DEFAULT 0;

-- Backfill group_id from org_id
UPDATE inventory_items SET group_id = org_id WHERE group_id IS NULL AND org_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_inventory_items_sync_group_org ON inventory_items;
CREATE TRIGGER trg_inventory_items_sync_group_org
BEFORE INSERT OR UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION sync_group_org_id();

-- ------------------------------------------------------------
-- 0.6  purchase_order_lines  — add inventory_item_id, quantity, unit_price
-- Frontend writes: purchase_order_id, inventory_item_id, quantity, unit_price
-- Existing columns: item_id, qty_packs, pack_price (different semantics)
-- ------------------------------------------------------------

ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS inventory_item_id uuid;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS unit_price numeric;


-- ############################################################
-- SECTION 1: Legal Entities (prerequisite for payroll)
-- ############################################################

CREATE TABLE IF NOT EXISTS legal_entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  razon_social text NOT NULL DEFAULT '',
  nif         text,
  domicilio_fiscal text,
  cnae        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 2: Payroll Tables (6)
-- ############################################################

-- ------------------------------------------------------------
-- 2.1  payroll_runs
-- Operations: INSERT, SELECT, UPDATE, DELETE
-- Columns: group_id, legal_entity_id, period_year, period_month,
--          status, approved_at, approved_by
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES legal_entities(id),
  period_year     integer NOT NULL,
  period_month    integer NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  approved_at     timestamptz,
  approved_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.2  payslips
-- Operations: SELECT, DELETE
-- Columns: payroll_run_id, employee_id, gross_pay, net_pay,
--          irpf_withheld, employee_ss, employer_ss, other_deductions
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payslips (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id   uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_pay        numeric NOT NULL DEFAULT 0,
  net_pay          numeric NOT NULL DEFAULT 0,
  irpf_withheld    numeric NOT NULL DEFAULT 0,
  employee_ss      numeric NOT NULL DEFAULT 0,
  employer_ss      numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.3  compliance_submissions
-- Operations: DELETE only (.eq('payroll_run_id', runId))
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  submission_type text,
  status         text DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.4  payroll_inputs
-- Operations: SELECT, UPSERT (onConflict: employee_id,period_year,period_month)
-- Columns: employee_id, period_year, period_month, hours_regular,
--          hours_night, hours_holiday, hours_overtime, bonuses_json, deductions_json
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_inputs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_year     integer NOT NULL,
  period_month    integer NOT NULL,
  hours_regular   numeric DEFAULT 0,
  hours_night     numeric DEFAULT 0,
  hours_holiday   numeric DEFAULT 0,
  hours_overtime  numeric DEFAULT 0,
  bonuses_json    jsonb DEFAULT '[]'::jsonb,
  deductions_json jsonb DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_year, period_month)
);

-- ------------------------------------------------------------
-- 2.5  employment_contracts
-- Operations: SELECT
-- Columns: employee_id, jornada_pct, active, legal_entity_id
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employment_contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  jornada_pct     numeric DEFAULT 100,
  active          boolean DEFAULT true,
  legal_entity_id uuid REFERENCES legal_entities(id),
  contract_type   text,
  base_salary_monthly numeric,
  hourly_rate     numeric,
  irpf_rate       numeric,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.6  employee_legal
-- Operations: SELECT
-- Columns: employee_id, nif, nss, iban, legal_entity_id
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_legal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  nif             text,
  nss             text,
  iban            text,
  legal_entity_id uuid REFERENCES legal_entities(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 3: Settings Tables (2)
-- ############################################################

-- ------------------------------------------------------------
-- 3.1  location_settings
-- Operations: INSERT, SELECT
-- Columns: location_id, target_gp_percent, target_col_percent,
--          default_cogs_percent, default_hourly_cost, opening_time,
--          closing_time, splh_goal, timezone, currency,
--          target_gp_pct, target_col_pct
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS location_settings (
  location_id         uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  target_gp_percent   numeric DEFAULT 70,
  target_col_percent  numeric DEFAULT 28,
  target_gp_pct       numeric DEFAULT 70,
  target_col_pct      numeric DEFAULT 28,
  default_cogs_percent numeric DEFAULT 30,
  default_hourly_cost numeric DEFAULT 14.50,
  opening_time        time DEFAULT '08:00',
  closing_time        time DEFAULT '23:00',
  splh_goal           numeric DEFAULT 60,
  timezone            text DEFAULT 'Europe/Madrid',
  currency            text DEFAULT 'EUR',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.2  payroll_location_settings
-- Operations: INSERT, SELECT
-- Columns: location_id + Spanish social security contribution rates
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_location_settings (
  location_id                    uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  contingencias_comunes_employer numeric DEFAULT 23.60,
  desempleo_employer_indefinido  numeric DEFAULT 5.50,
  desempleo_employer_temporal    numeric DEFAULT 6.70,
  fogasa_employer                numeric DEFAULT 0.20,
  formacion_employer             numeric DEFAULT 0.60,
  mei_employer                   numeric DEFAULT 0.58,
  accident_rate_employer         numeric DEFAULT 1.50,
  irpf_employee                  numeric DEFAULT 15.00,
  contingencias_comunes_employee numeric DEFAULT 4.70,
  desempleo_employee             numeric DEFAULT 1.55,
  formacion_employee             numeric DEFAULT 0.10,
  mei_employee                   numeric DEFAULT 0.12,
  payments_per_year              integer DEFAULT 14,
  created_at                     timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 4: POS Tables (3)
-- ############################################################

-- ------------------------------------------------------------
-- 4.1  products
-- Operations: INSERT, SELECT
-- Columns: name, category, price, cost_price, location_id, group_id,
--          is_active, kds_destination, target_prep_time
-- Note: New DB uses menu_items for CDM. This table is for
--       template products in location setup/onboarding.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid REFERENCES locations(id) ON DELETE CASCADE,
  group_id        uuid REFERENCES orgs(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text,
  price           numeric DEFAULT 0,
  cost_price      numeric DEFAULT 0,
  is_active       boolean DEFAULT true,
  kds_destination text,
  target_prep_time integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4.2  pos_floor_maps
-- Operations: INSERT, SELECT
-- Columns: location_id, name, config_json, is_active
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pos_floor_maps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Main Floor',
  config_json jsonb DEFAULT '{}'::jsonb,
  is_active   boolean DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4.3  pos_tables
-- Operations: INSERT, SELECT
-- Columns: floor_map_id, table_number, seats, position_x, position_y,
--          shape, width, height, status
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pos_tables (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_map_id uuid NOT NULL REFERENCES pos_floor_maps(id) ON DELETE CASCADE,
  table_number integer NOT NULL DEFAULT 1,
  seats        integer DEFAULT 4,
  position_x   numeric DEFAULT 0,
  position_y   numeric DEFAULT 0,
  shape        text DEFAULT 'square',
  width        numeric DEFAULT 80,
  height       numeric DEFAULT 80,
  status       text DEFAULT 'available',
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 5: Team / Auth (1)
-- ############################################################

-- ------------------------------------------------------------
-- 5.1  user_roles
-- Operations: INSERT
-- Columns: user_id, role_id, location_id
-- Note: New DB uses org_memberships + location_memberships.
--       This table is written by OnboardingWizard for legacy compat.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  role_id     uuid REFERENCES roles(id),
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 6: Waste (1)
-- ############################################################

-- ------------------------------------------------------------
-- 6.1  waste_events
-- Operations: INSERT
-- Columns: inventory_item_id, location_id, quantity, reason, waste_value
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS waste_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id),
  location_id       uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity          numeric NOT NULL DEFAULT 0,
  reason            text,
  waste_value       numeric DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 7: Loyalty (4)
-- ############################################################

-- ------------------------------------------------------------
-- 7.1  loyalty_settings
-- Operations: SELECT, UPSERT
-- Columns: group_id, is_enabled, points_per_euro, welcome_bonus, tier_rules
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  is_enabled     boolean DEFAULT false,
  points_per_euro numeric DEFAULT 1,
  welcome_bonus  integer DEFAULT 0,
  tier_rules     jsonb DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7.2  loyalty_members
-- Operations: INSERT, SELECT, UPDATE, DELETE
-- Columns: group_id, name, email, phone, notes, points_balance,
--          lifetime_points, tier
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  email           text,
  phone           text,
  notes           text,
  points_balance  integer DEFAULT 0,
  lifetime_points integer DEFAULT 0,
  tier            text DEFAULT 'bronze',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7.3  loyalty_rewards
-- Operations: INSERT, SELECT, UPDATE, DELETE
-- Columns: group_id, name, description, points_cost, reward_type,
--          value, product_id, is_active, max_redemptions,
--          current_redemptions, valid_from, valid_until
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT '',
  description         text,
  points_cost         integer NOT NULL DEFAULT 0,
  reward_type         text DEFAULT 'discount',
  value               numeric DEFAULT 0,
  product_id          uuid REFERENCES products(id),
  is_active           boolean DEFAULT true,
  max_redemptions     integer,
  current_redemptions integer DEFAULT 0,
  valid_from          date,
  valid_until         date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7.4  loyalty_transactions
-- Operations: INSERT, SELECT
-- Columns: member_id, location_id, ticket_id, points, type, description
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  ticket_id   uuid,
  points      integer NOT NULL DEFAULT 0,
  type        text NOT NULL DEFAULT 'earn',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 8: DemoDataManager + Functional Stub Tables (9)
-- These tables are deleted by DemoDataManager and read by
-- various modules (scheduling, budgets, cash, payroll).
-- ############################################################

-- ------------------------------------------------------------
-- 8.1  pos_daily_finance
-- Read: SettingsPage (data export, SELECT * .eq('data_source',...))
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pos_daily_finance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL,
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  net_sales       numeric DEFAULT 0,
  gross_sales     numeric DEFAULT 0,
  orders_count    integer DEFAULT 0,
  payments_cash   numeric DEFAULT 0,
  payments_card   numeric DEFAULT 0,
  payments_other  numeric DEFAULT 0,
  refunds_amount  numeric DEFAULT 0,
  refunds_count   integer DEFAULT 0,
  discounts_amount numeric DEFAULT 0,
  comps_amount    numeric DEFAULT 0,
  voids_amount    numeric DEFAULT 0,
  data_source     text DEFAULT 'simulated',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.2  pos_daily_metrics
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pos_daily_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  net_sales   numeric DEFAULT 0,
  orders      integer DEFAULT 0,
  labor_hours numeric DEFAULT 0,
  labor_cost  numeric DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.3  labour_daily
-- Read: useBudgetsData (date, location_id, labour_cost, labour_hours)
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS labour_daily (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  labour_cost  numeric DEFAULT 0,
  labour_hours numeric DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.4  forecast_daily_metrics
-- Read: useSchedulingSupabase (count check)
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS forecast_daily_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                date NOT NULL,
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_sales      numeric DEFAULT 0,
  forecast_orders     integer DEFAULT 0,
  planned_labor_hours numeric DEFAULT 0,
  planned_labor_cost  numeric DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.5  budgets_daily
-- Read: useBudgetsData (date, location_id, budget_sales, budget_labour, budget_cogs)
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS budgets_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  budget_sales  numeric DEFAULT 0,
  budget_labour numeric DEFAULT 0,
  budget_cogs   numeric DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.6  cash_counts_daily
-- Read: useCashManagementData (SELECT *)
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cash_counts_daily (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  cash_counted numeric DEFAULT 0,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.7  tickets
-- Delete: DemoDataManager
-- Also referenced by loyalty_transactions.ticket_id
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  external_id    text,
  opened_at      timestamptz,
  closed_at      timestamptz,
  status         text DEFAULT 'open',
  covers         integer DEFAULT 0,
  table_name     text,
  channel        text,
  gross_total    numeric DEFAULT 0,
  net_total      numeric DEFAULT 0,
  tax_total      numeric DEFAULT 0,
  discount_total numeric DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.8  timesheets
-- Read: PayrollInputs (employee_id, minutes, clock_in WHERE approved)
--       PayrollValidate (id WHERE approved=false)
-- Delete: DemoDataManager
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS timesheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  clock_in    timestamptz,
  clock_out   timestamptz,
  minutes     numeric DEFAULT 0,
  labor_cost  numeric DEFAULT 0,
  approved    boolean DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8.9  planned_shifts
-- Read: useSchedulingSupabase, TeamPay, TeamHome, TeamSchedule
-- Write: useSchedulingSupabase (UPDATE status)
-- Delete: DemoDataManager
-- Columns: employee_id, location_id, shift_date, start_time, end_time,
--          planned_hours, planned_cost, role, status
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS planned_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  shift_date    date NOT NULL,
  start_time    time,
  end_time      time,
  planned_hours numeric DEFAULT 0,
  planned_cost  numeric DEFAULT 0,
  role          text,
  status        text DEFAULT 'draft',
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ############################################################
-- SECTION 9: Indexes
-- ############################################################

-- Payroll
CREATE INDEX IF NOT EXISTS idx_payroll_runs_legal_entity
  ON payroll_runs (legal_entity_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_payslips_run
  ON payslips (payroll_run_id);

CREATE INDEX IF NOT EXISTS idx_payroll_inputs_employee_period
  ON payroll_inputs (employee_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_employment_contracts_employee
  ON employment_contracts (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_legal_employee
  ON employee_legal (employee_id);

CREATE INDEX IF NOT EXISTS idx_compliance_submissions_run
  ON compliance_submissions (payroll_run_id);

-- Settings
CREATE INDEX IF NOT EXISTS idx_location_settings_loc
  ON location_settings (location_id);

-- POS
CREATE INDEX IF NOT EXISTS idx_products_location
  ON products (location_id);

CREATE INDEX IF NOT EXISTS idx_pos_floor_maps_location
  ON pos_floor_maps (location_id);

CREATE INDEX IF NOT EXISTS idx_pos_tables_floor_map
  ON pos_tables (floor_map_id);

-- Waste
CREATE INDEX IF NOT EXISTS idx_waste_events_location
  ON waste_events (location_id, created_at);

-- Loyalty
CREATE INDEX IF NOT EXISTS idx_loyalty_settings_group
  ON loyalty_settings (group_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_group
  ON loyalty_members (group_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_group
  ON loyalty_rewards (group_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member
  ON loyalty_transactions (member_id, created_at DESC);

-- DemoDataManager stubs
CREATE INDEX IF NOT EXISTS idx_pos_daily_finance_loc_date
  ON pos_daily_finance (location_id, date);

CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_loc_date
  ON pos_daily_metrics (location_id, date);

CREATE INDEX IF NOT EXISTS idx_labour_daily_loc_date
  ON labour_daily (location_id, date);

CREATE INDEX IF NOT EXISTS idx_forecast_daily_metrics_loc_date
  ON forecast_daily_metrics (location_id, date);

CREATE INDEX IF NOT EXISTS idx_budgets_daily_loc_date
  ON budgets_daily (location_id, date);

CREATE INDEX IF NOT EXISTS idx_cash_counts_daily_loc_date
  ON cash_counts_daily (location_id, date);

CREATE INDEX IF NOT EXISTS idx_tickets_location
  ON tickets (location_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_employee_clockin
  ON timesheets (employee_id, clock_in);

CREATE INDEX IF NOT EXISTS idx_timesheets_location
  ON timesheets (location_id);

CREATE INDEX IF NOT EXISTS idx_planned_shifts_employee_date
  ON planned_shifts (employee_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_planned_shifts_location_date
  ON planned_shifts (location_id, shift_date);

-- Existing tables: new compatibility columns
CREATE INDEX IF NOT EXISTS idx_employees_location
  ON employees (location_id);

CREATE INDEX IF NOT EXISTS idx_employees_user_id
  ON employees (user_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_group_id
  ON suppliers (group_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_group_id
  ON inventory_items (group_id);


-- ############################################################
-- SECTION 10: GRANTs for PostgREST access
-- ############################################################

GRANT ALL ON legal_entities TO authenticated;
GRANT ALL ON payroll_runs TO authenticated;
GRANT ALL ON payslips TO authenticated;
GRANT ALL ON compliance_submissions TO authenticated;
GRANT ALL ON payroll_inputs TO authenticated;
GRANT ALL ON employment_contracts TO authenticated;
GRANT ALL ON employee_legal TO authenticated;
GRANT ALL ON location_settings TO authenticated;
GRANT ALL ON payroll_location_settings TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON pos_floor_maps TO authenticated;
GRANT ALL ON pos_tables TO authenticated;
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON waste_events TO authenticated;
GRANT ALL ON loyalty_settings TO authenticated;
GRANT ALL ON loyalty_members TO authenticated;
GRANT ALL ON loyalty_rewards TO authenticated;
GRANT ALL ON loyalty_transactions TO authenticated;
GRANT ALL ON pos_daily_finance TO authenticated;
GRANT ALL ON pos_daily_metrics TO authenticated;
GRANT ALL ON labour_daily TO authenticated;
GRANT ALL ON forecast_daily_metrics TO authenticated;
GRANT ALL ON budgets_daily TO authenticated;
GRANT ALL ON cash_counts_daily TO authenticated;
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON timesheets TO authenticated;
GRANT ALL ON planned_shifts TO authenticated;

GRANT SELECT ON legal_entities TO anon;
GRANT SELECT ON payroll_runs TO anon;
GRANT SELECT ON payslips TO anon;
GRANT SELECT ON location_settings TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON pos_floor_maps TO anon;
GRANT SELECT ON pos_tables TO anon;
GRANT SELECT ON loyalty_settings TO anon;
GRANT SELECT ON loyalty_members TO anon;
GRANT SELECT ON loyalty_rewards TO anon;
GRANT SELECT ON loyalty_transactions TO anon;
GRANT SELECT ON pos_daily_finance TO anon;
GRANT SELECT ON budgets_daily TO anon;
GRANT SELECT ON labour_daily TO anon;
GRANT SELECT ON forecast_daily_metrics TO anon;
GRANT SELECT ON cash_counts_daily TO anon;
GRANT SELECT ON tickets TO anon;
GRANT SELECT ON timesheets TO anon;
GRANT SELECT ON planned_shifts TO anon;
