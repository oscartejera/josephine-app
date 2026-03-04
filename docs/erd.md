# Entity Relationship Diagram

> Visual map of Josephine's database schema — tables, views, and RPCs.

## Core Entities

```mermaid
erDiagram
    orgs ||--o{ locations : "has many"
    orgs ||--o{ employees : "employs"
    orgs ||--o{ suppliers : "buys from"
    orgs ||--o{ inventory_items : "stocks"
    orgs ||--o{ org_settings : "configured by"
    
    locations ||--o{ employees : "assigned to"
    locations ||--o{ purchase_orders : "orders for"
    locations ||--o{ clock_records : "clocked at"
    locations ||--o{ planned_shifts : "scheduled at"
    locations ||--o{ waste_events : "tracked at"
    
    employees ||--o{ clock_records : "clocks"
    employees ||--o{ planned_shifts : "works"
    employees ||--o{ employee_availability : "available"
    
    suppliers ||--o{ purchase_orders : "receives"
    purchase_orders ||--o{ purchase_order_lines : "contains"
    inventory_items ||--o{ purchase_order_lines : "ordered"
    inventory_items ||--o{ recipe_ingredients : "ingredient of"
    recipes ||--o{ recipe_ingredients : "made from"
    
    orgs {
        uuid id PK
        text name
        text currency
    }
    
    locations {
        uuid id PK
        uuid org_id FK
        text name
        text city
        text timezone
    }
    
    employees {
        uuid id PK
        uuid org_id FK
        uuid location_id FK
        text full_name
        text role_name
        numeric hourly_cost
        boolean active
    }
    
    inventory_items {
        uuid id PK
        uuid org_id FK
        text name
        text unit
        numeric par_level
        numeric current_stock
    }
    
    suppliers {
        uuid id PK
        uuid org_id FK
        text name
        text email
    }
```

## Data Pipeline: Views & RPCs

```mermaid
graph LR
    subgraph "Raw Tables"
        SDU["daily_sales"]
        SHU["hourly_sales"]
        PSU["product_sales_daily"]
        LDU["labour_daily"]
        FDU["forecast_daily"]
        BDU["budget_daily"]
    end
    
    subgraph "Contract Views"
        V1["sales_daily_unified"]
        V2["sales_hourly_unified"]
        V3["product_sales_daily_unified"]
        V4["labour_daily_unified"]
        V5["forecast_daily_unified"]
        V6["budget_daily_unified"]
        V7["mart_kpi_daily"]
        V8["inventory_position_unified"]
    end
    
    subgraph "RPCs (Aggregated)"
        R1["get_labour_kpis()"]
        R2["get_labour_timeseries()"]
        R3["get_labour_locations_table()"]
        R4["get_sales_timeseries_unified()"]
        R5["get_top_products_unified()"]
        R6["get_instant_pnl_unified()"]
        R7["menu_engineering_summary()"]
        R8["rpc_kpi_range_summary()"]
    end
    
    subgraph "Frontend Pages"
        P1["Dashboard"]
        P2["Sales"]
        P3["Labour"]
        P4["Instant P&L"]
        P5["Menu Engineering"]
        P6["Budgets"]
        P7["Inventory"]
    end
    
    SDU --> V1
    SHU --> V2
    PSU --> V3
    LDU --> V4
    FDU --> V5
    BDU --> V6
    
    V1 --> P1
    V1 --> P2
    V1 --> P6
    V2 --> P2
    V3 --> P2
    V4 --> P3
    V4 --> P6
    V5 --> P6
    V6 --> P6
    V7 --> P1
    V8 --> P7
    
    R1 --> P3
    R2 --> P3
    R3 --> P3
    R4 --> P2
    R5 --> P2
    R6 --> P4
    R7 --> P5
    R8 --> P1
```

## RPCs: Parameters & Return Shapes

| RPC | Parameters | Returns | DAL File |
|-----|-----------|---------|----------|
| `get_labour_kpis` | `date_from`, `date_to`, `selected_location_id`, `p_data_source` | Sales, COL%, SPLH, OPLH, prime cost | `labour.ts` |
| `get_labour_timeseries` | same | Daily breakdown of above | `labour.ts` |
| `get_labour_locations_table` | same | Per-location comparison | `labour.ts` |
| `get_sales_timeseries_unified` | `p_org_id`, `p_location_ids`, `p_from`, `p_to` | Daily sales timeseries | `sales.ts` |
| `get_top_products_unified` | same + `p_limit` | Top products by revenue | `sales.ts` |
| `get_instant_pnl_unified` | `p_org_id`, `p_location_ids`, `p_from`, `p_to` | P&L snapshot | `sales.ts` |
| `menu_engineering_summary` | `p_date_from`, `p_date_to`, `p_location_id`, `p_data_source` | Star/Horse/Puzzle/Dog matrix | `sales.ts` |
| `rpc_kpi_range_summary` | `p_org_id`, `p_from`, `p_to` | Nested summary for Control Tower | `kpi.ts` |

## Views: Column Reference

| View | Key Columns | Used By |
|------|------------|---------|
| `sales_daily_unified` | org_id, location_id, day, net_sales, orders_count, avg_check, labor_cost | Sales, Dashboard, Budget |
| `sales_hourly_unified` | org_id, location_id, day, hour_of_day, net_sales, orders_count | Sales (hourly mode) |
| `product_sales_daily_unified` | product_name, product_category, units_sold, net_sales, cogs, margin_pct | Sales (products) |
| `labour_daily_unified` | org_id, location_id, day, actual_hours, actual_cost, scheduled_hours | Budget |
| `forecast_daily_unified` | forecast_sales, forecast_orders, planned_labor_hours | Forecast, Budget |
| `budget_daily_unified` | budget_sales, budget_labour, budget_cogs, budget_profit | Budgets |
| `mart_kpi_daily` | net_sales, orders_count, covers, avg_check, labour_cost | Dashboard |
| `inventory_position_unified` | item_id, name, on_hand, par_level, deficit | Inventory |
