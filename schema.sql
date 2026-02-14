-- ============================================================
-- SCHEMA DUMP: Josephine App — Supabase PostgreSQL
-- Source: PostgREST OpenAPI spec (live database)
-- Generated: 2026-02-14
-- Total tables/views: 106
-- Total RPC functions: 0
-- ============================================================


-- ============================================================
-- CORE / MULTI-TENANT
-- ============================================================

CREATE TABLE groups (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  name                                     text NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE locations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  name                                     text NOT NULL,
  city                                     text,
  timezone                                 text,
  currency                                 text,
  created_at                               timestamptz NOT NULL,
  active                                   boolean
);

CREATE TABLE profiles (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  full_name                                text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE location_settings (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  target_gp_percent                        numeric,
  target_col_percent                       numeric,
  default_cogs_percent                     numeric,
  created_at                               timestamptz NOT NULL,
  default_hourly_cost                      numeric,
  tables_count                             integer,
  service_type                             text,
  opening_time                             time,
  closing_time                             time,
  closed_days                              integer[],
  day_parts                                jsonb,
  splh_goal                                numeric,
  average_check_size                       numeric,
  min_rest_hours                           numeric,
  max_hours_per_day                        numeric,
  staffing_ratios                          jsonb,
  hourly_demand_curve                      jsonb
);

CREATE TABLE org_settings (
  org_id                                   uuid NOT NULL,
  data_source_mode                         text NOT NULL,
  manual_data_source                       text,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE location_hours (
  location_id                              uuid NOT NULL,
  tz                                       text NOT NULL,
  open_time                                time NOT NULL,
  close_time                               time NOT NULL,
  prep_start                               time NOT NULL,
  prep_end                                 time NOT NULL,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);


-- ============================================================
-- AUTH & RBAC
-- ============================================================

CREATE TABLE roles (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  name                                     text NOT NULL,
  description                              text,
  is_system                                boolean,
  created_at                               timestamptz
);

CREATE TABLE permissions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  key                                      text NOT NULL,
  module                                   text NOT NULL,
  description                              text,
  created_at                               timestamptz
);

CREATE TABLE role_permissions (
  role_id                                  uuid NOT NULL,
  permission_id                            uuid NOT NULL
);

CREATE TABLE user_roles (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  user_id                                  uuid NOT NULL,
  role_id                                  uuid  -- Note:
This is a Foreign Key to `roles.id`.<fk table='roles' column='id'/>,
  location_id                              uuid
);

CREATE TABLE user_locations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  user_id                                  uuid NOT NULL,
  location_id                              uuid NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE email_otp_codes (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  email                                    text NOT NULL,
  code                                     text NOT NULL,
  expires_at                               timestamptz NOT NULL,
  verified                                 boolean,
  created_at                               timestamptz NOT NULL
);


-- ============================================================
-- CDM (Canonical Data Model)
-- ============================================================

CREATE TABLE cdm_locations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  org_id                                   uuid NOT NULL,
  name                                     text NOT NULL,
  address                                  text,
  timezone                                 text,
  external_provider                        text NOT NULL,
  external_id                              text NOT NULL,
  metadata                                 jsonb,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE cdm_items (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  org_id                                   uuid NOT NULL,
  name                                     text NOT NULL,
  sku                                      text,
  category_name                            text,
  price                                    numeric NOT NULL,
  is_active                                boolean,
  external_provider                        text NOT NULL,
  external_id                              text NOT NULL,
  metadata                                 jsonb,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE cdm_item_variations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  org_id                                   uuid NOT NULL,
  cdm_item_id                              uuid NOT NULL,
  external_provider                        text NOT NULL,
  external_variation_id                    text NOT NULL,
  variation_name                           text NOT NULL,
  sku                                      text,
  price                                    numeric,
  metadata                                 jsonb,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE cdm_location_items (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  item_id                                  uuid NOT NULL,
  price                                    numeric  -- Location-specific selling price (overrides cdm_items.price if set),
  cost_price                               numeric  -- Location-specific cost price for margin calculations,
  is_available                             boolean NOT NULL  -- Whether this item is currently available at this location,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE cdm_orders (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  org_id                                   uuid NOT NULL,
  location_id                              uuid,
  opened_at                                timestamptz NOT NULL,
  closed_at                                timestamptz,
  gross_total                              numeric NOT NULL,
  net_total                                numeric NOT NULL,
  tax_total                                numeric,
  tip_total                                numeric,
  status                                   text NOT NULL,
  source                                   text,
  external_provider                        text NOT NULL,
  external_id                              text NOT NULL,
  metadata                                 jsonb,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE cdm_order_lines (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  order_id                                 uuid NOT NULL,
  item_id                                  uuid,
  name                                     text NOT NULL,
  quantity                                 numeric NOT NULL,
  unit_price                               numeric NOT NULL,
  gross_line_total                         numeric NOT NULL,
  modifiers                                jsonb,
  notes                                    text,
  course                                   integer,
  destination                              text,
  external_id                              text,
  created_at                               timestamptz,
  updated_at                               timestamptz,
  external_variation_id                    text,
  org_id                                   uuid
);

CREATE TABLE cdm_payments (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  order_id                                 uuid NOT NULL,
  amount                                   numeric NOT NULL,
  method                                   text NOT NULL,
  status                                   text NOT NULL,
  paid_at                                  timestamptz NOT NULL,
  external_provider                        text NOT NULL,
  external_id                              text NOT NULL,
  metadata                                 jsonb,
  created_at                               timestamptz
);


-- ============================================================
-- POS & TICKETS
-- ============================================================

CREATE TABLE tickets (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  external_id                              text,
  opened_at                                timestamptz NOT NULL,
  closed_at                                timestamptz,
  status                                   text,
  covers                                   integer,
  table_name                               text,
  channel                                  text,
  gross_total                              numeric,
  net_total                                numeric,
  tax_total                                numeric,
  discount_total                           numeric,
  created_at                               timestamptz NOT NULL,
  pos_table_id                             uuid,
  server_id                                uuid,
  notes                                    text,
  service_type                             text,
  cash_session_id                          uuid,
  tip_total                                numeric  -- Total tips for this ticket across all payments
);

CREATE TABLE ticket_lines (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  ticket_id                                uuid NOT NULL  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  external_line_id                         text,
  item_external_id                         text,
  item_name                                text NOT NULL,
  category_name                            text,
  quantity                                 numeric,
  unit_price                               numeric,
  gross_line_total                         numeric,
  discount_line_total                      numeric,
  tax_rate                                 numeric,
  voided                                   boolean,
  comped                                   boolean,
  created_at                               timestamptz NOT NULL,
  notes                                    text,
  sent_to_kitchen                          boolean,
  sent_at                                  timestamptz,
  prep_status                              text,
  prep_started_at                          timestamptz,
  ready_at                                 timestamptz,
  destination                              text,
  is_rush                                  boolean  -- Priority flag for rush orders,
  product_id                               uuid,
  course                                   integer  -- Course number for multi-course meals (1=first, 2=second, etc)
);

CREATE TABLE ticket_line_modifiers (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  ticket_line_id                           uuid NOT NULL,
  modifier_name                            text NOT NULL,
  option_name                              text NOT NULL,
  price_delta                              numeric,
  created_at                               timestamptz
);

CREATE TABLE payments (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  ticket_id                                uuid NOT NULL  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  method                                   text,
  amount                                   numeric NOT NULL,
  paid_at                                  timestamptz NOT NULL,
  created_at                               timestamptz NOT NULL,
  tip_amount                               numeric  -- Tip amount included in this payment,
  stripe_payment_intent_id                 text
);

CREATE TABLE products (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid,
  name                                     text NOT NULL,
  category                                 text,
  is_active                                boolean,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  created_at                               timestamptz,
  kds_destination                          text  -- Default KDS station for this product: kitchen, bar, or prep,
  target_prep_time                         integer  -- Target preparation time in minutes. If null, uses station default.,
  price                                    numeric,
  image_url                                text,
  description                              text
);

CREATE TABLE pos_tables (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  floor_map_id                             uuid NOT NULL,
  table_number                             text NOT NULL,
  seats                                    integer NOT NULL,
  position_x                               numeric NOT NULL,
  position_y                               numeric NOT NULL,
  shape                                    text NOT NULL,
  width                                    numeric NOT NULL,
  height                                   numeric NOT NULL,
  status                                   text NOT NULL,
  current_ticket_id                        uuid  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE pos_floor_maps (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  name                                     text NOT NULL,
  config_json                              jsonb NOT NULL,
  is_active                                boolean,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE pos_cash_sessions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  opened_by                                uuid NOT NULL,
  closed_by                                uuid,
  opening_cash                             numeric NOT NULL,
  closing_cash                             numeric,
  expected_cash                            numeric,
  cash_difference                          numeric,
  opened_at                                timestamptz,
  closed_at                                timestamptz,
  notes                                    text,
  status                                   text NOT NULL
);

CREATE TABLE pos_connections (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  provider                                 text NOT NULL,
  status                                   text,
  last_sync_at                             timestamptz,
  config_json                              jsonb,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE pos_daily_finance (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  net_sales                                numeric NOT NULL,
  gross_sales                              numeric NOT NULL,
  orders_count                             numeric NOT NULL,
  payments_cash                            numeric NOT NULL,
  payments_card                            numeric NOT NULL,
  payments_other                           numeric NOT NULL,
  refunds_amount                           numeric NOT NULL,
  refunds_count                            numeric NOT NULL,
  discounts_amount                         numeric NOT NULL,
  comps_amount                             numeric NOT NULL,
  voids_amount                             numeric NOT NULL,
  created_at                               timestamptz NOT NULL,
  data_source                              text NOT NULL
);

CREATE TABLE pos_daily_metrics (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  net_sales                                numeric NOT NULL,
  orders                                   numeric NOT NULL,
  labor_hours                              numeric NOT NULL,
  labor_cost                               numeric NOT NULL,
  created_at                               timestamptz NOT NULL,
  data_source                              text NOT NULL
);

CREATE TABLE pos_product_modifiers (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  product_id                               uuid NOT NULL  -- Note:
This is a Foreign Key to `products.id`.<fk table='products' column='id'/>,
  name                                     text NOT NULL,
  modifier_type                            text NOT NULL,
  required                                 boolean,
  sort_order                               integer,
  created_at                               timestamptz
);

CREATE TABLE pos_modifier_options (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  modifier_id                              uuid NOT NULL,
  name                                     text NOT NULL,
  price_delta                              numeric,
  is_default                               boolean,
  sort_order                               integer,
  created_at                               timestamptz
);

CREATE TABLE pos_print_queue (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  ticket_id                                uuid NOT NULL  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  destination                              text NOT NULL,
  items_json                               jsonb NOT NULL,
  status                                   text NOT NULL,
  created_at                               timestamptz,
  printed_at                               timestamptz,
  acknowledged_at                          timestamptz,
  print_attempts                           integer,
  last_error                               text,
  printnode_job_id                         text
);

CREATE TABLE printer_config (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  destination                              text NOT NULL,
  printnode_printer_id                     text NOT NULL,
  printer_name                             text NOT NULL,
  is_active                                boolean,
  auto_print                               boolean,
  paper_width                              integer,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE printnode_credentials (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  api_key_encrypted                        text NOT NULL,
  is_active                                boolean,
  last_verified_at                         timestamptz,
  created_at                               timestamptz,
  updated_at                               timestamptz
);


-- ============================================================
-- FACTS / AGGREGATIONS
-- ============================================================

CREATE TABLE facts_sales_15m (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  ts_bucket                                timestamptz NOT NULL,
  sales_gross                              numeric,
  sales_net                                numeric,
  tickets                                  integer,
  covers                                   integer,
  discounts                                numeric,
  voids                                    numeric,
  comps                                    numeric,
  refunds                                  numeric,
  created_at                               timestamptz,
  updated_at                               timestamptz,
  data_source                              text NOT NULL
);

CREATE TABLE facts_item_mix_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  day                                      date NOT NULL,
  item_id                                  uuid NOT NULL,
  qty                                      numeric,
  revenue_net                              numeric,
  margin_est                               numeric,
  attach_rate                              numeric,
  created_at                               timestamptz
);

CREATE TABLE facts_labor_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  day                                      date NOT NULL,
  scheduled_hours                          numeric,
  actual_hours                             numeric,
  labor_cost_est                           numeric,
  overtime_hours                           numeric,
  headcount                                integer,
  created_at                               timestamptz
);

CREATE TABLE facts_inventory_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  day                                      date NOT NULL,
  item_id                                  uuid NOT NULL,
  stock_on_hand                            numeric,
  stock_in                                 numeric,
  stock_out                                numeric,
  waste_est                                numeric,
  stockout_flag                            boolean,
  created_at                               timestamptz
);

CREATE TABLE sales_daily_unified (
  date                                     date,
  location_id                              uuid,
  data_source                              text,
  net_sales                                numeric,
  orders_count                             numeric,
  labor_cost                               numeric,
  labor_hours                              numeric,
  gross_sales                              numeric,
  payments_cash                            numeric,
  payments_card                            numeric,
  payments_other                           numeric,
  refunds_amount                           numeric,
  refunds_count                            numeric,
  discounts_amount                         numeric,
  comps_amount                             numeric,
  voids_amount                             numeric
);

CREATE TABLE product_sales_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  product_id                               uuid NOT NULL  -- Note:
This is a Foreign Key to `products.id`.<fk table='products' column='id'/>,
  units_sold                               numeric NOT NULL,
  net_sales                                numeric NOT NULL,
  cogs                                     numeric NOT NULL,
  created_at                               timestamptz,
  data_source                              text NOT NULL
);

CREATE TABLE labour_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  labour_cost                              numeric NOT NULL,
  labour_hours                             numeric NOT NULL,
  created_at                               timestamptz NOT NULL
);


-- ============================================================
-- VIEWS (unified data source)
-- ============================================================

CREATE TABLE v_facts_sales_15m_unified (
  id                                       uuid  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid,
  ts_bucket                                timestamptz,
  sales_gross                              numeric,
  sales_net                                numeric,
  tickets                                  integer,
  covers                                   integer,
  discounts                                numeric,
  voids                                    numeric,
  comps                                    numeric,
  refunds                                  numeric,
  created_at                               timestamptz,
  updated_at                               timestamptz,
  data_source                              text,
  data_source_unified                      text
);

CREATE TABLE v_pos_daily_finance_unified (
  id                                       uuid  -- Note:
This is a Primary Key.<pk/>,
  date                                     date,
  location_id                              uuid,
  net_sales                                numeric,
  gross_sales                              numeric,
  orders_count                             numeric,
  payments_cash                            numeric,
  payments_card                            numeric,
  payments_other                           numeric,
  refunds_amount                           numeric,
  refunds_count                            numeric,
  discounts_amount                         numeric,
  comps_amount                             numeric,
  voids_amount                             numeric,
  created_at                               timestamptz,
  data_source                              text,
  data_source_unified                      text
);

CREATE TABLE v_product_sales_daily_unified (
  id                                       uuid  -- Note:
This is a Primary Key.<pk/>,
  date                                     date,
  location_id                              uuid,
  product_id                               uuid  -- Note:
This is a Foreign Key to `products.id`.<fk table='products' column='id'/>,
  units_sold                               numeric,
  net_sales                                numeric,
  cogs                                     numeric,
  created_at                               timestamptz,
  data_source                              text,
  data_source_unified                      text
);

CREATE TABLE v_stock_on_hand_by_location (
  location_id                              uuid,
  item_id                                  uuid,
  on_hand                                  numeric
);


-- ============================================================
-- AI / FORECASTING
-- ============================================================

CREATE TABLE ai_forecasts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  horizon_start                            timestamptz NOT NULL,
  horizon_end                              timestamptz NOT NULL,
  granularity                              text NOT NULL,
  metric                                   text NOT NULL,
  forecast_json                            jsonb NOT NULL,
  confidence_p50                           numeric,
  confidence_p90                           numeric,
  model_version                            text,
  method                                   text,
  created_at                               timestamptz,
  expires_at                               timestamptz
);

CREATE TABLE ai_recommendations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  type                                     text NOT NULL,
  location_id                              uuid,
  payload_json                             jsonb NOT NULL,
  rationale                                text NOT NULL,
  expected_impact                          jsonb,
  confidence                               numeric,
  status                                   text,
  created_at                               timestamptz,
  expires_at                               timestamptz
);

