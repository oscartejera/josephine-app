# Josephine Knowledge Base

> Domain knowledge for AI-assisted development.
> The agent consults these files when building F&B features for Josephine.

## Structure

| Directory | Content |
|-----------|---------|
| `kpis/` | Financial, operational, and labour KPIs with formulas and targets |
| `cost-control/` | Food cost theory, inventory management, menu engineering, purchasing |
| `labour/` | Scheduling theory, productivity metrics, staff management |
| `revenue-management/` | Pricing strategies, forecasting, upselling |
| `hospitality-tech/` | POS ecosystem, industry trends, regulatory compliance |

## How to Add Knowledge

1. Study your EHL lecture
2. Extract key concepts, formulas, and frameworks
3. Create a `.md` file in the appropriate directory
4. Include the "Implicaciones para Josephine" section linking theory to features
5. Commit to the repo

## How the Agent Uses This

When building F&B features, the agent:
1. Checks `docs/knowledge/` for relevant domain context
2. Uses formulas and targets as source of truth for calculations
3. References KPI definitions when naming variables and labels
4. Follows industry best practices for UX and data presentation
