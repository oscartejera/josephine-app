# Josephine — Complete App Flowchart

> A-to-Z visual map of the entire system.

---

## 1. The Big Picture

```mermaid
graph TB
    subgraph EXTERNAL["🌐 External"]
        POS["Square POS"]
        GOOGLE["Google Reviews"]
        USER["Restaurant Owner/Manager"]
        EMPLOYEE["Employee"]
    end

    subgraph AUTH["🔐 Authentication"]
        LOGIN["Login Page"]
        SUPAAUTH["Supabase Auth"]
        ROLES["5 Auth RPCs"]
    end

    subgraph CONTEXTS["⚙️ React Contexts"]
        AUTHCTX["AuthContext"]
        APPCTX["AppContext"]
        DEMOCTX["DemoModeContext"]
    end

    subgraph DATASRC["📡 Data Source Resolution"]
        RESOLVER["resolve_data_source RPC"]
        POS_MODE["POS Mode"]
        DEMO_MODE["Demo Mode"]
    end

    subgraph DATALAYER["📦 Data Access Layer"]
        TYPED_RPC["typedRpc + Zod"]
        TYPED_FROM["typedFrom"]
        VIEWS["8 Contract Views"]
        RPCS["8+ SQL RPCs"]
    end

    subgraph AI["🤖 AI Layer"]
        EDGE_AI["Edge Functions"]
        NARRATIVES["Morning Briefing"]
        INSIGHTS_AI["Ask Josephine"]
        PRICING["Dynamic Pricing"]
    end

    subgraph PAGES["📊 Pages"]
        DASH["Control Tower"]
        SALES["Sales"]
        LABOUR["Labour"]
        PNL["Instant P&L"]
        MENU["Menu Engineering"]
        BUDGET["Budgets"]
        INV["Inventory & Waste"]
        CASH["Cash Management"]
        REVIEWS["Reviews"]
        SCHED["Scheduling"]
        PAYROLL["Payroll"]
        TEAM["Employee Portal"]
    end

    USER --> LOGIN
    LOGIN --> SUPAAUTH
    SUPAAUTH --> ROLES
    ROLES --> AUTHCTX
    AUTHCTX --> APPCTX
    APPCTX --> DEMOCTX
    DEMOCTX --> RESOLVER
    RESOLVER --> POS_MODE
    RESOLVER --> DEMO_MODE

    POS_MODE --> DATALAYER
    DEMO_MODE --> DATALAYER

    POS --> |"OAuth + Webhooks"| VIEWS
    GOOGLE --> REVIEWS

    TYPED_RPC --> RPCS
    TYPED_FROM --> VIEWS
    DATALAYER --> PAGES
    DATALAYER --> AI

    EDGE_AI --> NARRATIVES
    EDGE_AI --> INSIGHTS_AI
    EDGE_AI --> PRICING

    AI --> DASH
    EMPLOYEE --> TEAM
```

---

## 2. Auth & Bootstrap Flow

```mermaid
sequenceDiagram
    actor User
    participant Login
    participant SupaAuth as Supabase Auth
    participant AuthCtx as AuthContext
    participant AppCtx as AppContext
    participant DemoCtx as DemoModeContext
    participant DB as Supabase DB

    User->>Login: Email + Password (or "Owner" button)
    Login->>SupaAuth: signInWithPassword()
    SupaAuth-->>Login: Session + JWT

    Login->>AuthCtx: Trigger bootstrap

    par Parallel Auth Calls
        AuthCtx->>DB: profiles.select().eq(id, userId)
        AuthCtx->>DB: RPC get_user_roles_with_scope
        AuthCtx->>DB: RPC is_owner
        AuthCtx->>DB: RPC get_user_has_global_scope
        AuthCtx->>DB: RPC get_user_accessible_locations
        AuthCtx->>DB: RPC get_user_permissions
    end

    DB-->>AuthCtx: Profile + Roles + Permissions

    AuthCtx->>AppCtx: orgId, locationIds
    AppCtx->>DB: groups.select(id, name)
    AppCtx->>DB: locations.select(id, name, city)
    DB-->>AppCtx: Org + Locations data

    AppCtx->>DemoCtx: Initialize data source
    DemoCtx->>DB: RPC resolve_data_source
    DB-->>DemoCtx: {data_source: 'pos'|'demo'}

    DemoCtx-->>User: App ready → Redirect to /dashboard
```

### 🔴 Weak Points Found
- **6 sequential+parallel DB calls** before the app is usable
- If any RPCs like `get_user_roles_with_scope` changes, user gets locked out
- `groups` table name mismatch documented in `DB_APP_CONTRACT.md`