CREATE TABLE ai_actions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  recommendation_id                        uuid NOT NULL,
  type                                     text NOT NULL,
  execute_mode                             text NOT NULL,
  guardrails_json                          jsonb,
  status                                   text,
  executed_at                              timestamptz,
  error_text                               text,
  created_at                               timestamptz
);

CREATE TABLE ai_action_results (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  action_id                                uuid NOT NULL,
  measured_impact_json                     jsonb NOT NULL,
  before_after_json                        jsonb,
  notes                                    text,
  created_at                               timestamptz
);

CREATE TABLE forecast_daily_metrics (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  forecast_sales                           numeric NOT NULL,
  forecast_orders                          numeric NOT NULL,
  planned_labor_hours                      numeric NOT NULL,
  planned_labor_cost                       numeric NOT NULL,
  created_at                               timestamptz NOT NULL,
  model_version                            text,
  generated_at                             timestamptz,
  mse                                      numeric,
  mape                                     numeric,
  confidence                               numeric,
  data_source                              text NOT NULL
);

CREATE TABLE forecast_hourly_metrics (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  forecast_date                            date NOT NULL,
  hour_of_day                              smallint NOT NULL,
  forecast_sales                           numeric NOT NULL,
  forecast_sales_lower                     numeric,
  forecast_sales_upper                     numeric,
  forecast_orders                          numeric NOT NULL,
  forecast_covers                          numeric NOT NULL,
  model_type                               text NOT NULL,
  model_version                            text,
  generated_at                             timestamptz,
  bucket_wmape                             numeric,
  bucket_mase                              numeric,
  created_at                               timestamptz NOT NULL,
  data_source                              text NOT NULL
);

