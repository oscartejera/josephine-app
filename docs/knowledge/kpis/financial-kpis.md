# Financial KPIs — Restaurant Operations

> Source: Industry standards + EHL F&B Management curriculum
> Agent: Reference when building financial dashboards, P&L views, or KPI widgets

## Primary Financial KPIs

### Revenue Metrics
- **Gross Revenue** = Total sales before discounts, taxes, and comps
- **Net Revenue** = Gross Revenue - Discounts - Comps - Voids
- **Average Check Size** = Net Revenue / Number of Covers | Target: varies by concept
- **Revenue Per Available Seat Hour (RevPASH)** = Revenue / (Seats × Hours Open) | Target: maximize
- **Revenue Per Square Foot** = Revenue / Total sqft | Target: varies by market

### Cost Metrics
- **COGS (Cost of Goods Sold)** = Opening Inventory + Purchases - Closing Inventory
- **Food Cost %** = Food COGS / Food Revenue × 100 | Target: 25-35%
- **Beverage Cost %** = Bev COGS / Bev Revenue × 100 | Target: 18-25%
- **Total COGS %** = Total COGS / Total Revenue × 100 | Target: 28-32%
- **Prime Cost** = COGS + Total Labour Cost | Target: 55-65% of revenue
- **Prime Cost %** = Prime Cost / Revenue × 100 | **THE most critical health metric**

### Profitability Metrics
- **Gross Profit (GP)** = Revenue - COGS
- **Gross Profit Margin %** = GP / Revenue × 100 | Target: 65-75%
- **Operating Profit (EBITDA)** = GP - Labour - Operating Expenses
- **Net Profit %** = Net Profit / Revenue × 100 | Target: 5-15% (varies by concept)
- **Break-Even Revenue** = Fixed Costs / (1 - Variable Cost %) | Critical for new operations

## Josephine Implementation Map

| KPI | Where in Josephine | Hook/RPC |
|-----|-------------------|----------|
| COGS % | InstantPL.tsx, Dashboard | useInstantPLData |
| GP % | InstantPL.tsx | useInstantPLData |
| Prime Cost | Dashboard KPI cards | useKpiSummary |
| Avg Check | Sales.tsx | useBISalesData |
| RevPASH | Not yet implemented | — |
| Food Cost % | MenuEngineering.tsx | useMenuEngineeringData |
| Labour Cost % | Labour.tsx | useLabourData |

## Missing Features (Roadmap Opportunities)
- RevPASH widget (needs covers data + operating hours)
- Break-even calculator
- Historical GP% trend line
- Prime Cost alert when exceeding 65%