---

## 3. Data Pipeline (per Insight page)

```mermaid
graph LR
    subgraph POSTGRES["🗄️ Supabase Postgres"]
        RAW["Raw Tables<br/>daily_sales, hourly_sales<br/>product_sales_daily..."]
        VIEWS["Contract Views<br/>sales_daily_unified<br/>labour_daily_unified<br/>budget_daily_unified..."]
        RPCS["SQL Functions<br/>get_labour_kpis()<br/>get_sales_timeseries_unified()<br/>get_instant_pnl_unified()..."]
        MV["Materialized Views<br/>mv_sales_daily<br/>mv_sales_hourly..."]
    end

    subgraph DAL["📦 Data Access Layer (src/data/)"]
        TF["typedFrom('view')"]
        TR["typedRpc('fn', ZodSchema, params)"]
        ZOD["Zod Validation<br/>rpc-contracts.ts"]
    end

    subgraph HOOKS["🪝 React Hooks (src/hooks/)"]
        UQ["useQuery() wrapper"]
        TRANSFORM["Transform<br/>snake_case → camelCase<br/>string → number"]
    end

    subgraph UI["🖥️ UI Components"]
        EB["InsightErrorBoundary"]
        CARDS["KPI Cards"]
        CHARTS["Charts"]
        TABLES["Data Tables"]
    end

    RAW --> |"triggers/cron"| MV
    MV --> VIEWS
    RAW --> VIEWS
    VIEWS --> TF
    VIEWS --> RPCS
    RPCS --> TR
    TR --> ZOD
    ZOD --> |"✅ valid"| UQ
    ZOD --> |"❌ mismatch (DEV)"| EB
    TF --> UQ
    UQ --> TRANSFORM
    TRANSFORM --> CARDS
    TRANSFORM --> CHARTS
    TRANSFORM --> TABLES
    EB --> |"Retry button"| UQ
```

---

## 4. All Pages & Their Data Dependencies

```mermaid
graph TB
    subgraph CONTROL["🎛️ CONTROL TOWER"]
        DASH["Dashboard<br/>/dashboard"]
        DASH --> |useControlTowerData| K1["rpc_kpi_range_summary"]
        DASH --> |useAINarratives| E1["edge: dashboard_narratives"]
        DASH --> |useTopProductsUnified| K2["get_top_products_unified"]
    end

    subgraph INSIGHTS["📊 INSIGHTS (8 pages)"]
        S["Sales"] --> |useBISalesData| V1["sales_daily_unified"]
        S --> |useSalesTimeseries| R1["get_sales_timeseries_unified"]
        S --> |useTopProducts| R2["get_top_products_unified"]

        L["Labour"] --> |useLabourData| R3["get_labour_kpis"]
        L --> R4["get_labour_timeseries"]
        L --> R5["get_labour_locations_table"]
        L --> |useLaborPlanUnified| R6["get_labor_plan_unified"]

        PL["Instant P&L"] --> |useInstantPLData| R7["get_instant_pnl_unified"]

        ME["Menu Engineering"] --> |useMenuEngineering| R8["menu_engineering_summary"]

        B["Budgets"] --> |useBudgetsData| V2["budget_daily_unified"]
        B --> V3["sales_daily_unified"]
        B --> V4["labour_daily_unified"]

        INV["Inventory"] --> |useInventoryData| V5["inventory_position_unified"]
        W["Waste"] --> |useWasteData| T1["waste_events"]
        CASH2["Cash Mgmt"] --> |useCashData| T2["cash_counts"]
    end

    subgraph WORKFORCE["👥 WORKFORCE (5 pages)"]
        SC["Scheduling"] --> |useScheduling| E2["edge: generate_schedule"]
        SC --> E3["edge: generate_forecast"]
        AV["Availability"] --> |useAvailability| T3["employee_availability"]
        PAY["Payroll"] --> T4["payroll_runs + payslips"]
        PAY --> E4["edge: payroll_api"]
        WT["Team"] --> T5["employees + locations"]
        TS["Timesheet"] --> T6["clock_records"]
    end

    subgraph INTEGRATIONS["🔌 INTEGRATIONS"]
        SQ["Square"] --> |OAuth| E5["edge: square-oauth-exchange"]
        SQ --> |Sync| E6["square-sync webhooks"]
    end

    subgraph OPERATIONS["⚙️ OPERATIONS"]
        WE["Waste Entry"] --> |useWasteEntry| T7["waste_events INSERT"]
        SA["Stock Audit"] --> |useStockAudit| T8["inventory_items"]
    end

    subgraph TEAM_PORTAL["👤 EMPLOYEE PORTAL (6 pages)"]
        TH["Home"] --> T9["announcements"]
        TSC["Schedule"] --> T10["planned_shifts"]
        TC["Clock"] --> T11["clock_records"]
        TP["Pay"] --> T12["payslips"]
        TD["Directory"] --> T13["employees"]
        TN["News"] --> T14["announcements"]
    end
```

