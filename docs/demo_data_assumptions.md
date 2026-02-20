# Demo Data Assumptions

Documents all assumptions for the investor-demo seed data. These values drive the `scripts/seed-demo-365.mjs` script.

## Organization & Locations

| Parameter | Value |
|-----------|-------|
| Org ID | `7bca34d5-4448-40b8-bb7f-55f1417aeccd` |
| Org name | La Taberna Madrid |
| Legal entity | La Taberna Madrid SL |
| NIF | B12345678 |
| Currency | EUR |
| Timezone | Europe/Madrid |

### 4 Locations in Madrid

| Location | Base Daily Sales | Avg Check | Employees |
|----------|-----------------|-----------|-----------|
| Malasaña | €4,500 | €24 | 6 |
| Centro | €5,500 | €26 | 6 |
| Chamberí | €5,000 | €24 | 6 |
| Salamanca | €4,000 | €23 | 6 |

## Temporal Coverage

| Parameter | Value |
|-----------|-------|
| History | 365 days back from seed date |
| Forecast horizon | 30 days forward |
| Budget | 12 months (full year) |
| Operating hours | 10:00–23:00 daily |
| Shifts | Morning 10:00–16:00, Evening 16:00–23:00 |

## Sales Multipliers

### Day-of-Week (Sun=0 .. Sat=6)

| Day | Multiplier |
|-----|-----------|
| Sunday | 1.10 |
| Monday | 0.80 |
| Tuesday | 0.90 |
| Wednesday | 0.95 |
| Thursday | 1.00 |
| Friday | 1.35 |
| Saturday | 1.45 |

### Seasonal

| Period | Multiplier |
|--------|-----------|
| Summer (Jun–Aug) | +15% (1.15) |
| Spring (Mar–May) | +5% (1.05) |
| December | +10% (1.10) |
| January–February | −10% (0.90) |
| Other months | Neutral (1.00) |

### Noise

Daily sales include ±8% random variance for realism.

## Menu

### 30 Items across 6 Categories

| Category | Items | Price Range |
|----------|-------|-------------|
| Entrantes | 6 | €5–€12 |
| Carnes | 5 | €14–€28 |
| Pescados | 4 | €13–€22 |
| Pastas | 3 | €11–€15 |
| Postres | 4 | €5–€8 |
| Bebidas | 6 | €2–€8 |

### Order Composition

- 2–4 line items per order
- Category-weighted: Entrantes (25%), Carnes (15%), Pescados (10%), Pastas (10%), Postres (15%), Bebidas (25%)
- Last line adjusted so order total matches daily target

## Labour

| Parameter | Value |
|-----------|-------|
| Target COL% | 28% |
| Avg hourly rate | €14.50 (range €12–€18 per employee) |
| Morning headcount | 3 per location |
| Evening headcount | 4 per location |
| Clock variance | ±5–15 min from shift times |
| 24 employees total | 6 per location |

### Roles

| Role | Count per Location | Hourly Rate Range |
|------|-------------------|------------------|
| Chef | 1 | €16–€18 |
| Cook | 1 | €13–€15 |
| Bartender | 1 | €12–€14 |
| Waiter | 2 | €12–€14 |
| Manager | 1 | €16–€18 |

## Inventory & COGS

| Parameter | Value |
|-----------|-------|
| Target COGS % | 30% |
| Default COGS percent (fallback) | 30 |
| Inventory items | 24 across 5 categories |
| Stock movement types | sale_estimate, waste, purchase |
| Waste as % of COGS | ~2% |

### 24 Inventory Items across 5 Categories

| Category | Items | Cost Range |
|----------|-------|-----------|
| Proteínas | 6 | €6–€45/kg |
| Verduras | 5 | €0.80–€2.80/kg |
| Lácteos | 3 | €0.95–€12.50/unit |
| Bebidas | 4 | €0.20–€4.50/unit |
| Secos | 5 | €0.85–€15.00/unit |

### 4 Suppliers

| Supplier | Delivery Days | Cutoff |
|----------|--------------|--------|
| Mercamadrid Frescos | Mon, Wed, Fri | 18:00 |
| Distribuciones García | Tue, Thu | 16:00 |
| Bebidas del Sur | Mon, Thu | 14:00 |
| Productos Secos SL | Wed | 12:00 |

## Financial Targets

| KPI | Target |
|-----|--------|
| GP% | 65–70% (= 100% − 30% COGS) |
| COL% | 28% |
| COGS% | 30% |
| Waste% | ~2% of COGS |
| Target GP percent (location_settings) | 68% |

## Budget

| Parameter | Value |
|-----------|-------|
| Scope | Monthly, 12 versions (one per month) |
| Status | published for all |
| Budget sales | base_sales × DOW × seasonal (no noise = target) |
| Budget labour | budget_sales × 0.28 |
| Budget COGS | budget_sales × 0.30 |

Variance between actual and budget arises from the ±8% daily noise.

## Forecast

| Parameter | Value |
|-----------|-------|
| Model | Prophet-style (deterministic seed) |
| Horizon | 30 days forward |
| yhat | actual ± MAPE noise |
| yhat_lower | yhat × 0.85 |
| yhat_upper | yhat × 1.15 |
| Historical MAPE | ~8–12% |
| Runs | 12 (monthly), latest is "current" |

## Payroll

| Parameter | Value |
|-----------|-------|
| Frequency | Monthly |
| Months | 12 (full year) |
| IRPF rate | 15–22% depending on salary |
| SS employee | ~6.35% of gross |
| SS employer | ~30% of gross |
| Base salary range | €1,400–€2,200/month |

### Payslip Lines (5 per payslip)

| Concept | Type | Calculation |
|---------|------|-------------|
| Salario base | earning | base_salary_monthly |
| Complementos | earning | ~5–10% of base |
| IRPF | deduction | gross × irpf_rate |
| SS Trabajador | deduction | gross × 6.35% |
| SS Empresa | company_cost | gross × 30% |

## Reviews

| Parameter | Value |
|-----------|-------|
| Total | ~800 across 365 days |
| Frequency | 2–5 per week per location |
| Platforms | Google (50%), TripAdvisor (30%), TheFork (20%) |
| Rating distribution | 5★=40%, 4★=30%, 3★=15%, 2★=10%, 1★=5% |
| Language | Spanish |

## Stock Counts (Reconciliation)

| Parameter | Value |
|-----------|-------|
| Frequency | Monthly (12 per location) |
| Status | completed for past months, draft for current |
| Items per count | 24 (all inventory items) |
| Variance | 1–5% of value (realistic counting errors) |

## Purchase Orders

| Parameter | Value |
|-----------|-------|
| Frequency | ~2 per week per location |
| Lines per PO | 3–5 |
| Status progression | draft → sent → received (older = received) |
| Total POs | ~400 across the year |

## Announcements

| Parameter | Value |
|-----------|-------|
| Total | 8 |
| Types | info, warning, celebration |
| Pinned | 2 |

## Coherence Rules

1. `cdm_order_lines.gross` per item sums to `cdm_orders.net_sales` for that order
2. `daily_sales.net_sales` = SUM(`cdm_orders.net_sales`) for that day+location
3. `stock_movements` sale_estimate qty_delta proportional to items sold
4. `waste_events` qty ties to stock_movements waste entries
5. `budget_metrics.net_sales` = base_sales × seasonal × DOW (target, no noise)
6. `forecast_points.yhat` = actual ± MAPE% noise
7. `payslips.gross_pay` = employment_contracts.base_salary_monthly + complementos
8. `labour_daily_unified.actual_cost` ≈ daily_sales.net_sales × 0.28 (with variance)
