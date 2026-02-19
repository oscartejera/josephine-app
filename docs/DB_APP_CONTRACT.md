# DB_APP_CONTRACT.md

> Complete map of every Supabase table, view, RPC, and Edge Function the React
> frontend reads or writes, with exact file paths and columns.
>
> Generated: 2026-02-19

---

## Table of Contents

1. [Contract Views (Data Layer)](#1-contract-views-data-layer)
2. [Direct Table Reads](#2-direct-table-reads)
3. [Direct Table Writes](#3-direct-table-writes)
4. [RPC Functions](#4-rpc-functions)
5. [Edge Functions](#5-edge-functions)
6. [Realtime Subscriptions](#6-realtime-subscriptions)
7. [Critical Flows](#7-critical-flows)
8. [Migration Checklist](#8-migration-checklist)

---

## 1. Contract Views (Data Layer)

All main analytics queries go through `src/data/*.ts`, which read from
"contract views" — Postgres views that the app depends on by name and column.

### 1.1 `sales_daily_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/sales.ts:37-43` (getDashboardKpis), `src/data/sales.ts:93-97` (getSalesTrends), `src/data/forecast.ts:75-80` (getForecastVsActual), `src/data/budget.ts:69-73` (getBudgetVsActual) |
| **Operation** | SELECT |
| **Filter columns** | `data_source`, `location_id`, `date` (range) |
| **Selected columns** | `org_id`, `location_id`, `date`, `net_sales`, `gross_sales`, `orders_count`, `avg_check`, `payments_cash`, `payments_card`, `payments_other`, `refunds_amount`, `refunds_count`, `discounts_amount`, `comps_amount`, `voids_amount`, `labor_cost`, `labor_hours`, `data_source` |

### 1.2 `sales_hourly_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/sales.ts:180-183` (getSalesHourlyTrends) |
| **Operation** | SELECT |
| **Filter columns** | `location_id`, `day` (range) |
| **Selected columns** | `org_id`, `location_id`, `day`, `hour_bucket`, `hour_of_day`, `net_sales`, `gross_sales`, `orders_count`, `covers`, `avg_check`, `discounts`, `refunds`, `data_source` |

### 1.3 `product_sales_daily_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/sales.ts:144-148` (getProductSalesDaily) |
| **Operation** | SELECT |
| **Filter columns** | `data_source`, `location_id`, `day` (range) |
| **Selected columns** | `org_id`, `location_id`, `day`, `product_id`, `product_name`, `product_category`, `units_sold`, `net_sales`, `cogs`, `gross_profit`, `margin_pct`, `data_source` |

### 1.4 `labour_daily_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/labour.ts:26-28` (getLabourDaily), `src/data/budget.ts:76-78` (getBudgetVsActual) |
| **Operation** | SELECT |
| **Filter columns** | `location_id`, `day` (range) |
| **Selected columns** | `org_id`, `location_id`, `day`, `actual_hours`, `actual_cost`, `scheduled_hours`, `scheduled_cost`, `scheduled_headcount`, `hours_variance`, `cost_variance`, `hours_variance_pct` |

### 1.5 `forecast_daily_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/forecast.ts:26-27` (getForecastDaily), `src/data/forecast.ts:69-72` (getForecastVsActual) |
| **Operation** | SELECT |
| **Filter columns** | `location_id`, `day` (range) |
| **Selected columns** | `org_id`, `location_id`, `day`, `forecast_sales`, `forecast_orders`, `planned_labor_hours`, `planned_labor_cost`, `forecast_avg_check`, `forecast_sales_lower`, `forecast_sales_upper`, `data_source` |

### 1.6 `budget_daily_unified`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/budget.ts:21-22` (getBudgetDaily), `src/data/budget.ts:63-66` (getBudgetVsActual) |
| **Operation** | SELECT |
| **Filter columns** | `location_id`, `day` (range) |
| **Selected columns** | `org_id`, `location_id`, `day`, `budget_sales`, `budget_labour`, `budget_cogs`, `budget_profit`, `budget_margin_pct`, `budget_col_pct`, `budget_cogs_pct` |

### 1.7 `cogs_daily`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/budget.ts:81-82` (getBudgetVsActual) |
| **Operation** | SELECT |
| **Filter columns** | `location_id`, `date` (range) |
| **Selected columns** | `date`, `location_id`, `cogs_amount` |

---

## 2. Direct Table Reads

These are `supabase.from('table').select(...)` calls outside the data layer.

### 2.1 `groups`

| Detail | Value |
|--------|-------|
| **Files** | `src/contexts/AppContext.tsx:104` |
| **Operation** | SELECT ... single() |
| **Filter** | `.eq('id', groupId)` |
| **Columns** | `id`, `name` |
| **Notes** | **CRITICAL**: New DB uses `orgs` table, not `groups`. |

### 2.2 `locations`

| Detail | Value |
|--------|-------|
| **Files** | `src/contexts/AppContext.tsx:105`, `src/components/settings/DemoDataManager.tsx:50` |
| **Operation** | SELECT |
| **Filter** | `.eq('group_id', groupId).eq('active', true)` (AppContext); `.eq('group_id', demoGroupId)` (DemoDataManager) |
| **Columns** | `id`, `name`, `city` (AppContext); `id` (DemoDataManager) |
| **Notes** | **CRITICAL**: New DB uses `org_id` column, not `group_id`. No `active` column in new DB. |

### 2.3 `profiles`

| Detail | Value |
|--------|-------|
| **Files** | `src/contexts/AuthContext.tsx:65-69` |
| **Operation** | SELECT ... single() |
| **Filter** | `.eq('id', userId)` |
| **Columns** | `id`, `group_id`, `full_name` |
| **Notes** | **CRITICAL**: New DB profiles use `user_id` (not `id` as PK for user lookup) and `org_id` (not `group_id`). |

### 2.4 `integrations`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useDataSource.ts:120-123` (legacy fallback) |
| **Operation** | SELECT |
| **Filter** | `.eq('status', 'active')` |
| **Columns** | `id`, `provider`, `status`, `metadata` |

### 2.5 `inventory_items`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/inventory.ts:29-33`, `src/pages/SettingsPage.tsx:158` |
| **Operation** | SELECT |
| **Filter** | `.eq('group_id', orgId)` (inventory.ts); unfiltered (SettingsPage) |
| **Columns** | `id`, `name`, `unit`, `current_stock`, `par_level`, `group_id` (inventory.ts); `*` (SettingsPage) |
| **Notes** | New DB has `inventory_items` but uses `org_id`, not `group_id`. Column `current_stock` does not exist in new DB (stock lives in `inventory_item_location`). |

### 2.6 `employees`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/payroll.ts:137-140` (listPayslips enrichment), `src/data/payroll.ts:172-177` (getMyPayslips), `src/pages/SettingsPage.tsx:153`, `src/components/payroll/PayrollHome.tsx:62`, `src/components/payroll/PayrollInputs.tsx:57` |
| **Operation** | SELECT |
| **Filter** | `.in('id', empIds)`, `.eq('user_id', userId)`, `.eq('location_id', locId)` |
| **Columns** | `id`, `full_name`, `user_id`, `location_id` |

### 2.7 `payroll_runs`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/payroll.ts:23-28` (listPayrollRuns) |
| **Operation** | SELECT |
| **Filter** | `.eq('legal_entity_id', legalEntityId)` |
| **Columns** | `id`, `group_id`, `legal_entity_id`, `period_year`, `period_month`, `status`, `created_at` |
| **Notes** | Table does not exist in new DB schema. |

### 2.8 `payslips`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/payroll.ts:123-126` (listPayslips), `src/data/payroll.ts:181-184` (getMyPayslips) |
| **Operation** | SELECT |
| **Filter** | `.eq('payroll_run_id', runId)`, `.eq('employee_id', empId)` |
| **Columns** | `id`, `payroll_run_id`, `employee_id`, `gross_pay`, `net_pay`, `irpf_withheld`, `employee_ss`, `employer_ss`, `other_deductions` |
| **Notes** | Table does not exist in new DB schema. |

### 2.9 `employment_contracts`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/payroll/PayrollInputs.tsx:77` |
| **Operation** | SELECT |
| **Filter** | `.eq('employee_id', empId)` |
| **Columns** | `employee_id`, `jornada_pct` |
| **Notes** | Table does not exist in new DB schema. |

### 2.10 `employee_legal`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/payroll/PayrollHome.tsx:70` |
| **Operation** | SELECT |
| **Filter** | `.eq('employee_id', empId)` |
| **Columns** | `employee_id`, `nif`, `nss`, `iban` |
| **Notes** | Table does not exist in new DB schema. |

### 2.11 `payroll_inputs`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/payroll/PayrollInputs.tsx:65` |
| **Operation** | SELECT |
| **Filter** | `.eq('payroll_run_id', runId)` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. |

### 2.12 `pos_daily_finance`

| Detail | Value |
|--------|-------|
| **Files** | `src/pages/SettingsPage.tsx:148` |
| **Operation** | SELECT |
| **Filter** | `.limit(1)` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. Read as existence check for data export. |

### 2.13 `loyalty_settings`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:80-84` |
| **Operation** | SELECT single() |
| **Filter** | `.eq('group_id', groupId)` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. |

### 2.14 `loyalty_members`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:94-98`, `src/hooks/useLoyaltyData.ts:274-279` |
| **Operation** | SELECT |
| **Filter** | `.eq('group_id', groupId)`, `.or('email.ilike..., phone.ilike...')` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. |

### 2.15 `loyalty_rewards`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:106-110` |
| **Operation** | SELECT |
| **Filter** | `.eq('group_id', groupId)` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. |

### 2.16 `loyalty_transactions`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:287-292` |
| **Operation** | SELECT |
| **Filter** | `.eq('member_id', memberId)` |
| **Columns** | `*` |
| **Notes** | Table does not exist in new DB schema. |

---

## 3. Direct Table Writes

### 3.1 `purchase_orders`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/inventory.ts:71-79` |
| **Operation** | INSERT ... select().single() |
| **Columns written** | `supplier_id`, `location_id`, `status` ('draft') |
| **Columns returned** | `id`, `status` |

### 3.2 `purchase_order_lines`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/inventory.ts:86-94` |
| **Operation** | INSERT (batch) |
| **Columns written** | `purchase_order_id`, `inventory_item_id`, `quantity`, `unit_price` |

### 3.3 `payroll_runs`

| Detail | Value |
|--------|-------|
| **Files** | `src/data/payroll.ts:61-70` (insert draft), `src/data/payroll.ts:97-104` (approve), `src/components/payroll/PayrollSubmit.tsx:82` (update status), `src/components/payroll/PayrollReview.tsx:111` (approve), `src/components/payroll/PayrollPay.tsx:70` (update status), `src/components/payroll/PayrollHome.tsx:213` (delete) |
| **Operations** | INSERT, UPDATE, DELETE |
| **Columns written** | `group_id`, `legal_entity_id`, `period_year`, `period_month`, `status`, `approved_at`, `approved_by` |

### 3.4 `payslips`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/payroll/PayrollHome.tsx:211` |
| **Operation** | DELETE |
| **Filter** | `.eq('payroll_run_id', runId)` |

### 3.5 `compliance_submissions`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/payroll/PayrollHome.tsx:212` |
| **Operation** | DELETE |
| **Filter** | `.eq('payroll_run_id', runId)` |

### 3.6 `waste_events`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/waste/LogWasteDialog.tsx:135` |
| **Operation** | INSERT |
| **Columns written** | `inventory_item_id`, `location_id`, `quantity`, `reason`, `waste_value` |

### 3.7 `location_settings`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationManager.tsx:128,261,270,312`, `src/components/settings/LocationWizard.tsx:437`, `src/components/onboarding/OnboardingWizard.tsx:292` |
| **Operation** | INSERT |
| **Columns written** | `location_id`, `target_gp_percent`, `target_col_percent`, `opening_time`, `closing_time`, `splh_goal`, `default_hourly_cost` |
| **Notes** | Table does not exist in new DB (use `org_settings` or per-location settings). |

### 3.8 `payroll_location_settings`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationManager.tsx:137,287,298,319`, `src/components/settings/LocationWizard.tsx:445`, `src/components/onboarding/OnboardingWizard.tsx:301` |
| **Operation** | INSERT |
| **Columns written** | `location_id`, `contingencias_comunes_employer`, `desempleo_employer`, `fogasa_employer`, `formacion_employer`, `contingencias_comunes_employee`, `desempleo_employee` |
| **Notes** | Table does not exist in new DB schema. |

### 3.9 `products`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationManager.tsx:348`, `src/components/settings/LocationWizard.tsx:467` |
| **Operation** | INSERT (batch) |
| **Columns written** | `location_id`, `name`, `category`, `price`, `cost_price`, `target_prep_time` |
| **Notes** | Table does not exist in new DB (use `menu_items`). |

### 3.10 `employees`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationManager.tsx:373`, `src/components/settings/LocationWizard.tsx:479`, `src/components/onboarding/OnboardingWizard.tsx:350` |
| **Operation** | INSERT (batch) |
| **Columns written** | `location_id`, `full_name`, `role_name`, `hourly_cost`, `active` |

### 3.11 `pos_tables`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationManager.tsx:169,420,443,464`, `src/components/settings/LocationWizard.tsx:506`, `src/components/onboarding/OnboardingWizard.tsx:381` |
| **Operation** | INSERT (batch) |
| **Columns written** | `floor_map_id`, `table_number`, `seats`, `position_x`, `position_y`, `shape`, `width`, `height`, `status` |
| **Notes** | Table does not exist in new DB schema. |

### 3.12 `user_roles`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/onboarding/OnboardingWizard.tsx:271` |
| **Operation** | INSERT |
| **Columns written** | `user_id`, `role_id`, `location_id` |
| **Notes** | Table does not exist in new DB (roles are handled via `org_memberships` + `location_memberships`). |

### 3.13 `inventory_items`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/onboarding/OnboardingWizard.tsx:397` |
| **Operation** | INSERT (batch) |
| **Columns written** | inventory item fields |

### 3.14 `suppliers`

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/LocationWizard.tsx:532` |
| **Operation** | INSERT (batch) |
| **Columns written** | `group_id`, `name`, `email`, `integration_type`, `is_template` |
| **Notes** | New DB uses `org_id`, not `group_id`. |

### 3.15 `loyalty_settings`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:132-139` |
| **Operation** | UPSERT |
| **Columns written** | `group_id` + partial update fields |

### 3.16 `loyalty_members`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:154-164` (insert), `src/hooks/useLoyaltyData.ts:185-188` (update), `src/hooks/useLoyaltyData.ts:194-195` (delete) |
| **Operations** | INSERT, UPDATE, DELETE |
| **Columns written** | `group_id`, `name`, `email`, `phone`, `notes`, `points_balance`, `lifetime_points` |

### 3.17 `loyalty_transactions`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:172-177` |
| **Operation** | INSERT |
| **Columns written** | `member_id`, `points`, `type`, `description` |

### 3.18 `loyalty_rewards`

| Detail | Value |
|--------|-------|
| **Files** | `src/hooks/useLoyaltyData.ts:228-234` (insert), `src/hooks/useLoyaltyData.ts:242-245` (update), `src/hooks/useLoyaltyData.ts:249-250` (delete) |
| **Operations** | INSERT, UPDATE, DELETE |
| **Columns written** | `group_id` + reward fields |

### 3.19 DemoDataManager Deletes

| Detail | Value |
|--------|-------|
| **Files** | `src/components/settings/DemoDataManager.tsx:53-64` |
| **Operation** | DELETE (batch, by location_id) |
| **Tables** | `pos_daily_finance`, `pos_daily_metrics`, `labour_daily`, `forecast_daily_metrics`, `cogs_daily`, `budgets_daily`, `cash_counts_daily`, `tickets`, `timesheets`, `planned_shifts` |
| **Notes** | Most of these tables do not exist in new DB schema. |

---

## 4. RPC Functions

### 4.1 Auth RPCs

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `get_user_roles_with_scope` | `src/contexts/AuthContext.tsx:77` | `_user_id` | `UserRole[]` (role_name, role_id, location_id, location_name) |
| `is_owner` | `src/contexts/AuthContext.tsx:78` | `_user_id` | `boolean` |
| `get_user_has_global_scope` | `src/contexts/AuthContext.tsx:79` | `_user_id` | `boolean` |
| `get_user_accessible_locations` | `src/contexts/AuthContext.tsx:80` | `_user_id` | `string[]` (location IDs) |
| `get_user_permissions` | `src/contexts/AuthContext.tsx:81` | `_user_id` | `Permission[]` (permission_key, module) |

### 4.2 Data Source RPC

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `resolve_data_source` | `src/hooks/useDataSource.ts:59` | `p_org_id` | `{ data_source, mode, reason, last_synced_at }` |

### 4.3 Sales RPCs

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `get_sales_timeseries_unified` | `src/data/sales.ts:223-228` | `p_org_id`, `p_location_ids`, `p_from`, `p_to` | SalesTimeseriesRpcResult |
| `get_top_products_unified` | `src/data/sales.ts:250-256` | `p_org_id`, `p_location_ids`, `p_from`, `p_to`, `p_limit` | TopProductsRpcResult |
| `get_instant_pnl_unified` | `src/data/sales.ts:277-282` | `p_org_id`, `p_location_ids`, `p_from`, `p_to` | P&L snapshot |
| `menu_engineering_summary` | `src/data/sales.ts:303-308` | `p_date_from`, `p_date_to`, `p_location_id`, `p_data_source` | Product classifications |

### 4.4 Labour RPCs

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `get_labour_kpis` | `src/data/labour.ts:100-105` | `date_from`, `date_to`, `selected_location_id`, `p_data_source` | Aggregated KPIs |
| `get_labour_timeseries` | `src/data/labour.ts:124-129` | `date_from`, `date_to`, `selected_location_id`, `p_data_source` | Daily timeseries |
| `get_labour_locations_table` | `src/data/labour.ts:148-153` | `date_from`, `date_to`, `selected_location_id`, `p_data_source` | Per-location breakdown |
| `get_labor_plan_unified` | `src/data/labour.ts:173-178` | `p_org_id`, `p_location_ids`, `p_from`, `p_to` | Workforce planning data |

### 4.5 Forecast RPCs

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `get_forecast_items_mix_unified` | `src/hooks/useForecastItemsMix.ts:77-86` | `p_org_id`, `p_location_ids`, `p_from`, `p_to`, `p_horizon_days`, `p_limit` | ForecastItemsMixResult |

### 4.6 Data Quality RPC

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `audit_data_coherence` | `src/pages/DebugDataCoherence.tsx:47` | `p_org_id`, `p_location_ids` | Coherence audit results |

### 4.7 Loyalty RPCs

| RPC | File | Parameters | Returns |
|-----|------|-----------|---------|
| `add_loyalty_points` | `src/hooks/useLoyaltyData.ts:209` | `p_member_id`, `p_points`, `p_type`, `p_description`, `p_location_id`, `p_ticket_id` | Updated member |
| `redeem_loyalty_reward` | `src/hooks/useLoyaltyData.ts:259` | `p_member_id`, `p_reward_id`, `p_location_id` | Redemption result |

---

## 5. Edge Functions

### 5.1 Via `supabase.functions.invoke()`

| Function | File | Method | Body | Purpose |
|----------|------|--------|------|---------|
| `seed_demo_users` | `src/pages/Login.tsx:62`, `src/components/settings/DemoDataManager.tsx:71` | POST | `{}` | Seed demo user accounts |
| `seed_josephine_18m` | `src/pages/AdminTools.tsx:29` | POST | `{ horizon_days: 90 }` | Seed 18 months of demo data |
| `seed_josephine_demo` | `src/pages/AdminTools.tsx:54` | POST | `{ horizon_days: 90 }` | Seed 30 days of demo data |
| `generate_forecast_v4` | `src/pages/AdminTools.tsx:79` | POST | `{ horizon_days: 90 }` | Prophet V4 statistical forecast |
| `generate_forecast_v5` | `src/pages/AdminTools.tsx:107` | POST | `{ horizon_days: 90 }` | Prophet V5 ML forecast |
| `send_email_otp` | `src/components/auth/EmailOTPVerification.tsx:47,90,96` | POST | `{ email, action }` | Send/verify email OTP |
| `invite_team_member` | `src/components/settings/TeamManager.tsx:191` | POST | `{ email, role, locationId }` | Invite team member |
| `ai-recommendations` | `src/hooks/useAIRecommendations.ts:87` | POST | `{ locationId }` | Generate AI recommendations |
| `public_reservation` | `src/hooks/usePublicBooking.ts:151` | POST | Reservation data | Create public reservation |
| `generate_forecast` | `src/hooks/useSchedulingSupabase.ts:433` | POST | `{ locationId, days }` | Generate scheduling forecast |
| `generate_schedule` | `src/hooks/useSchedulingSupabase.ts:780` | POST | Schedule config | Auto-generate employee schedule |

### 5.2 Via `fetch()` (raw HTTP)

| Function | File | Method | Purpose |
|----------|------|--------|---------|
| `payroll_api` | `src/lib/payroll-api.ts:17` | POST | Payroll calculation, SEPA XML generation |
| `square-oauth-exchange` | `src/pages/integrations/SquareOAuthCallback.tsx:37` | POST | Exchange Square OAuth code for tokens |
| `sales_insights` | `src/components/bi/AskJosephinePanel.tsx:16`, `src/components/sales/AskJosephineSalesDrawer.tsx:44` | POST | AI sales narrative / Q&A |
| `labour_insights` | `src/components/labour/AskJosephineLabourPanel.tsx:16` | POST | AI labour narrative / Q&A |
| `inventory_insights` | `src/components/inventory/AskJosephineDrawer.tsx:71` | POST | AI inventory narrative / Q&A |
| `dashboard_narratives` | `src/hooks/useAINarratives.ts:3` | POST | AI dashboard narrative |
| `pricing_suggestions` | `src/components/menu-engineering/DynamicPricingPanel.tsx:25` | POST | AI dynamic pricing suggestions |
| `review_reply` | `src/pages/Reviews.tsx:117` | POST | AI-generated review reply |
| *(generic)* | `src/pages/integrations/SquareIntegration.tsx:31` | POST | Calls Square-related edge functions by name |

---

## 6. Realtime Subscriptions

| Channel | Table | File | Events |
|---------|-------|------|--------|
| `data-source-changes` | `integrations` | `src/hooks/useDataSource.ts:94-96` | `*` (INSERT, UPDATE, DELETE) |
| `data-source-changes` | `org_settings` | `src/hooks/useDataSource.ts:98-100` | `*` (INSERT, UPDATE, DELETE) |

---

## 7. Critical Flows

### 7.1 Auth & Bootstrap Flow

```
Login.tsx
  -> supabase.auth.signInWithPassword()
  -> AuthContext: fetchProfile('profiles' .eq('id', userId))
  -> AuthContext: 5 RPCs in parallel (get_user_roles_with_scope, is_owner,
     get_user_has_global_scope, get_user_accessible_locations, get_user_permissions)
  -> DemoModeContext: useDataSource() -> resolve_data_source RPC
  -> AppContext: supabase.from('groups') + supabase.from('locations')
```

**DB dependencies**: `profiles`, `groups` (or `orgs`), `locations`, all 5 auth RPCs, `resolve_data_source` RPC.

### 7.2 Sales Dashboard Flow

```
SalesPage
  -> useSalesData hook
     -> buildQueryContext(orgId, locationIds, dataSource)
     -> getDashboardKpis() -> SELECT sales_daily_unified
     -> getSalesTrends() -> SELECT sales_daily_unified (daily) or sales_hourly_unified (hourly)
     -> getProductSalesDaily() -> SELECT product_sales_daily_unified
     -> getSalesTimeseriesRpc() -> RPC get_sales_timeseries_unified
     -> getTopProductsRpc() -> RPC get_top_products_unified
     -> getInstantPnlRpc() -> RPC get_instant_pnl_unified
     -> getMenuEngineeringSummaryRpc() -> RPC menu_engineering_summary
```

**DB dependencies**: `sales_daily_unified`, `sales_hourly_unified`, `product_sales_daily_unified`, 4 RPCs.

### 7.3 Labour Dashboard Flow

```
LabourPage
  -> useLabourData hook
     -> getLabourDaily() -> SELECT labour_daily_unified
     -> getLabourKpisRpc() -> RPC get_labour_kpis
     -> getLabourTimeseriesRpc() -> RPC get_labour_timeseries
     -> getLabourLocationsRpc() -> RPC get_labour_locations_table
     -> getLaborPlanRpc() -> RPC get_labor_plan_unified
```

**DB dependencies**: `labour_daily_unified`, 4 RPCs.

### 7.4 Budget Flow

```
BudgetPage
  -> useBudgetData hook
     -> getBudgetDaily() -> SELECT budget_daily_unified
     -> getBudgetVsActual() -> SELECT budget_daily_unified + sales_daily_unified
                                     + labour_daily_unified + cogs_daily
```

**DB dependencies**: `budget_daily_unified`, `sales_daily_unified`, `labour_daily_unified`, `cogs_daily`.

### 7.5 Forecast Flow

```
ForecastPage
  -> useForecastData hook
     -> getForecastDaily() -> SELECT forecast_daily_unified
     -> getForecastVsActual() -> SELECT forecast_daily_unified + sales_daily_unified
  -> useForecastItemsMix() -> RPC get_forecast_items_mix_unified
```

**DB dependencies**: `forecast_daily_unified`, `sales_daily_unified`, 1 RPC.

### 7.6 Inventory & Procurement Flow

```
InventoryPage
  -> getLowStockAlerts() -> SELECT inventory_items .eq('group_id', orgId)
  -> createPurchaseOrderDraftFromAlerts()
     -> INSERT purchase_orders (header)
     -> INSERT purchase_order_lines (items)
  -> LogWasteDialog -> INSERT waste_events
```

**DB dependencies**: `inventory_items`, `purchase_orders`, `purchase_order_lines`, `waste_events`.

### 7.7 Payroll Flow

```
PayrollPage
  -> listPayrollRuns() -> SELECT payroll_runs
  -> generatePayrollRunDraft() -> INSERT payroll_runs
  -> PayrollInputs -> SELECT employees, payroll_inputs, employment_contracts
  -> supabase.functions.invoke('payroll_api') for calculation
  -> listPayslips() -> SELECT payslips + employees (enrichment)
  -> approvePayrollRun() -> UPDATE payroll_runs
  -> PayrollPay -> UPDATE payroll_runs
  -> PayrollHome -> DELETE payslips, compliance_submissions, payroll_runs
```

**DB dependencies**: `payroll_runs`, `payslips`, `employees`, `payroll_inputs`, `employment_contracts`, `employee_legal`, `compliance_submissions`, `payroll_api` Edge Function.

### 7.8 Onboarding / Location Setup Flow

```
OnboardingWizard / LocationWizard / LocationManager
  -> INSERT locations (via supabase.from('locations').insert())
  -> INSERT location_settings
  -> INSERT payroll_location_settings
  -> INSERT products (template products)
  -> INSERT employees (template employees)
  -> INSERT pos_tables (default floor plan)
  -> INSERT inventory_items
  -> INSERT suppliers
  -> INSERT user_roles
```

**DB dependencies**: `locations`, `location_settings`, `payroll_location_settings`, `products`, `employees`, `pos_tables`, `inventory_items`, `suppliers`, `user_roles`.

---

## 8. Migration Checklist

### Legend

- **OK** = Table/view exists in new DB with matching columns
- **RENAME** = Table exists but name or column names differ
- **MISSING** = Table/view does not exist in new DB, needs creation
- **RPC** = RPC function needs to be created or verified

### 8.1 Contract Views

| View | Status | New DB Equivalent | Action Needed |
|------|--------|-------------------|---------------|
| `sales_daily_unified` | MISSING | `mv_sales_daily` / `v_actuals_daily_sales` exist but columns differ | Create view with expected columns |
| `sales_hourly_unified` | MISSING | `mv_sales_hourly` / `v_actuals_sales_hourly` exist | Create view with expected columns |
| `product_sales_daily_unified` | MISSING | No equivalent | Create view joining `menu_items` + daily sales |
| `labour_daily_unified` | MISSING | `v_actuals_daily_labour` exists | Create view with expected columns |
| `forecast_daily_unified` | MISSING | `forecast_points` + `forecast_runs` exist | Create view joining forecast tables |
| `budget_daily_unified` | MISSING | `v_budget_metric_final` + `budget_days` exist | Create view pivoting budget metrics |
| `cogs_daily` | MISSING | `v_actuals_daily_cogs_estimate` exists | Create view or alias |

### 8.2 Core Tables

| App Table | Status | New DB Table | Action Needed |
|-----------|--------|-------------|---------------|
| `groups` | RENAME | `orgs` | Create view `groups` -> `orgs` with `id`, `name` |
| `locations` | RENAME | `locations` (exists but `org_id` not `group_id`, no `active` column) | Add `group_id` alias and `active` column or create compatibility view |
| `profiles` | RENAME | `profiles` (exists but `user_id` not `id`, `org_id` not `group_id`) | Create compatibility view |
| `integrations` | OK | `integrations` exists | Verify `metadata` column |
| `employees` | OK-ish | `employees` exists | Verify column names match |
| `inventory_items` | RENAME | `inventory_items` exists but `org_id` not `group_id`, no `current_stock` | Create view or add computed column |
| `purchase_orders` | OK | `purchase_orders` exists | Verify column names |
| `purchase_order_lines` | OK | `purchase_order_lines` exists | Verify column names |
| `waste_events` | MISSING | No equivalent | Create table |
| `suppliers` | RENAME | `suppliers` exists but `org_id` not `group_id` | Create compatibility view |

### 8.3 Missing Tables (Payroll)

| App Table | Status | Action Needed |
|-----------|--------|---------------|
| `payroll_runs` | MISSING | Create table or stub |
| `payslips` | MISSING | Create table or stub |
| `employment_contracts` | MISSING | Create table or stub |
| `employee_legal` | MISSING | Create table or stub |
| `payroll_inputs` | MISSING | Create table or stub |
| `compliance_submissions` | MISSING | Create table or stub |
| `payroll_location_settings` | MISSING | Create table or stub |

### 8.4 Missing Tables (Settings & POS)

| App Table | Status | Action Needed |
|-----------|--------|---------------|
| `location_settings` | MISSING | Create table (or map to `org_settings`) |
| `products` | RENAME | Use `menu_items` — create `products` view |
| `pos_tables` | MISSING | Create table |
| `user_roles` | RENAME | Map to `org_memberships` + `location_memberships` |
| `floor_maps` | MISSING | Create table (referenced by pos_tables insert) |

### 8.5 Missing Tables (Loyalty)

| App Table | Status | Action Needed |
|-----------|--------|---------------|
| `loyalty_settings` | MISSING | Create table |
| `loyalty_members` | MISSING | Create table |
| `loyalty_rewards` | MISSING | Create table |
| `loyalty_transactions` | MISSING | Create table |

### 8.6 Missing Tables (DemoDataManager Deletes)

| App Table | Status | Action Needed |
|-----------|--------|---------------|
| `pos_daily_finance` | MISSING | Create empty stub view or skip |
| `pos_daily_metrics` | MISSING | Create empty stub view or skip |
| `labour_daily` | MISSING | Create empty stub view or skip |
| `forecast_daily_metrics` | MISSING | Create empty stub view or skip |
| `budgets_daily` | MISSING | Create empty stub view or skip |
| `cash_counts_daily` | MISSING | Create empty stub view or skip |
| `tickets` | MISSING | Create empty stub view or skip |
| `timesheets` | MISSING | Create empty stub view or skip |
| `planned_shifts` | MISSING | Create empty stub view or skip |

### 8.7 RPCs

| RPC | Status | Action Needed |
|-----|--------|---------------|
| `get_user_roles_with_scope` | UNKNOWN | Verify exists in new DB |
| `is_owner` | UNKNOWN | Verify exists in new DB |
| `get_user_has_global_scope` | UNKNOWN | Verify exists in new DB |
| `get_user_accessible_locations` | UNKNOWN | Verify exists in new DB |
| `get_user_permissions` | UNKNOWN | Verify exists in new DB |
| `resolve_data_source` | UNKNOWN | Verify exists in new DB |
| `get_sales_timeseries_unified` | MISSING | Create RPC |
| `get_top_products_unified` | MISSING | Create RPC |
| `get_instant_pnl_unified` | MISSING | Create RPC |
| `menu_engineering_summary` | MISSING | Create RPC |
| `get_labour_kpis` | MISSING | Create RPC |
| `get_labour_timeseries` | MISSING | Create RPC |
| `get_labour_locations_table` | MISSING | Create RPC |
| `get_labor_plan_unified` | MISSING | Create RPC |
| `get_forecast_items_mix_unified` | MISSING | Create RPC |
| `audit_data_coherence` | MISSING | Create RPC |
| `add_loyalty_points` | MISSING | Create RPC |
| `redeem_loyalty_reward` | MISSING | Create RPC |

### 8.8 Edge Functions

| Function | Priority | Notes |
|----------|----------|-------|
| `seed_demo_users` | LOW | Admin tooling |
| `seed_josephine_18m` | LOW | Admin tooling |
| `seed_josephine_demo` | LOW | Admin tooling |
| `generate_forecast_v4` | HIGH | Core forecast engine |
| `generate_forecast_v5` | HIGH | Core forecast engine |
| `send_email_otp` | HIGH | Auth flow |
| `invite_team_member` | MEDIUM | Team management |
| `payroll_api` | MEDIUM | Payroll calculation |
| `ai-recommendations` | MEDIUM | AI feature |
| `sales_insights` | MEDIUM | AI feature |
| `labour_insights` | MEDIUM | AI feature |
| `inventory_insights` | MEDIUM | AI feature |
| `dashboard_narratives` | MEDIUM | AI feature |
| `pricing_suggestions` | LOW | AI feature |
| `review_reply` | LOW | AI feature |
| `public_reservation` | HIGH | Public-facing booking |
| `generate_forecast` | MEDIUM | Scheduling forecast |
| `generate_schedule` | MEDIUM | Auto-scheduling |
| `square-oauth-exchange` | HIGH | POS integration |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Contract views read | 7 |
| Direct table reads | 16 unique tables |
| Direct table writes | 19 unique tables |
| RPC functions | 18 |
| Edge functions (invoke) | 11 |
| Edge functions (fetch) | 9 |
| Realtime subscriptions | 2 tables |
| **Tables MISSING in new DB** | **~25** |
| **RPCs MISSING in new DB** | **~14** |
| **Views to CREATE** | **7** |
