# Operational KPIs — Restaurant Operations

> Source: Industry standards + EHL Operations Management
> Agent: Reference when building operations dashboards, efficiency metrics, or service quality features

## Service & Throughput

- **Table Turnover Rate** = Covers / Available Seats per Service | Target: 1.5-3.0x (varies by concept)
- **Average Dining Time** = Total Time Seated / Covers (minutes) | Target: varies by concept
- **Speed of Service** = Time from order to delivery | Fast-casual: <10min, Casual: <20min
- **Queue/Wait Time** = Time from arrival to seating | Target: < 15min peak
- **RevPASH** = Revenue / (Seats × Hours Open) | The gold standard for space efficiency

## Inventory & Waste

- **Inventory Turnover** = COGS / Average Inventory Value | Target: 4-8x per month
- **Days of Inventory on Hand** = Average Inventory / Daily COGS | Target: 3-7 days
- **Waste %** = Waste Value / Purchases × 100 | Target: < 2%
- **Variance %** = (Theoretical Usage - Actual Usage) / Theoretical × 100 | Target: < 3%
- **Spoilage Rate** = Spoiled Inventory Value / Total Inventory × 100

## Customer Satisfaction

- **Customer Satisfaction Score (CSAT)** = Positive Ratings / Total Ratings
- **Net Promoter Score (NPS)** = % Promoters - % Detractors | Target: > 50
- **Online Review Score** = Average across Google, TripAdvisor, etc. | Target: ≥ 4.2/5
- **Complaint Rate** = Complaints / Covers × 1000
- **Return Visit Rate** = Repeat Customers / Total Customers

## Josephine Implementation Map

| KPI | Where in Josephine | Hook/RPC |
|-----|-------------------|----------|
| Waste % | Waste.tsx | useWasteData |
| Inventory Turnover | Inventory.tsx | useInventoryData |
| Review Score | Reviews.tsx | useReviewsData |
| Variance tracking | Reconciliation pages | useReconciliationData |
| Table Turnover | Not yet | — |
| RevPASH | Not yet | — |

## Missing Features (Roadmap)
- Table turnover analytics (needs reservation/seating data)
- RevPASH calculator with configurable seat counts and hours
- Waste % trend and category breakdown
- Inventory variance alerts (>3% triggers notification)