CREATE TABLE forecast_model_runs (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  generated_at                             timestamptz NOT NULL,
  model_version                            text NOT NULL,
  algorithm                                text NOT NULL,
  history_start                            date NOT NULL,
  history_end                              date NOT NULL,
  horizon_days                             integer NOT NULL,
  mse                                      numeric,
  mape                                     numeric,
  confidence                               numeric,
  data_points                              integer,
  trend_slope                              numeric,
  trend_intercept                          numeric,
  seasonality_dow                          jsonb,
  seasonality_woy                          jsonb,
  created_at                               timestamptz NOT NULL,
  data_sufficiency_level                   text NOT NULL,
  blend_ratio                              numeric,
  total_days                               integer NOT NULL,
  min_bucket_samples                       integer NOT NULL
);

CREATE TABLE forecast_model_registry (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  day_of_week                              smallint NOT NULL,
  hour_of_day                              smallint NOT NULL,
  champion_model                           text NOT NULL,
  champion_wmape                           numeric,
  champion_mase                            numeric,
  champion_bias                            numeric,
  champion_directional_acc                 numeric,
  champion_calibration                     numeric,
  challenger_model                         text,
  challenger_wmape                         numeric,
  challenger_mase                          numeric,
  training_samples                         integer,
  last_evaluated_at                        timestamptz,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz
);

