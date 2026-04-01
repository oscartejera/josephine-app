# Migration Plan: Legacy DB → New Optimized Schema

**Date:** 2026-02-17
**Author:** Staff Engineer (Claude)
**Status:** DRAFT — pending team review

> **Assumptions** (marked with ASSUMPTION) are best-guess decisions made without clarification.
> **No printing features** are included in this migration.

---

## Table of Contents

1. [Current UI Query Mapping](#1-current-ui-query-mapping)
2. [NEW Stable UI Contract Layer](#2-new-stable-ui-contract-layer)
3. [PR Plan (12 PRs)](#3-pr-plan-12-prs)
4. [Safety: Crash / Infinite-Load Audit](#4-safety-audit)

---

## 1. Current UI Query Mapping

### 1.1 Multi-Tenant / Auth Tables

| Current UI Query | Legacy Table/View | New Source (table/view/rpc) | Change Required (file + function) |
|---|---|---|---|
| Fetch org name | `groups` | `orgs` (new table) | `src/contexts/AppContext.tsx:104` — `.from('groups')` -> `.from('orgs')` |
| Create org on onboarding | `groups` | `orgs` | `src/components/onboarding/OnboardingWizard.tsx:248` — insert into `orgs` |
| Fetch user profile + group_id | `profiles` (has `group_id`) | `profiles` + `org_memberships` (ASSUMPTION: profiles keeps user data, org link moves to `org_memberships`) | `src/contexts/AuthContext.tsx:66` — join `org_memberships` for org_id |
| List profiles for settings | `profiles` | `profiles` (unchanged for user data) | `src/components/settings/UsersRolesManager.tsx:98`, `TeamManager.tsx:92`, `LocationManager.tsx:100,216`, `LocationWizard.tsx:409`, `PrinterConfigManager.tsx:173` — add org filter via `org_memberships` |
| Profile in procurement | `profiles` | `profiles` | `src/pages/ProcurementCart.tsx:76` — minor: filter by org |
| Profile on onboarding | `profiles` | `profiles` + `org_memberships` insert | `src/components/onboarding/OnboardingWizard.tsx:257` — also insert `org_memberships` row |
| User roles CRUD | `user_roles` | `org_memberships` + `location_memberships` (ASSUMPTION: roles embedded in membership tables) | `src/components/settings/UsersRolesManager.tsx:114,186,239`, `TeamManager.tsx:108`, `OnboardingWizard.tsx:271` |
| RBAC RPCs | `get_user_roles_with_scope`, `is_owner`, `get_user_has_global_scope`, `get_user_accessible_locations`, `get_user_permissions` | New RPCs with same signatures reading from `org_memberships` + `location_memberships` | `src/contexts/AuthContext.tsx:77-81` — **no frontend change if RPC signatures preserved** |

### 1.2 Locations

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| List active locations | `locations` (.eq group_id) | `locations` (now FK -> `orgs.id` via `org_id`) | `src/contexts/AppContext.tsx:105` — change `group_id` -> `org_id` |
| Location CRUD | `locations` | `locations` (column rename group_id->org_id) | `src/components/settings/LocationManager.tsx:113,229,503,537`, `LocationWizard.tsx:422`, `BookingSettingsManager.tsx:89,161` |
| Location in onboarding | `locations` | `locations` | `src/components/onboarding/OnboardingWizard.tsx:280` |
| Location in team pages | `locations` | `locations` | `src/pages/team/TeamHome.tsx:98`, `TeamDirectory.tsx:62`, `TeamClock.tsx:30` |
| Location in scheduling | `locations` | `locations` | `src/hooks/useSchedulingSupabase.ts:196` |
| Location settings R/W | `location_settings` | `location_settings` (ASSUMPTION: unchanged, FK still to locations.id) | `src/components/settings/LocationManager.tsx` (4 refs), `ScheduleSettingsSheet.tsx` (2 refs), `OnboardingWizard.tsx:292`, `LocationWizard.tsx:437`, `SettingsPage.tsx` (2 refs), `useSchedulingSupabase.ts:362` |

### 1.3 Sales / Dashboard

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Dashboard gross/net sales | `v_pos_daily_finance_unified` view | **`sales_daily_unified`** (new mat view) | `src/pages/Dashboard.tsx:58` — column names may change |
| Sales for budgets | `v_pos_daily_finance_unified` | **`sales_daily_unified`** | `src/hooks/useBudgetsData.ts:141` |
| Sales for waste | `v_pos_daily_finance_unified` | **`sales_daily_unified`** | `src/hooks/useWasteData.ts:133` |
| Sales for inventory | `v_pos_daily_finance_unified` | **`sales_daily_unified`** | `src/hooks/useInventoryData.ts:166` |
| Sales for cash mgmt | `v_pos_daily_finance_unified` | **`sales_daily_unified`** | `src/hooks/useCashManagementData.ts:123,144` |
| Finance settings data | `pos_daily_finance` | **`sales_daily_unified`** | `src/pages/SettingsPage.tsx:150` |
| Demo data delete | `pos_daily_finance` | **`sales_daily_unified`** or underlying `daily_sales` | `src/components/settings/DemoDataManager.tsx:53` |
| Product sales for inventory | `v_product_sales_daily_unified` view | **`product_sales_daily_unified`** (new view) | `src/hooks/useInventoryData.ts:288` |
| Sales RPCs | `get_daily_sales`, `get_daily_sales_summary`, `get_weekly_sales_summary` | Rewrite RPCs to read from `daily_sales` + CDM | **No frontend change if RPC signatures preserved** |
| Sales timeseries hook | via RPC | Use `sales_daily_unified` | `src/hooks/useSalesTimeseries.ts` — no change if signature kept |
| BI Sales hook | queries via RPC/view | Use `sales_daily_unified` | `src/hooks/useBISalesData.ts` |
| Scheduling sales ref | `sales_daily_unified` | **`sales_daily_unified`** (same name, new backing) | `src/hooks/useSchedulingSupabase.ts:378` |
| Instant P and L | `rpc('get_instant_pnl_unified')` | Rewrite RPC to read new tables | `src/hooks/useInstantPLData.ts:162` — no frontend change |
| Menu engineering | `rpc('menu_engineering_summary')` | Rewrite RPC | `src/hooks/useMenuEngineeringData.ts:83` — no frontend change |

### 1.4 Labour / Scheduling

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Labour cost on dashboard | `labour_daily` | **`labour_daily_unified`** (new view over `time_entries`) | `src/pages/Dashboard.tsx:70` |
| Labour for budgets | `labour_daily` | **`labour_daily_unified`** | `src/hooks/useBudgetsData.ts:155` |
| Labour KPIs RPC | `rpc('get_labour_kpis')` | Rewrite to read `time_entries` + `shifts` | `src/hooks/useLabourData.ts:95` — no frontend change |
| Labour timeseries RPC | `rpc('get_labour_timeseries')` | Rewrite RPC | `src/hooks/useLabourData.ts:112` — no frontend change |
| Labour locations RPC | `rpc('get_labour_locations_table')` | Rewrite RPC | `src/hooks/useLabourData.ts:129` — no frontend change |
| Labor plan unified RPC | `rpc('get_labor_plan_unified')` | Rewrite RPC | `src/hooks/useLaborPlanUnified.ts:77` — no frontend change |
| Planned shifts list | `planned_shifts` | **`shifts`** (new table) | `src/pages/team/TeamSchedule.tsx:73`, `useSchedulingSupabase.ts:310,855`, `TeamPay.tsx:91`, `TeamHome.tsx:129` |
| Timesheets | `timesheets` | **`time_entries`** (new table) | `src/components/payroll/PayrollInputs.tsx:120`, `PayrollValidate.tsx:133` |
| Clock records | `employee_clock_records` | **`time_entries`** (unified) | `src/pages/team/TeamPay.tsx:84`, `TeamHome.tsx:113,152,179`, `src/components/staff/ClockInPanel.tsx:64,110,141` |
| Forecast for scheduling | `forecast_daily_metrics` | **`forecast_daily_unified`** (new view) | `src/hooks/useSchedulingSupabase.ts:343,409` |

### 1.5 Employees

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Employee list (all pages) | `employees` (has `location_id`, `group_id`) | `employees` (ASSUMPTION: rename `group_id`->`org_id`, keep `location_id` FK) | `src/hooks/useSchedulingSupabase.ts:266`, `pages/team/TeamSchedule.tsx:57`, `TeamPay.tsx:66`, `TeamHome.tsx:87`, `TeamDirectory.tsx:40,54`, `TeamClock.tsx:19`, `SettingsPage.tsx:155` |
| Employee in payroll | `employees` | `employees` | `src/components/payroll/PayrollValidate.tsx:60`, `PayrollEmployees.tsx:77,93`, `PayrollReview.tsx:68`, `PayrollInputs.tsx:57`, `PayrollHome.tsx:62`, `PayrollCalculate.tsx:72` |
| Employee CRUD | `employees` | `employees` | `src/components/settings/LocationManager.tsx:356,373`, `LocationWizard.tsx:479`, `OnboardingWizard.tsx:350`, `staff/ClockInPanel.tsx:49` |

### 1.6 Inventory and Procurement

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Inventory items list | `inventory_items` (has `group_id`) | `inventory_items` (rename `group_id`->`org_id`) | `src/pages/inventory-setup/InventoryItems.tsx:132`, `hooks/useReconciliationData.ts:126`, `useProcurementData.ts:264`, `waste/LogWasteDialog.tsx:89`, `inventory/AddItemDialog.tsx:54`, `SettingsPage.tsx:160`, `dashboard/LowStockWidget.tsx:32`, `OnboardingWizard.tsx:397` |
| Stock movements | `stock_movements` | `stock_movements` (ASSUMPTION: unchanged) | Edge functions only |
| Purchase orders | `purchase_orders` | `purchase_orders` (ASSUMPTION: unchanged) | MCP tools + edge functions |
| Suppliers | `suppliers` (has `group_id`) | `suppliers` (rename `group_id`->`org_id`) | Edge functions + MCP |
| Waste events | `waste_events` | `waste_events` (unchanged) | `src/components/waste/LogWasteDialog.tsx` |

### 1.7 Forecasting

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Forecast daily | `forecast_daily_metrics` | **`forecast_daily_unified`** (new view) | `src/hooks/useSchedulingSupabase.ts:343,409` |
| Demo delete forecasts | `forecast_daily_metrics` | underlying `forecast_*` tables | `src/components/settings/DemoDataManager.tsx:56` |

### 1.8 Budgets

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Budgets data | `budgets_daily` | **`budget_daily_unified`** (new view, ASSUMPTION: same columns) | `src/hooks/useBudgetsData.ts:128` |
| Demo delete budgets | `budgets_daily` | underlying `budgets_*` tables | `src/components/settings/DemoDataManager.tsx:58` |

### 1.9 Payroll

| Current UI Query | Legacy Table/View | New Source | Change Required |
|---|---|---|---|
| Payroll runs | `payroll_runs` | `payroll_runs` (ASSUMPTION: unchanged, add FK to `orgs`) | `src/components/payroll/PayrollHome.tsx:213`, `PayrollPay.tsx:70`, `PayrollReview.tsx:111`, `PayrollSubmit.tsx:82`, `PayrollValidate.tsx:210`, `pages/Payroll.tsx:120` |
| Payslips | `payslips` | `payslips` (unchanged) | `src/components/payroll/` (5 files) |
| Employment contracts | `employment_contracts` | `employment_contracts` (unchanged) | `src/components/payroll/` (3 files) |
| Payslip lines | `payslip_lines` | `payslip_lines` (unchanged) | `src/components/payroll/` |

### 1.10 Printing (TO BE REMOVED)

| Current UI Query | Legacy Table/View | Action |
|---|---|---|
| Print queue CRUD | `pos_print_queue` | **DELETE** — remove feature entirely |
| Printer config | `printer_config` | **DELETE** |
| PrintNode credentials | `printnode_credentials` | **DELETE** |

**Files to remove:**
- `src/hooks/usePrintQueue.ts` (6 queries) — delete file
- `src/components/settings/PrinterConfigManager.tsx` — delete component
- Any print-related UI in POS pages

---

## 2. NEW Stable UI Contract Layer

All frontend code reads from these views/RPCs — **never directly from CDM or staging tables**.

### 2.1 `sales_daily_unified` (Materialized View)

Replaces: `v_pos_daily_finance_unified`, `pos_daily_finance`, `sales_daily_unified` (old view)

```sql
CREATE MATERIALIZED VIEW sales_daily_unified AS
SELECT
    ds.date::date                          AS date,
    ds.location_id                         AS location_id,
    l.org_id                               AS org_id,
    ds.net_sales                           AS net_sales,
    ds.gross_sales                         AS gross_sales,
    ds.orders_count                        AS orders_count,
    ds.covers                              AS covers,
    ds.avg_check                           AS avg_check,
    ds.payments_cash                       AS payments_cash,
    ds.payments_card                       AS payments_card,
    ds.payments_other                      AS payments_other,
    ds.refunds_total                       AS refunds_total,
    ds.discounts_total                     AS discounts_total,
    ds.tips_total                          AS tips_total,
    COALESCE(ds.data_source, 'cdm')        AS data_source
FROM daily_sales ds
JOIN locations l ON l.id = ds.location_id;

CREATE UNIQUE INDEX ON sales_daily_unified (date, location_id);
CREATE INDEX ON sales_daily_unified (org_id, date);
```

**Columns consumed by frontend:**

| Column | Type | Used By |
|---|---|---|
| `date` | date | All sales queries (filter) |
| `location_id` | uuid | All sales queries (filter) |
| `org_id` | uuid | Multi-tenant filter |
| `net_sales` | numeric | Dashboard, budgets, P&L |
| `gross_sales` | numeric | Dashboard |
| `orders_count` | integer | Dashboard, forecasting |
| `covers` | integer | Scheduling labor plan |
| `avg_check` | numeric | Dashboard KPIs |
| `payments_cash` | numeric | Cash management |
| `payments_card` | numeric | Cash management |
| `data_source` | text | Data source toggle |

**Refresh:** `REFRESH MATERIALIZED VIEW CONCURRENTLY sales_daily_unified;` — triggered by ETL or cron.

### 2.2 `sales_hourly_unified` (View)

New — enables hourly drill-down for scheduling and forecasting.

```sql
CREATE VIEW sales_hourly_unified AS
SELECT
    date_trunc('hour', f.ts_bucket)        AS hour,
    f.ts_bucket::date                      AS date,
    f.location_id,
    l.org_id,
    SUM(f.sales_net)                       AS net_sales,
    SUM(f.sales_gross)                     AS gross_sales,
    SUM(f.tickets)                         AS orders_count,
    SUM(f.covers)                          AS covers
FROM facts_sales_15m f
JOIN locations l ON l.id = f.location_id
GROUP BY 1, 2, 3, 4;
```

| Column | Type | Used By |
|---|---|---|
| `hour` | timestamptz | Hourly forecast, scheduling |
| `date` | date | Date filter |
| `location_id` | uuid | Location filter |
| `org_id` | uuid | Tenant filter |
| `net_sales` | numeric | Hourly sales chart |
| `gross_sales` | numeric | Hourly sales chart |
| `orders_count` | integer | Hourly orders chart |
| `covers` | integer | Covers per hour |

### 2.3 `product_sales_daily_unified` (View)

Replaces: `v_product_sales_daily_unified`, `product_sales_daily`

```sql
CREATE VIEW product_sales_daily_unified AS
SELECT
    psd.date,
    psd.location_id,
    l.org_id,
    psd.product_id,
    p.name                                 AS product_name,
    p.category                             AS category,
    psd.units_sold,
    psd.net_sales,
    psd.gross_sales,
    psd.cogs,
    psd.margin,
    psd.margin_percent
FROM product_sales_daily psd
JOIN locations l ON l.id = psd.location_id
LEFT JOIN products p ON p.id = psd.product_id;
```

| Column | Type | Used By |
|---|---|---|
| `date` | date | Date filter |
| `location_id` | uuid | Location filter |
| `org_id` | uuid | Tenant filter |
| `product_id` | uuid | Product drill-down |
| `product_name` | text | Display |
| `category` | text | Category grouping |
| `units_sold` | integer | Menu engineering, top products |
| `net_sales` | numeric | Revenue analysis |
| `cogs` | numeric | Margin calculation |
| `margin_percent` | numeric | Menu engineering classification |

### 2.4 `labour_daily_unified` (View)

Replaces: `labour_daily`, `facts_labor_daily`

```sql
CREATE VIEW labour_daily_unified AS
SELECT
    te.work_date                           AS date,
    te.location_id,
    l.org_id,
    COUNT(DISTINCT te.employee_id)         AS headcount,
    SUM(te.hours_worked)                   AS actual_hours,
    SUM(te.labour_cost)                    AS labour_cost,
    SUM(s.scheduled_hours)                 AS scheduled_hours,
    SUM(s.scheduled_cost)                  AS scheduled_cost,
    sdu.net_sales,
    CASE WHEN sdu.net_sales > 0
         THEN ROUND(SUM(te.labour_cost) / sdu.net_sales * 100, 2)
         ELSE 0
    END                                    AS col_percent
FROM time_entries te
JOIN locations l ON l.id = te.location_id
LEFT JOIN LATERAL (
    SELECT
        SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600) AS scheduled_hours,
        SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600 * e.hourly_cost) AS scheduled_cost
    FROM shifts sh
    JOIN employees e ON e.id = sh.employee_id
    WHERE sh.shift_date = te.work_date AND sh.location_id = te.location_id
) s ON true
LEFT JOIN sales_daily_unified sdu
    ON sdu.date = te.work_date AND sdu.location_id = te.location_id
GROUP BY te.work_date, te.location_id, l.org_id, sdu.net_sales;
```

| Column | Type | Used By |
|---|---|---|
| `date` | date | Date filter |
| `location_id` | uuid | Location filter |
| `org_id` | uuid | Tenant filter |
| `headcount` | integer | Labour dashboard |
| `actual_hours` | numeric | Labour KPIs |
| `labour_cost` | numeric | Dashboard, P&L, budgets |
| `scheduled_hours` | numeric | Schedule vs actual |
| `scheduled_cost` | numeric | Budget comparison |
| `net_sales` | numeric | COL% calculation |
| `col_percent` | numeric | Labour KPI |

### 2.5 `budget_daily_unified` (View)

Replaces: `budgets_daily`

```sql
CREATE VIEW budget_daily_unified AS
SELECT
    b.date,
    b.location_id,
    l.org_id,
    b.budget_sales,
    b.budget_labour,
    b.budget_cogs,
    b.budget_covers,
    sdu.net_sales                          AS actual_sales,
    ldu.labour_cost                        AS actual_labour,
    CASE WHEN b.budget_sales > 0
         THEN ROUND((sdu.net_sales - b.budget_sales) / b.budget_sales * 100, 2)
         ELSE NULL
    END                                    AS sales_variance_pct,
    CASE WHEN b.budget_labour > 0
         THEN ROUND((ldu.labour_cost - b.budget_labour) / b.budget_labour * 100, 2)
         ELSE NULL
    END                                    AS labour_variance_pct
FROM budgets_daily b
JOIN locations l ON l.id = b.location_id
LEFT JOIN sales_daily_unified sdu
    ON sdu.date = b.date AND sdu.location_id = b.location_id
LEFT JOIN labour_daily_unified ldu
    ON ldu.date = b.date AND ldu.location_id = b.location_id;
```

| Column | Type | Used By |
|---|---|---|
| `date` | date | Filter |
| `location_id` | uuid | Filter |
| `org_id` | uuid | Tenant filter |
| `budget_sales` | numeric | Budget vs actual chart |
| `budget_labour` | numeric | Budget vs actual chart |
| `actual_sales` | numeric | Variance calc |
| `actual_labour` | numeric | Variance calc |
| `sales_variance_pct` | numeric | KPI cards |
| `labour_variance_pct` | numeric | KPI cards |

### 2.6 `forecast_daily_unified` (View)

Replaces: `forecast_daily_metrics`

```sql
CREATE VIEW forecast_daily_unified AS
SELECT
    f.date,
    f.location_id,
    l.org_id,
    f.forecast_sales,
    f.forecast_orders,
    f.forecast_covers,
    f.forecast_labour_hours,
    f.confidence_lower,
    f.confidence_upper,
    f.mape,
    f.model_version,
    sdu.net_sales                          AS actual_sales,
    sdu.orders_count                       AS actual_orders,
    ABS(sdu.net_sales - f.forecast_sales)  AS forecast_error
FROM forecast_daily_metrics f
JOIN locations l ON l.id = f.location_id
LEFT JOIN sales_daily_unified sdu
    ON sdu.date = f.date AND sdu.location_id = f.location_id;
```

| Column | Type | Used By |
|---|---|---|
| `date` | date | Filter |
| `location_id` | uuid | Filter |
| `org_id` | uuid | Tenant filter |
| `forecast_sales` | numeric | Forecast chart |
| `forecast_orders` | integer | Scheduling |
| `forecast_covers` | integer | Scheduling |
| `forecast_labour_hours` | numeric | Labour planning |
| `mape` | numeric | Model accuracy |
| `actual_sales` | numeric | Forecast vs actual |

### 2.7 Payroll Views (MVP)

#### `payroll_summary_unified`

```sql
CREATE VIEW payroll_summary_unified AS
SELECT
    pr.id                                  AS payroll_run_id,
    pr.org_id,
    pr.period_year,
    pr.period_month,
    pr.status,
    pr.created_at,
    COUNT(ps.id)                           AS employee_count,
    SUM(ps.gross_pay)                      AS total_gross,
    SUM(ps.net_pay)                        AS total_net,
    SUM(ps.irpf_withheld)                  AS total_irpf,
    SUM(COALESCE(ps.ss_employee,0) + COALESCE(ps.ss_employer,0)) AS total_ss
FROM payroll_runs pr
LEFT JOIN payslips ps ON ps.payroll_run_id = pr.id
GROUP BY pr.id;
```

#### `payslip_detail_unified`

```sql
CREATE VIEW payslip_detail_unified AS
SELECT
    ps.id                                  AS payslip_id,
    ps.payroll_run_id,
    pr.org_id,
    pr.period_year,
    pr.period_month,
    ps.employee_id,
    e.full_name                            AS employee_name,
    e.location_id,
    ps.gross_pay,
    ps.net_pay,
    ps.irpf_withheld,
    ps.base_salary,
    ps.hours_worked,
    ec.contract_type,
    ec.irpf_rate
FROM payslips ps
JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
JOIN employees e ON e.id = ps.employee_id
LEFT JOIN employment_contracts ec
    ON ec.employee_id = e.id AND ec.active = true;
```

### 2.8 RPC Functions (Preserved Signatures)

These RPCs are rewritten internally but keep the same input/output contract:

| RPC | Reads From (New) | Frontend Files |
|---|---|---|
| `get_user_roles_with_scope(_user_id)` | `org_memberships` + `location_memberships` | `AuthContext.tsx:77` |
| `is_owner(_user_id)` | `org_memberships` | `AuthContext.tsx:78` |
| `get_user_has_global_scope(_user_id)` | `org_memberships` | `AuthContext.tsx:79` |
| `get_user_accessible_locations(_user_id)` | `location_memberships` | `AuthContext.tsx:80` |
| `get_user_permissions(_user_id)` | `org_memberships` + `role_permissions` | `AuthContext.tsx:81` |
| `get_labour_kpis(...)` | `time_entries` + `shifts` | `useLabourData.ts:95` |
| `get_labour_timeseries(...)` | `time_entries` + `shifts` | `useLabourData.ts:112` |
| `get_labour_locations_table(...)` | `labour_daily_unified` | `useLabourData.ts:129` |
| `get_labor_plan_unified(...)` | `shifts` + `forecast_daily_unified` | `useLaborPlanUnified.ts:77` |
| `get_instant_pnl_unified(...)` | `sales_daily_unified` + `labour_daily_unified` + `cogs_daily` | `useInstantPLData.ts:162` |
| `menu_engineering_summary(...)` | `product_sales_daily_unified` | `useMenuEngineeringData.ts:83` |
| `resolve_data_source(...)` | `locations` + `integrations` | `useDataSource.ts:59` |
| `audit_data_coherence(...)` | Multiple unified views | `DebugDataCoherence.tsx:47` |

---

## 3. PR Plan (12 PRs)

### PR 1: Foundation — `orgs` + `org_memberships` + `location_memberships`

**Goal:** Create new multi-tenant tables, backfill from `groups`/`profiles`/`user_locations`, create compatibility views.

**DB Migrations:**
1. `CREATE TABLE orgs` (id, name, created_at, updated_at)
2. `CREATE TABLE org_memberships` (id, org_id, user_id, role, created_at)
3. `CREATE TABLE location_memberships` (id, org_id, location_id, user_id, role, created_at)
4. `INSERT INTO orgs SELECT id, name, created_at, updated_at FROM groups`
5. `ALTER TABLE locations ADD COLUMN org_id UUID REFERENCES orgs(id)`
6. `UPDATE locations SET org_id = group_id`
7. Backfill `org_memberships` from `profiles` + `user_roles`
8. Backfill `location_memberships` from `user_locations` + `user_roles`
9. Create compatibility view: `CREATE VIEW groups AS SELECT id, name FROM orgs` (temporary)

**Files:**
- `supabase/migrations/20260218_001_create_orgs.sql`
- `supabase/migrations/20260218_002_backfill_orgs.sql`

**Tests:**
- Verify backfill: row counts match
- Verify compatibility view returns same data
- Verify RLS policies on new tables

---

### PR 2: Rewrite RBAC RPCs

**Goal:** Rewrite all 5 auth RPCs to read from `org_memberships`/`location_memberships` while keeping exact same signatures.

**DB Migrations:**
1. `CREATE OR REPLACE FUNCTION get_user_roles_with_scope(...)` — reads `org_memberships` + `location_memberships`
2. Same for `is_owner`, `get_user_has_global_scope`, `get_user_accessible_locations`, `get_user_permissions`

**Files:**
- `supabase/migrations/20260218_003_rewrite_rbac_rpcs.sql`

**Tests:**
- For each RPC: call with known user, compare output to legacy RPC output
- Integration test: login flow still works (AuthContext loads without error)
- `src/contexts/AuthContext.tsx` — **zero changes needed** (signatures preserved)

---

### PR 3: Frontend Multi-Tenant — `groups` to `orgs`, `group_id` to `org_id`

**Goal:** Update all frontend `.from('groups')` to `.from('orgs')` and `.eq('group_id', ...)` to `.eq('org_id', ...)`.

**Files (8 files):**
- `src/contexts/AppContext.tsx:104` — `.from('groups')` to `.from('orgs')`; `:105` — `group_id` to `org_id`
- `src/components/onboarding/OnboardingWizard.tsx:248` — `.from('groups')` to `.from('orgs')`; `:280` — `group_id` to `org_id`
- `src/components/settings/LocationManager.tsx:113,229` — `group_id` to `org_id` on locations queries
- `src/components/settings/LocationWizard.tsx:422` — `group_id` to `org_id`
- `src/components/settings/DemoDataManager.tsx:50` — `group_id` to `org_id`
- `src/integrations/supabase/types.ts` — update generated types (or regenerate)

**DB Migrations:** None (compatibility view from PR1 covers transition)

**Tests:**
- `npm run build` passes
- Manual: navigate to each settings page, verify locations load
- Verify AppContext loads org name correctly

---

### PR 4: `staging_square_*` + CDM Pipeline

**Goal:** Create staging tables for Square raw data, update ETL to write to staging then CDM.

**DB Migrations:**
1. `CREATE TABLE staging_square_orders` (id, raw_payload jsonb, square_id, location_id, created_at, processed_at)
2. `CREATE TABLE staging_square_payments` (same pattern)
3. `CREATE TABLE staging_square_items` (same pattern)
4. `CREATE TABLE staging_square_modifiers` (same pattern)
5. Update `raw_events` processing to write to staging first

**Files:**
- `supabase/migrations/20260219_001_create_staging_tables.sql`
- `supabase/functions/process-raw-events/index.ts` — write to staging_square_* instead of directly to CDM
- `supabase/functions/square-sync/index.ts` — update sync pipeline

**Tests:**
- Insert test raw event, verify staging row created
- Verify CDM populated from staging
- Verify `facts_sales_15m` still populated downstream

---

### PR 5: `daily_sales` Table + `sales_daily_unified` Materialized View

**Goal:** Create the `daily_sales` physical table, populate from CDM, create the `sales_daily_unified` materialized view.

**DB Migrations:**
1. `CREATE TABLE daily_sales` (date, location_id, net_sales, gross_sales, orders_count, covers, avg_check, payments_cash, payments_card, payments_other, refunds_total, discounts_total, tips_total, data_source)
2. Backfill `daily_sales` from `pos_daily_finance` + `cdm_orders` aggregation
3. `CREATE MATERIALIZED VIEW sales_daily_unified AS ...` (see section 2.1)
4. Drop old view `v_pos_daily_finance_unified` and recreate as alias to `sales_daily_unified`

**Files (frontend, 7 files):**
- `src/pages/Dashboard.tsx:58` — `.from('v_pos_daily_finance_unified')` to `.from('sales_daily_unified')`, update column names (`data_source_unified` to `data_source`)
- `src/hooks/useBudgetsData.ts:141` — same change
- `src/hooks/useWasteData.ts:133` — same change
- `src/hooks/useInventoryData.ts:166` — same change
- `src/hooks/useCashManagementData.ts:123,144` — same change
- `src/pages/SettingsPage.tsx:150` — `.from('pos_daily_finance')` to `.from('sales_daily_unified')`
- `src/components/settings/DemoDataManager.tsx:53` — update delete target

**Tests:**
- Verify materialized view row count matches legacy view
- Verify Dashboard loads net_sales correctly
- `npm run build` passes, `npm test` passes

---

### PR 6: `product_sales_daily_unified` View

**Goal:** Create the product-level sales view, update inventory hooks.

**DB Migrations:**
1. `CREATE VIEW product_sales_daily_unified AS ...` (see section 2.3)
2. Drop old `v_product_sales_daily_unified`

**Files (2 files):**
- `src/hooks/useInventoryData.ts:288` — `.from('v_product_sales_daily_unified' as any)` to `.from('product_sales_daily_unified')` (remove `as any` cast)
- `src/hooks/useTopProductsUnified.ts` — update if it reads product_sales_daily directly

**Tests:**
- Verify inventory page loads product-level data
- Verify menu engineering page works
- `npm run build` passes

---

### PR 7: `schedules` + `shifts` + `time_entries` Tables

**Goal:** Create new scheduling/workforce tables, backfill from legacy, update frontend.

**DB Migrations:**
1. `CREATE TABLE schedules` (id, org_id, location_id, week_start, status, published_at, created_at)
2. `CREATE TABLE shifts` (id, schedule_id, employee_id, location_id, shift_date, start_time, end_time, role, break_minutes, status, created_at)
3. `CREATE TABLE time_entries` (id, employee_id, location_id, work_date, clock_in, clock_out, hours_worked, labour_cost, source, break_minutes, approved, created_at)
4. Backfill `shifts` from `planned_shifts`
5. Backfill `time_entries` from `employee_clock_records` + `timesheets`
6. Create compatibility views: `CREATE VIEW planned_shifts AS SELECT ... FROM shifts` (temporary)

**Files (11 files):**
- `src/pages/team/TeamSchedule.tsx:73` — `planned_shifts` to `shifts`
- `src/hooks/useSchedulingSupabase.ts:310,855` — `planned_shifts` to `shifts`
- `src/pages/team/TeamPay.tsx:84,91` — `employee_clock_records` to `time_entries`, `planned_shifts` to `shifts`
- `src/pages/team/TeamHome.tsx:113,129,152,179` — `employee_clock_records` to `time_entries`, `planned_shifts` to `shifts`
- `src/components/staff/ClockInPanel.tsx:64,110,141` — `employee_clock_records` to `time_entries`
- `src/components/payroll/PayrollInputs.tsx:120` — `timesheets` to `time_entries`
- `src/components/payroll/PayrollValidate.tsx:133` — `timesheets` to `time_entries`
- `src/components/settings/DemoDataManager.tsx:63,64` — update delete targets

**Tests:**
- Verify TeamSchedule page loads shifts
- Verify ClockInPanel creates time_entries
- Verify payroll reads from time_entries
- `npm run build` passes

---

### PR 8: `labour_daily_unified` + `forecast_daily_unified` + `budget_daily_unified` Views

**Goal:** Create remaining unified views for labour, forecast, budgets.

**DB Migrations:**
1. `CREATE VIEW labour_daily_unified AS ...` (see section 2.4)
2. `CREATE VIEW forecast_daily_unified AS ...` (see section 2.6)
3. `CREATE VIEW budget_daily_unified AS ...` (see section 2.5)

**Files (5 files):**
- `src/pages/Dashboard.tsx:70` — `.from('labour_daily')` to `.from('labour_daily_unified')`
- `src/hooks/useBudgetsData.ts:155` — `.from('labour_daily')` to `.from('labour_daily_unified')`
- `src/hooks/useBudgetsData.ts:128` — `.from('budgets_daily')` to `.from('budget_daily_unified')`
- `src/hooks/useSchedulingSupabase.ts:343,409` — `.from('forecast_daily_metrics')` to `.from('forecast_daily_unified')`
- `src/components/settings/DemoDataManager.tsx:55,56,58` — update delete targets

**Tests:**
- Verify Dashboard labour cost loads
- Verify budgets page loads
- Verify scheduling forecast loads
- `npm run build` passes

---

### PR 9: Rewrite Labour + Sales RPCs

**Goal:** Rewrite backend RPCs to read from new unified views/tables.

**DB Migrations:**
1. `CREATE OR REPLACE FUNCTION get_labour_kpis(...)` — reads `time_entries` + `shifts`
2. `CREATE OR REPLACE FUNCTION get_labour_timeseries(...)` — reads `labour_daily_unified`
3. `CREATE OR REPLACE FUNCTION get_labour_locations_table(...)` — reads `labour_daily_unified`
4. `CREATE OR REPLACE FUNCTION get_labor_plan_unified(...)` — reads `shifts` + `forecast_daily_unified`
5. `CREATE OR REPLACE FUNCTION get_instant_pnl_unified(...)` — reads unified views
6. `CREATE OR REPLACE FUNCTION menu_engineering_summary(...)` — reads `product_sales_daily_unified`
7. `CREATE OR REPLACE FUNCTION get_daily_sales(...)` — reads `sales_daily_unified`

**Files:**
- `supabase/migrations/20260220_001_rewrite_rpcs.sql`
- **Zero frontend changes** (signatures preserved)

**Tests:**
- Call each RPC, verify output shape matches legacy
- Verify useLabourData hook returns data
- Verify useInstantPLData hook returns data

---

### PR 10: Payroll Views + Module Cleanup

**Goal:** Create payroll unified views, verify payroll module works with new schema.

**DB Migrations:**
1. `CREATE VIEW payroll_summary_unified AS ...` (see section 2.7)
2. `CREATE VIEW payslip_detail_unified AS ...` (see section 2.7)
3. `ALTER TABLE payroll_runs ADD COLUMN org_id UUID REFERENCES orgs(id)`
4. Backfill `payroll_runs.org_id` from `payroll_runs.group_id`

**Files (3 files):**
- `src/components/payroll/PayrollHome.tsx` — optionally use `payroll_summary_unified`
- `src/components/payroll/PayrollReview.tsx` — optionally use `payslip_detail_unified`
- `src/pages/Payroll.tsx:120` — `group_id` to `org_id` filter on payroll_runs

**Tests:**
- Verify payroll home page loads run list
- Verify payroll review shows payslips
- Verify payroll calculate works end-to-end

---

### PR 11: Remove Printing Feature + Dead Code

**Goal:** Remove all printing-related code (not wanted in new schema).

**Files to DELETE:**
- `src/hooks/usePrintQueue.ts` (entire file — 6 `.from('pos_print_queue')` calls)
- `src/components/settings/PrinterConfigManager.tsx` (entire file)
- Any print-related imports/routes referencing these files

**Files to EDIT:**
- `src/pages/SettingsPage.tsx` — remove printer config section
- Navigation/sidebar — remove print-related menu items

**DB Migration:**
- ASSUMPTION: Do NOT drop tables yet — just remove frontend references. Tables can be dropped in cleanup PR.

**Tests:**
- `npm run build` passes (no broken imports)
- `npm run lint` passes
- Verify Settings page loads without printer section

---

### PR 12: Edge Functions + AI Tools Update

**Goal:** Update all Supabase Edge Functions and AI tools to use new schema.

**Files:**
- `supabase/functions/generate_forecast_v4/index.ts` — read from `daily_sales` instead of `facts_sales_15m` for daily
- `supabase/functions/generate_schedule/index.ts` — read `shifts` instead of `planned_shifts`, write `shifts`
- `supabase/functions/payroll_api/index.ts` — `group_id` to `org_id`
- `supabase/functions/payroll_calculate/index.ts` — same
- `supabase/functions/ai-tools/index.ts` — update tenant resolution: `profiles.group_id` to `org_memberships`
- `src/ai-tools-core/` — update `TenantContext` type: `orgId` resolution path
- `supabase/functions/seed_*` — update to write to new tables
- `supabase/functions/send_daily_report/index.ts` — read from unified views
- `supabase/functions/send_kpi_alerts/index.ts` — read from unified views

**Tests:**
- Deploy edge functions to staging
- Call `ai-tools` endpoint with test JWT
- Verify forecast generation works
- Verify schedule generation works

---

### PR 13 (Cleanup — merge last): Drop Legacy Tables + Compatibility Views

**Goal:** Remove backward-compatibility views and old tables after all code migrated.

**Prerequisites:** All PRs 1-12 merged and stable for at least 1 week.

**DB Migrations:**
1. `DROP VIEW IF EXISTS groups` (compat view)
2. `DROP VIEW IF EXISTS planned_shifts` (compat view)
3. `ALTER TABLE locations DROP COLUMN group_id`
4. Drop `v_pos_daily_finance_unified` alias if still exists
5. Consider dropping `pos_print_queue`, `printer_config`, `printnode_credentials` tables

**Tests:**
- Full regression test of all pages
- `npm run build && npm run lint && npm test`

---

### Dependency Graph

```
PR1 (orgs/memberships)
 |-- PR2 (RBAC RPCs)         <- depends on PR1 tables
 |-- PR3 (frontend groups->orgs) <- depends on PR1 compat views
 |-- PR4 (staging tables)    <- independent of PR1
 |
PR5 (daily_sales + sales MV)  <- depends on PR1 (org_id on locations)
 |-- PR6 (product_sales view)  <- depends on PR5
 |
PR7 (shifts + time_entries)  <- depends on PR1
 |
PR8 (labour/forecast/budget views) <- depends on PR5 + PR7
 |-- PR9 (rewrite RPCs)      <- depends on PR8 views
 |
PR10 (payroll views)          <- depends on PR1
PR11 (remove printing)        <- independent, merge anytime
PR12 (edge functions)         <- depends on PR1-PR9
PR13 (cleanup)                <- depends on ALL above, merge last
```

**Critical path:** PR1 -> PR5 -> PR7 -> PR8 -> PR9 -> PR12 -> PR13

**Parallelizable:**
- PR2, PR3, PR4 can run in parallel after PR1
- PR6 can run in parallel with PR7
- PR10, PR11 can run at any point after PR1

---

## 4. Safety Audit: Crash / Infinite-Load Risks

### 4.1 React Query `enabled` Guards — Missing or Weak

| File | Line | Current Guard | Risk | Fix |
|---|---|---|---|---|
| `src/hooks/useLabourData.ts` | 93, 110, 127 | `enabled: !appLoading && !!dataSource` | If `dataSource` is never resolved (no integration), query stays disabled forever, empty UI with no feedback | Add fallback: if `dataSource` is null after 5s, show "No POS connected" message |
| `src/hooks/useInstantPLData.ts` | 275 | `enabled: !!orgId` | If `orgId` is null (new user, no org yet), P&L never loads | Guard in component: show onboarding prompt when orgId is null |
| `src/hooks/useLaborPlanUnified.ts` | 91 | `enabled: !!orgId && locationIds.length > 0` | Same null-org risk | Same fix |
| `src/hooks/useTopProductsUnified.ts` | 79 | `enabled: enabled && !!orgId && locationIds.length > 0` | If `locationIds` is empty array (user with no location access), query never fires | Show "No locations assigned" state |
| `src/hooks/useBISalesData.ts` | 167 | `enabled: !!orgId && effectiveLocationIds.length > 0` | Same empty-locations risk | Same fix |
| `src/hooks/useSalesTimeseries.ts` | 104 | `enabled: enabled && !!orgId && locationIds.length > 0` | Same | Same |
| `src/hooks/useForecastItemsMix.ts` | 92 | `enabled: enabled && !!orgId && locationIds.length > 0` | Same | Same |
| `src/hooks/useControlTowerData.ts` | 43 | `enabled: !!orgId && locationIds.length > 0 && !!session` | Triple guard, safest | OK |
| `src/hooks/useSchedulingSupabase.ts` | 563-622 | `enabled: !!locationId` (6 queries) | If `locationId` is null (no location selected), 6 queries stay disabled | Add location selector with auto-select first location |

### 4.2 Null `org_id` / `group_id` Crashes

| File | Line | Risk | Fix |
|---|---|---|---|
| `src/contexts/AppContext.tsx` | 104-105 | If `profiles` has no `group_id`, both queries fail, AppContext crash, white screen | Add null check: `if (!groupId) return { org: null, locations: [] }` and render onboarding |
| `src/contexts/AuthContext.tsx` | 77-81 | If user has no profile row, all 5 RPCs throw, crash | Wrap in try-catch, set default empty permissions |
| `src/components/onboarding/OnboardingWizard.tsx` | 248-280 | Creates `groups` + `locations` + `profiles` in sequence. If any step fails, partial state means broken org | Wrap in transaction (or use RPC that does all inserts atomically) |

### 4.3 Empty Location Arrays

| File | Risk | Fix |
|---|---|---|
| `src/pages/Dashboard.tsx` | If `locationIds` is `[]`, queries to `v_pos_daily_finance_unified` use `.in('location_id', [])`, Supabase returns error or empty | Guard: skip query when array empty, show "No locations" |
| `src/hooks/useBudgetsData.ts` | Same `.in()` with empty array risk | Same guard |
| `src/hooks/useInventoryData.ts` | Same | Same |
| `src/hooks/useCashManagementData.ts` | Same | Same |
| `src/hooks/useWasteData.ts` | Same | Same |

**Global fix:** Create a utility hook `useGuardedQuery` that wraps `useQuery` and automatically disables when orgId is null or locationIds is empty, returning a typed "not-ready" state instead of undefined.

### 4.4 Views Referencing Dropped Tables

| Risk | Detail | Fix |
|---|---|---|
| `sales_daily_unified` (old view) | Currently a view over `pos_daily_finance`. If we drop `pos_daily_finance` before creating new materialized view, **entire dashboard crashes** | PR5 must create new MV **before** dropping old view. Use `CREATE OR REPLACE` |
| `v_pos_daily_finance_unified` | Same risk | Create alias/redirect in same migration |
| `v_product_sales_daily_unified` | Depends on `product_sales_daily` table | Ensure table exists before view creation |

### 4.5 Compatibility View Ordering (CRITICAL)

**Migration order MUST be:**
1. Create new tables (`orgs`, `daily_sales`, `shifts`, `time_entries`)
2. Backfill data into new tables
3. Create new unified views (`sales_daily_unified`, etc.)
4. Create compatibility views for old names pointing to new views
5. Update frontend code to use new names
6. (Later) Drop compatibility views and old tables

**If step 5 happens before step 3, the app crashes.**

### 4.6 `as any` Type Casts — Silent Breakage

| File | Line | Cast | Risk | Fix |
|---|---|---|---|---|
| `src/hooks/useWasteData.ts` | 133 | `.from('v_pos_daily_finance_unified' as any)` | TypeScript won't catch if view is renamed/dropped | Remove cast when switching to `sales_daily_unified`, regenerate Supabase types |
| `src/hooks/useInventoryData.ts` | 166 | `.from('v_pos_daily_finance_unified' as any)` | Same | Same |
| `src/hooks/useInventoryData.ts` | 288 | `.from('v_product_sales_daily_unified' as any)` | Same | Same |
| `src/hooks/useCashManagementData.ts` | 123, 144 | `.from('v_pos_daily_finance_unified' as any)` | Same | Same |
| `src/hooks/useBudgetsData.ts` | 141 | `.from('v_pos_daily_finance_unified' as any)` | Same | Same |

**Fix:** After creating new views, run `supabase gen types typescript` to regenerate `src/integrations/supabase/types.ts`. All `as any` casts become unnecessary.

### 4.7 DemoDataManager Cascade Deletes

| File | Line | Risk | Fix |
|---|---|---|---|
| `src/components/settings/DemoDataManager.tsx` | 50-64 | Deletes from 10+ tables by `location_id` in sequence. If new tables (`shifts`, `time_entries`) have FK constraints, deletes fail with FK violation | Update delete sequence to include new tables in correct order (children before parents) |

### 4.8 Edge Function Cold Start + New Schema

| Function | Risk | Fix |
|---|---|---|
| `supabase/functions/ai-tools/index.ts` | Resolves tenant from `profiles.group_id`. If column removed, all AI tool calls fail | Update to `org_memberships` in PR12 **before** dropping `group_id` column in PR13 |
| `supabase/functions/generate_forecast_v4/index.ts` | Reads `locations` with `group_id` | Update FK references in PR12 |
| `supabase/functions/payroll_api/index.ts` | Reads `groups` table directly (3 locations) | Update to `orgs` in PR12 |

---

## Appendix A: Complete Table Reference Count

| Table | Frontend .from() | Frontend .rpc() | Edge Functions | Action |
|---|---|---|---|---|
| `groups` | 2 | 0 | 13 | **Rename to `orgs`** |
| `profiles` | 9 | 0 | 5 | **Keep, remove group_id** |
| `user_roles` | 5 | 0 | 0 | **Replace with `org_memberships`** |
| `user_locations` | 0 | (via RPC) | 0 | **Replace with `location_memberships`** |
| `locations` | 15 | 0 | 36 | **Keep, add org_id** |
| `location_settings` | 12 | 0 | 6 | **Keep** |
| `employees` | 20 | 0 | 24 | **Keep, rename group_id** |
| `planned_shifts` | 6 | 0 | 4 | **Replace with `shifts`** |
| `timesheets` | 3 | 0 | 0 | **Replace with `time_entries`** |
| `employee_clock_records` | 7 | 0 | 0 | **Replace with `time_entries`** |
| `labour_daily` | 3 | 0 | 9 | **Replace with `labour_daily_unified`** |
| `pos_daily_finance` | 2 | 0 | 0 | **Replace with `sales_daily_unified`** |
| `v_pos_daily_finance_unified` | 7 | 0 | 0 | **Replace with `sales_daily_unified`** |
| `v_product_sales_daily_unified` | 1 | 0 | 0 | **Replace with `product_sales_daily_unified`** |
| `sales_daily_unified` | 1 | 0 | 0 | **Recreate as materialized view** |
| `forecast_daily_metrics` | 3 | 0 | 8 | **Replace with `forecast_daily_unified`** |
| `budgets_daily` | 2 | 0 | 0 | **Replace with `budget_daily_unified`** |
| `inventory_items` | 8 | 0 | 10 | **Keep, rename group_id** |
| `products` | 9 | 0 | 6 | **Keep** |
| `payroll_runs` | 6 | 0 | 12 | **Keep, add org_id** |
| `payslips` | 5 | 0 | 7 | **Keep** |
| `pos_print_queue` | 6 | 0 | 3 | **DELETE (no printing)** |
| `printer_config` | 0 | 0 | 0 | **DELETE (no printing)** |
| `printnode_credentials` | 0 | 0 | 0 | **DELETE (no printing)** |
| `facts_sales_15m` | 0 | 0 | 15 | **Keep (ETL source)** |
| `cdm_*` (5 tables) | 0 | 0 | ~40 | **Keep (canonical layer)** |
| `integrations` | 5 | 0 | 7 | **Keep** |
| `raw_events` | 0 | 0 | ~10 | **Keep (staging source)** |
