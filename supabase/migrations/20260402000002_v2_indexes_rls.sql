-- =============================================================================
-- JOSEPHINE DB v2 — INDEXES, RLS & GRANTS
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Sales
CREATE INDEX IF NOT EXISTS idx_daily_sales_org_loc_day ON daily_sales (org_id, location_id, day);
CREATE INDEX IF NOT EXISTS idx_cdm_orders_org_loc_closed ON cdm_orders (org_id, location_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_order_id ON cdm_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_item_id ON cdm_order_lines (item_id);

-- Workforce
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees (org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_loc ON time_entries (org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_loc_clockin ON time_entries (location_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_clockin ON time_entries (org_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_shifts_loc_start ON shifts (location_id, start_at);
CREATE INDEX IF NOT EXISTS idx_clock_records_employee ON employee_clock_records(employee_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_clock_records_location ON employee_clock_records(location_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_clock_records_active ON employee_clock_records(location_id) WHERE clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_breaks_clock_record ON employee_breaks(clock_record_id);
CREATE INDEX IF NOT EXISTS idx_labour_alerts_unread ON labour_alerts (org_id, is_read, created_at DESC) WHERE is_read = false;

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inv_item_loc_item_id ON inventory_item_location (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_item_loc_location_id ON inventory_item_location (location_id);
CREATE INDEX IF NOT EXISTS idx_waste_events_item_id ON waste_events (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_waste_events_loc_created ON waste_events (location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_loc_type ON stock_movements (location_id, movement_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ic_org_location ON inventory_counts(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_ic_item ON inventory_counts(item_id);
CREATE INDEX IF NOT EXISTS idx_ic_date ON inventory_counts(count_date DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_sub_recipe_id ON recipe_ingredients(sub_recipe_id);
CREATE INDEX IF NOT EXISTS idx_ri_menu_item_id ON recipe_ingredients(menu_item_id);

-- Budget & Forecast
CREATE INDEX IF NOT EXISTS idx_forecast_points_org_loc_day ON forecast_points (org_id, location_id, day);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_org_loc_status ON forecast_runs (org_id, location_id, status, finished_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_budget_days_org_loc_day ON budget_days (org_id, location_id, day);
CREATE INDEX IF NOT EXISTS idx_budget_metrics_day_layer ON budget_metrics (budget_day_id, layer);
CREATE INDEX IF NOT EXISTS idx_budget_drivers_day_id ON budget_drivers (budget_day_id);
CREATE INDEX IF NOT EXISTS idx_cash_counts_loc_day ON cash_counts_daily (location_id, date);

-- Auth
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_location_memberships_user ON location_memberships (user_id);

-- Supporting
CREATE INDEX IF NOT EXISTS idx_reviews_loc_date ON reviews (location_id, review_date);
CREATE INDEX IF NOT EXISTS idx_logbook_location_date ON manager_logbook(location_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_org ON manager_logbook(org_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_unresolved ON manager_logbook(location_id) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_order_guides_location ON ai_order_guides(location_id, forecast_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_guides_org ON ai_order_guides(org_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_guide_items_guide ON ai_order_guide_items(order_guide_id);
CREATE INDEX IF NOT EXISTS idx_order_guide_items_item ON ai_order_guide_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_weather_location_date ON weather_cache(location_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_reviews_employee ON employee_reviews(employee_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_org ON employee_reviews(org_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_tokens_entity ON compliance_tokens(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_training_employee ON training_records(employee_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_training_org ON training_records(org_id, cert_type);
CREATE INDEX IF NOT EXISTS idx_event_calendar_date ON event_calendar(event_date);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON ai_conversations(org_id, created_at DESC);

-- MV unique indexes (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_daily_unified_mv_pk ON product_sales_daily_unified_mv (org_id, location_id, day, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_hourly_unified_mv_pk ON sales_hourly_unified_mv (org_id, location_id, hour_bucket);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mart_kpi_daily_mv_pk ON mart_kpi_daily_mv (org_id, location_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mart_sales_category_daily_mv_pk ON mart_sales_category_daily_mv (org_id, location_id, date, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_hourly_unified_mv_v2_pk ON sales_hourly_unified_mv_v2 (org_id, location_id, date, hour_bucket, data_source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_daily_unified_mv_v2_pk ON product_sales_daily_unified_mv_v2 (org_id, location_id, day, product_id, data_source);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ENABLE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ 
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'inventory_counts','menu_engineering_actions','monthly_cost_entries',
    'labour_alerts','labour_rules','tip_distribution_rules','tip_role_weights',
    'tip_entries','tip_distributions','employee_clock_records','compliance_tokens',
    'employee_breaks','manager_logbook','ai_order_guides','ai_order_guide_items',
    'weather_cache','employee_reviews','event_calendar','training_records',
    'ai_conversations','ai_messages','stock_movements','waste_events',
    'inventory_items','inventory_item_location','budget_versions','budget_days',
    'budget_metrics','budget_drivers','cash_counts_daily','announcements',
    'reviews','payslip_lines','employees','time_entries','daily_sales',
    'pos_daily_finance','locations','org_settings','integrations'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES (permissive — all authenticated users)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'inventory_counts','menu_engineering_actions','monthly_cost_entries',
    'labour_alerts','labour_rules','tip_distribution_rules','tip_role_weights',
    'tip_entries','tip_distributions','employee_clock_records','compliance_tokens',
    'employee_breaks','manager_logbook','ai_order_guides','ai_order_guide_items',
    'weather_cache','employee_reviews','event_calendar','training_records',
    'ai_conversations','ai_messages','stock_movements','waste_events',
    'inventory_items','inventory_item_location','budget_versions','budget_days',
    'budget_metrics','budget_drivers','cash_counts_daily','announcements',
    'reviews','payslip_lines','employees','time_entries','daily_sales',
    'pos_daily_finance','locations'
  ])
  LOOP
    BEGIN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t||'_sel', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t||'_ins', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t||'_upd', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', t||'_del', t);
      EXECUTE format('GRANT ALL ON %I TO authenticated', t);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- Org-scoped policies for settings & integrations
CREATE POLICY org_settings_rls ON org_settings FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY integrations_rls ON integrations FOR ALL
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Views
GRANT SELECT ON groups TO anon, authenticated;
GRANT SELECT ON sales_daily_unified TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified TO anon, authenticated;
GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;
GRANT SELECT ON labour_daily_unified TO anon, authenticated;
GRANT SELECT ON forecast_daily_unified TO anon, authenticated;
GRANT SELECT ON budget_daily_unified TO anon, authenticated;
GRANT SELECT ON cogs_daily TO anon, authenticated;
GRANT SELECT ON inventory_position_unified TO anon, authenticated;
GRANT SELECT ON low_stock_unified TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily TO anon, authenticated;
GRANT SELECT ON mart_sales_category_daily TO anon, authenticated;
GRANT SELECT ON mart_stock_count_headers TO anon, authenticated;
GRANT SELECT ON mart_stock_count_lines_enriched TO anon, authenticated;
GRANT SELECT ON recipe_summary TO anon, authenticated;
GRANT SELECT ON reviews TO anon, authenticated;
GRANT SELECT ON announcements TO anon, authenticated;
GRANT SELECT ON payslip_lines TO anon, authenticated;

-- MVs
GRANT SELECT ON product_sales_daily_unified_mv TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified_mv TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily_mv TO anon, authenticated;
GRANT SELECT ON mart_sales_category_daily_mv TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified_mv_v2 TO anon, authenticated;
GRANT SELECT ON product_sales_daily_unified_mv_v2 TO anon, authenticated;

-- Ops schema
GRANT USAGE ON SCHEMA ops TO service_role, authenticated;
GRANT SELECT ON ops.mv_refresh_log TO authenticated;
GRANT ALL ON ops.mv_refresh_log TO service_role;