---

## 5. AI Features Map

```mermaid
graph TB
    subgraph EDGE["Edge Functions (Supabase)"]
        N["dashboard_narratives"]
        SI["sales_insights"]
        LI["labour_insights"]
        II["inventory_insights"]
        DP["pricing_suggestions"]
        RR["review_reply"]
        AR["ai-recommendations"]
        FC["generate_forecast_v4/v5"]
    end

    subgraph HOOKS_AI["React Hooks"]
        H1["useAINarratives"] --> N
        H2["AskJosephinePanel"] --> SI
        H3["AskJosephineLabour"] --> LI
        H4["AskJosephineInventory"] --> II
        H5["DynamicPricingPanel"] --> DP
        H6["Reviews page"] --> RR
        H7["useAIRecommendations"] --> AR
    end

    subgraph PAGES_AI["Pages Using AI"]
        D["Dashboard"] --> H1
        D --> H7
        S2["Sales"] --> H2
        L2["Labour"] --> H3
        I2["Inventory"] --> H4
        M2["Menu Eng."] --> H5
        R2["Reviews"] --> H6
    end

    subgraph FORECAST["Forecast Engine"]
        FC --> |"Prophet ML"| FD["forecast_daily_unified"]
        FD --> S2
        FD --> |"Scheduling"| SCH["Auto-Schedule"]
    end
```

---

## 6. Safety Net Architecture

```mermaid
graph TB
    subgraph DEV["Development"]
        CODE["Code Change"]
        TSC["tsc --noEmit<br/>0 errors required"]
        TESTS["Contract Tests<br/>9/9 Zod schemas"]
        LINT["Migration Lint<br/>No orphan DROPs"]
        BROWSE["Browser Check<br/>KPIs show data"]
    end

    subgraph CI["CI Pipeline (GitHub Actions)"]
        PUSH["git push"]
        CI_TSC["TypeScript Check"]
        CI_TEST["Contract Tests"]
        CI_LINT["Migration Lint"]
        CI_GATE["✅ Gate"]
    end

    subgraph PROD["Production"]
        EB2["InsightErrorBoundary<br/>Catches RPC errors"]
        ZOD2["typedRpc Zod<br/>console.warn only"]
        HEALTH["RPC Health Check<br/>Probe all endpoints"]
    end

    CODE --> TSC --> TESTS --> LINT --> BROWSE
    CODE --> PUSH --> CI_TSC --> CI_TEST --> CI_LINT --> CI_GATE

    CI_GATE --> |"deploy"| PROD
    EB2 --> |"user sees retry"| PROD
    ZOD2 --> |"logs mismatch"| PROD
```

---

## 7. 🔴 Weak Points & Improvement Areas

| # | Area | Issue | Impact | Fix Difficulty |
|---|------|-------|--------|---------------|
| 1 | **Auth Bootstrap** | 6 DB calls before app loads | Slow first load (~2s) | 🟡 Medium — combine into 1 RPC |
| 2 | **Forecast Engine** | Edge Functions call external Prophet API | Single point of failure | 🔴 Hard — needs fallback |
| 3 | **Payroll tables** | Not in generated Supabase types | `as any` casts remaining | 🟢 Easy — run `db:types` |
| 4 | **Square integration** | Only Square supported | Limits market reach | 🟡 Medium — need adapter pattern |
| 5 | **Realtime** | Only 2 tables subscribed | Other data can go stale | 🟢 Easy — add more subscriptions |
| 6 | **Caching** | 5min staleTime for all queries | Same for fast/slow data | 🟢 Easy — per-query staleTime |
| 7 | **Error boundaries** | Only on Insight pages | Workforce pages can crash | 🟢 Easy — wrap more routes |
| 8 | **Offline** | No offline support | App fails without network | 🔴 Hard — needs service worker |
| 9 | **Employee portal** | 6 pages, minimal features | Low employee adoption | 🟡 Medium — needs chat, docs |
| 10 | **i18n** | Spanish only (mostly) | Limits international market | 🟡 Medium — already has es.json |
| 11 | **Mobile** | Responsive but not native | Sub-optimal mobile UX | 🟡 Medium — Capacitor exists |
| 12 | **Testing** | Only contract tests | No E2E, no component tests | 🟡 Medium — add Playwright |