CREATE TABLE procurement_suggestions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid,
  item_id                                  uuid NOT NULL,
  suggested_qty                            numeric NOT NULL,
  suggested_order_units                    numeric NOT NULL,
  current_stock                            numeric,
  forecasted_usage                         numeric,
  days_of_stock_remaining                  numeric,
  rationale                                text NOT NULL,
  urgency                                  text,
  delivery_needed_by                       date,
  estimated_cost                           numeric,
  status                                   text,
  created_at                               timestamptz,
  expires_at                               timestamptz
);


-- ============================================================
-- WORKFORCE
-- ============================================================

CREATE TABLE employees (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  external_id                              text,
  full_name                                text NOT NULL,
  role_name                                text,
  hourly_cost                              numeric,
  active                                   boolean,
  created_at                               timestamptz NOT NULL,
  user_id                                  uuid
);

CREATE TABLE employee_legal (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  legal_entity_id                          uuid NOT NULL,
  nif                                      text,
  nss                                      text,
  iban                                     text,
  domicilio                                text,
  fecha_nacimiento                         date,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE employee_payroll (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  location_id                              uuid NOT NULL,
  contract_type                            text NOT NULL,
  pay_type                                 text NOT NULL,
  gross_monthly                            numeric,
  gross_annual                             numeric,
  payments_per_year                        integer NOT NULL,
  weekly_hours                             numeric NOT NULL,
  hourly_override                          numeric,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE employee_clock_records (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  location_id                              uuid NOT NULL,
  clock_in                                 timestamptz NOT NULL,
  clock_out                                timestamptz,
  clock_in_lat                             numeric,
  clock_in_lng                             numeric,
  clock_out_lat                            numeric,
  clock_out_lng                            numeric,
  source                                   text NOT NULL,
  notes                                    text,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE planned_shifts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  location_id                              uuid NOT NULL,
  shift_date                               date NOT NULL,
  start_time                               time NOT NULL,
  end_time                                 time NOT NULL,
  planned_hours                            numeric NOT NULL,
  planned_cost                             numeric,
  role                                     text,
  status                                   text NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE timesheets (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  location_id                              uuid NOT NULL,
  clock_in                                 timestamptz NOT NULL,
  clock_out                                timestamptz,
  minutes                                  integer,
  labor_cost                               numeric,
  approved                                 boolean,
  created_at                               timestamptz NOT NULL
);


-- ============================================================
-- PAYROLL
-- ============================================================

CREATE TABLE payroll_runs (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  legal_entity_id                          uuid NOT NULL,
  period_year                              integer NOT NULL,
  period_month                             integer NOT NULL,
  status                                   text NOT NULL,
  created_at                               timestamptz NOT NULL,
  approved_at                              timestamptz,
  approved_by                              uuid
);

CREATE TABLE payslips (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  payroll_run_id                           uuid NOT NULL,
  employee_id                              uuid NOT NULL,
  gross_pay                                numeric NOT NULL,
  employee_ss                              numeric NOT NULL,
  employer_ss                              numeric NOT NULL,
  irpf_withheld                            numeric NOT NULL,
  other_deductions                         numeric NOT NULL,
  net_pay                                  numeric NOT NULL,
  pdf_url                                  text,
  generated_at                             timestamptz NOT NULL,
  breakdown_json                           jsonb
);

CREATE TABLE payslip_lines (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  payslip_id                               uuid NOT NULL  -- Note:
This is a Foreign Key to `payslips.id`.<fk table='payslips' column='id'/>,
  concept_code                             text NOT NULL,
  concept_name                             text NOT NULL,
  amount                                   numeric NOT NULL,
  type                                     text NOT NULL
);

CREATE TABLE employment_contracts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  legal_entity_id                          uuid NOT NULL,
  location_id                              uuid,
  start_date                               date NOT NULL,
  end_date                                 date,
  contract_type                            text NOT NULL,
  jornada_pct                              numeric NOT NULL,
  group_ss                                 text NOT NULL,
  category                                 text NOT NULL,
  convenio_code                            text,
  base_salary_monthly                      numeric NOT NULL,
  hourly_rate                              numeric,
  extra_pays                               text NOT NULL,
  irpf_mode                                text NOT NULL,
  irpf_rate                                numeric,
  active                                   boolean NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE legal_entities (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  razon_social                             text NOT NULL,
  nif                                      text NOT NULL,
  domicilio_fiscal                         text NOT NULL,
  cnae                                     text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE convenio_rules (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  convenio_code                            text NOT NULL,
  rule_json                                jsonb NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE payroll_audit (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  actor_user_id                            uuid NOT NULL,
  action                                   text NOT NULL,
  payload_json                             jsonb NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE payroll_concepts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  code                                     text NOT NULL,
  name                                     text NOT NULL,
  type                                     text NOT NULL,
  taxable_irpf                             boolean NOT NULL,
  cotizable_ss                             boolean NOT NULL,
  is_default                               boolean NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE payroll_inputs (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  employee_id                              uuid NOT NULL,
  period_year                              integer NOT NULL,
  period_month                             integer NOT NULL,
  location_id                              uuid,
  hours_regular                            numeric NOT NULL,
  hours_night                              numeric NOT NULL,
  hours_holiday                            numeric NOT NULL,
  hours_overtime                           numeric NOT NULL,
  bonuses_json                             jsonb,
  deductions_json                          jsonb,
  tips_json                                jsonb,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE payroll_location_settings (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  contingencias_comunes_employer           numeric NOT NULL,
  desempleo_employer_indefinido            numeric NOT NULL,
  desempleo_employer_temporal              numeric NOT NULL,
  fogasa_employer                          numeric NOT NULL,
  formacion_employer                       numeric NOT NULL,
  mei_employer                             numeric NOT NULL,
  accident_rate_employer                   numeric NOT NULL,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE payroll_settings (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  setting_type                             text NOT NULL,
  setting_json                             jsonb NOT NULL,
  valid_from                               date NOT NULL,
  valid_to                                 date,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE social_security_accounts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  legal_entity_id                          uuid NOT NULL,
  ccc                                      text NOT NULL,
  provincia                                text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE tax_accounts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  legal_entity_id                          uuid NOT NULL,
  aeat_delegacion                          text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE compliance_submissions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  payroll_run_id                           uuid NOT NULL,
  agency                                   text NOT NULL,
  submission_type                          text NOT NULL,
  payload_file_url                         text,
  response_json                            jsonb,
  status                                   text NOT NULL,
  submitted_at                             timestamptz,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE compliance_tokens (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  legal_entity_id                          uuid NOT NULL,
  provider                                 text NOT NULL,
  encrypted_blob                           text NOT NULL,
  expires_at                               timestamptz,
  created_at                               timestamptz NOT NULL
);


-- ============================================================
-- INVENTORY & PROCUREMENT
-- ============================================================

CREATE TABLE inventory_items (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  name                                     text NOT NULL,
  unit                                     text,
  par_level                                numeric,
  current_stock                            numeric,
  last_cost                                numeric,
  created_at                               timestamptz NOT NULL,
  category                                 text
);

CREATE TABLE stock_movements (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  item_id                                  uuid NOT NULL,
  movement_type                            text NOT NULL,
  quantity                                 numeric NOT NULL,
  unit                                     text NOT NULL,
  reference_id                             uuid,
  cost                                     numeric,
  notes                                    text,
  created_at                               timestamptz
);

CREATE TABLE stock_counts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  location_id                              uuid NOT NULL,
  start_date                               date NOT NULL,
  end_date                                 date NOT NULL,
  status                                   text NOT NULL,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE stock_count_lines (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  stock_count_id                           uuid NOT NULL,
  inventory_item_id                        uuid NOT NULL,
  opening_qty                              numeric,
  deliveries_qty                           numeric,
  transfers_net_qty                        numeric,
  closing_qty                              numeric,
  used_qty                                 numeric,
  sales_qty                                numeric,
  variance_qty                             numeric,
  batch_balance                            numeric,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE suppliers (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  name                                     text NOT NULL,
  email                                    text,
  phone                                    text,
  created_at                               timestamptz NOT NULL,
  integration_type                         text,
  api_endpoint                             text,
  api_format                               text,
  order_email                              text,
  order_whatsapp                           text,
  customer_id                              text,
  website                                  text,
  coverage                                 text,
  regions                                  text[],
  is_template                              boolean
);

CREATE TABLE purchase_orders (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  supplier_id                              uuid NOT NULL,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  location_id                              uuid,
  status                                   text,
  created_at                               timestamptz NOT NULL,
  sent_at                                  timestamptz,
  sent_method                              text,
  external_order_id                        text,
  response_status                          text,
  response_message                         text
);

CREATE TABLE purchase_order_lines (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  purchase_order_id                        uuid NOT NULL,
  inventory_item_id                        uuid NOT NULL,
  quantity                                 numeric NOT NULL,
  unit_cost                                numeric
);

CREATE TABLE waste_events (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  inventory_item_id                        uuid NOT NULL,
  quantity                                 numeric NOT NULL,
  reason                                   text,
  waste_value                              numeric,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE recipes (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  menu_item_name                           text NOT NULL,
  selling_price                            numeric,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE recipe_ingredients (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  recipe_id                                uuid NOT NULL  -- Note:
This is a Foreign Key to `recipes.id`.<fk table='recipes' column='id'/>,
  inventory_item_id                        uuid NOT NULL,
  quantity                                 numeric NOT NULL
);


-- ============================================================
-- INTEGRATIONS
-- ============================================================

CREATE TABLE integrations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  org_id                                   uuid NOT NULL,
  location_id                              uuid,
  provider                                 text NOT NULL,
  status                                   text NOT NULL,
  created_at                               timestamptz,
  updated_at                               timestamptz,
  metadata                                 jsonb
);

CREATE TABLE integration_accounts (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  integration_id                           uuid NOT NULL,
  provider                                 text NOT NULL,
  environment                              text NOT NULL,
  external_account_id                      text NOT NULL,
  access_token_encrypted                   text NOT NULL,
  refresh_token_encrypted                  text,
  token_expires_at                         timestamptz,
  scopes                                   text[],
  metadata                                 jsonb,
  is_active                                boolean,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE integration_sync_runs (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  integration_account_id                   uuid NOT NULL,
  started_at                               timestamptz,
  ended_at                                 timestamptz,
  status                                   text NOT NULL,
  cursor                                   jsonb,
  stats                                    jsonb,
  error_text                               text,
  created_at                               timestamptz
);

CREATE TABLE raw_events (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  provider                                 text NOT NULL,
  integration_account_id                   uuid NOT NULL,
  event_type                               text NOT NULL,
  external_id                              text NOT NULL,
  event_ts                                 timestamptz NOT NULL,
  payload                                  jsonb NOT NULL,
  payload_hash                             text NOT NULL,
  inserted_at                              timestamptz,
  processed_at                             timestamptz,
  processed_status                         text,
  error_text                               text
);


-- ============================================================
-- OTHER
-- ============================================================

CREATE TABLE announcements (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  title                                    text NOT NULL,
  body                                     text NOT NULL,
  type                                     text NOT NULL,
  pinned                                   boolean,
  author                                   text NOT NULL,
  location_id                              uuid,
  created_at                               timestamptz
);

CREATE TABLE budgets_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  budget_sales                             numeric NOT NULL,
  budget_labour                            numeric NOT NULL,
  budget_cogs                              numeric NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE cash_counts_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  cash_counted                             numeric NOT NULL,
  notes                                    text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE cogs_daily (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  date                                     date NOT NULL,
  location_id                              uuid NOT NULL,
  cogs_amount                              numeric NOT NULL,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE kpi_alert_thresholds (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  location_id                              uuid,
  kpi_name                                 text NOT NULL,
  min_threshold                            numeric,
  max_threshold                            numeric,
  is_enabled                               boolean,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE menu_engineering_actions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  user_id                                  uuid NOT NULL,
  location_id                              uuid,
  date_from                                date NOT NULL,
  date_to                                  date NOT NULL,
  product_id                               uuid  -- Note:
This is a Foreign Key to `products.id`.<fk table='products' column='id'/>,
  action_type                              text NOT NULL,
  classification                           text NOT NULL,
  estimated_impact_eur                     numeric,
  notes                                    text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE reservations (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  pos_table_id                             uuid,
  guest_name                               text NOT NULL,
  guest_phone                              text,
  guest_email                              text,
  party_size                               integer NOT NULL,
  reservation_date                         date NOT NULL,
  reservation_time                         time NOT NULL,
  duration_minutes                         integer,
  status                                   text NOT NULL,
  confirmation_sent_at                     timestamptz,
  reminder_sent_at                         timestamptz,
  notes                                    text,
  special_requests                         text,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL,
  created_by                               uuid
);

CREATE TABLE reviews (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  location_id                              uuid NOT NULL,
  platform                                 text NOT NULL,
  external_id                              text,
  rating                                   integer NOT NULL,
  author_name                              text NOT NULL,
  author_avatar_url                        text,
  review_text                              text,
  review_date                              timestamptz NOT NULL,
  language                                 text,
  response_text                            text,
  response_date                            timestamptz,
  response_status                          text,
  ai_draft                                 text,
  ai_tone                                  text,
  sentiment                                text,
  tags                                     text[],
  is_verified                              boolean,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE loyalty_members (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  email                                    text,
  phone                                    text,
  name                                     text NOT NULL,
  points_balance                           integer NOT NULL,
  lifetime_points                          integer NOT NULL,
  tier                                     text NOT NULL,
  notes                                    text,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE loyalty_settings (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  is_enabled                               boolean NOT NULL,
  points_per_euro                          numeric NOT NULL,
  welcome_bonus                            integer NOT NULL,
  tier_rules                               jsonb NOT NULL,
  created_at                               timestamptz NOT NULL,
  updated_at                               timestamptz NOT NULL
);

CREATE TABLE loyalty_rewards (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  name                                     text NOT NULL,
  description                              text,
  points_cost                              integer NOT NULL,
  reward_type                              text NOT NULL,
  value                                    numeric,
  product_id                               uuid  -- Note:
This is a Foreign Key to `products.id`.<fk table='products' column='id'/>,
  is_active                                boolean NOT NULL,
  max_redemptions                          integer,
  current_redemptions                      integer NOT NULL,
  valid_from                               date,
  valid_until                              date,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE loyalty_transactions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  member_id                                uuid NOT NULL,
  location_id                              uuid,
  ticket_id                                uuid  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  points                                   integer NOT NULL,
  type                                     text NOT NULL,
  description                              text,
  created_at                               timestamptz NOT NULL
);

CREATE TABLE loyalty_redemptions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  member_id                                uuid NOT NULL,
  reward_id                                uuid NOT NULL,
  location_id                              uuid,
  ticket_id                                uuid  -- Note:
This is a Foreign Key to `tickets.id`.<fk table='tickets' column='id'/>,
  points_used                              integer NOT NULL,
  status                                   text NOT NULL,
  code                                     text,
  redeemed_at                              timestamptz NOT NULL,
  applied_at                               timestamptz
);

CREATE TABLE report_subscriptions (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  user_id                                  uuid NOT NULL,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  location_id                              uuid,
  report_type                              text NOT NULL,
  is_enabled                               boolean,
  email_override                           text,
  created_at                               timestamptz,
  updated_at                               timestamptz
);

CREATE TABLE report_logs (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  report_type                              text NOT NULL,
  group_id                                 uuid NOT NULL  -- Note:
This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>,
  location_id                              uuid,
  recipient_email                          text NOT NULL,
  status                                   text NOT NULL,
  error_message                            text,
  report_data                              jsonb,
  sent_at                                  timestamptz
);

CREATE TABLE mcp_idempotency_keys (
  id                                       uuid NOT NULL  -- Note:
This is a Primary Key.<pk/>,
  tool_name                                text NOT NULL,
  idempotency_key                          text NOT NULL,
  request_hash                             text NOT NULL,
  status                                   text NOT NULL,
  created_at                               timestamptz NOT NULL,
  actor_json                               jsonb,
  reason                                   text NOT NULL,
  result_json                              jsonb
);


-- ============================================================
-- RPC FUNCTIONS (42 total)
-- ============================================================

-- add_loyalty_points(p_description text, p_location_id uuid, p_member_id uuid, p_points integer, p_ticket_id uuid, p_type text)
-- audit_data_coherence(p_days integer, p_location_ids uuid, p_org_id uuid)
-- backfill_order_lines_item_id(p_org_id uuid)
-- calculate_loyalty_tier(p_lifetime_points integer)
-- can_access_location(_location_id uuid, _user_id uuid)
-- check_kpi_alerts(p_date date, p_group_id uuid)
-- cleanup_expired_otps()
-- complete_sync_run(p_error text, p_run_id uuid, p_stats jsonb, p_status text)
-- compute_hourly_cost(p_employee_id uuid)
-- etl_cdm_to_facts_sales_15m(p_date_from date, p_date_to date)
-- etl_tickets_to_facts(p_date_from date, p_date_to date)
-- forecast_needs_refresh(p_location_id uuid)
-- get_accessible_location_ids()
-- get_daily_sales(p_location_id uuid)
-- get_daily_sales_summary(p_date date, p_group_id uuid, p_location_id uuid)
-- get_forecast_items_mix_unified(p_from date, p_horizon_days integer, p_limit integer, p_location_ids uuid, p_org_id uuid, p_to date)
-- get_instant_pnl_unified(p_from date, p_location_ids uuid, p_org_id uuid, p_to date)
-- get_labor_plan_unified(p_from date, p_location_ids uuid, p_org_id uuid, p_to date)
-- get_labour_kpis(date_from date, date_to date, p_data_source text, selected_location_id uuid)
-- get_labour_locations_table(date_from date, date_to date, p_data_source text, selected_location_id uuid)
-- get_labour_timeseries(date_from date, date_to date, p_data_source text, selected_location_id uuid)
-- get_latest_forecast_run(p_location_id uuid)
-- get_sales_timeseries_unified(p_from date, p_location_ids uuid, p_org_id uuid, p_to date)
-- get_top_products(p_data_source text, p_date_from date, p_date_to date, p_location_id uuid, p_order_by text)
-- get_top_products_unified(p_from date, p_limit integer, p_location_ids uuid, p_org_id uuid, p_to date)
-- get_user_accessible_locations(_user_id uuid)
-- get_user_group_id()
-- get_user_has_global_scope(_user_id uuid)
-- get_user_permissions(_location_id uuid, _user_id uuid)
-- get_user_primary_role(_user_id uuid)
-- get_user_roles_with_scope(_user_id uuid)
-- get_weekly_sales_summary(p_group_id uuid, p_week_start date)
-- has_payroll_role()
-- has_permission(_location_id uuid, _permission_key text, _user_id uuid)
-- has_role(_role text)
-- has_running_sync(p_account_id uuid)
-- is_admin_or_ops(_user_id uuid)
-- is_owner(_user_id uuid)
-- is_owner_or_admin(_user_id uuid)
-- is_payroll_admin()
-- menu_engineering_summary(p_data_source text, p_date_from date, p_date_to date, p_location_id uuid)
-- redeem_loyalty_reward(p_location_id uuid, p_member_id uuid, p_reward_id uuid)
-- resolve_data_source(p_org_id uuid)
-- run_daily_forecast()
-- run_hourly_forecast()
-- seed_demo_labour_data(p_days integer, p_locations integer)
-- seed_demo_products_and_sales(p_group_id uuid)
-- seed_josephine_demo_data()
-- seed_roles_and_permissions()
-- seed_sales_for_existing_products(p_group_id uuid)
-- seed_waste_for_pos_products(p_group_id uuid)
-- simulate_today_partial_data()
