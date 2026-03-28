# Menu Engineering — F&B Cost Control

> Source: EHL F&B Management — Kasavana & Smith Matrix
> Agent: Reference when building menu analysis, pricing, or profitability features

## The Menu Engineering Matrix

Classifies every menu item on two axes:
- **Popularity** (Menu Mix %): volume of sales relative to other items
- **Profitability** (Contribution Margin): selling price minus food cost

```
                    HIGH PROFITABILITY
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          │   PUZZLES      │    STARS ⭐    │
          │  Low pop,     │  High pop,    │
          │  High profit  │  High profit  │
          │               │               │
  LOW ────┼───────────────┼───────────────┼──── HIGH
 POPULARITY│               │               │  POPULARITY
          │               │               │
          │   DOGS 🐕      │  PLOWHORSES 🐴│
          │  Low pop,     │  High pop,    │
          │  Low profit   │  Low profit   │
          │               │               │
          └───────────────┼───────────────┘
                          │
                    LOW PROFITABILITY
```

### Strategy by Category

| Category | Action |
|----------|--------|
| ⭐ **Stars** | Maintain quality, keep price, feature prominently |
| 🐴 **Plowhorses** | Reduce portion, increase price slightly, or reduce food cost via substitution |
| 🧩 **Puzzles** | Move to prime menu position, train servers to upsell, consider renaming |
| 🐕 **Dogs** | Remove, redesign significantly, or replace. Keep only if it serves a strategic purpose |

## Key Formulas

```
Menu Mix % = (Items Sold of Product / Total Items Sold) × 100
Contribution Margin (CM) = Selling Price - Food Cost per Item
Average CM = Total CM / Total Items Sold
Popularity Threshold = (1 / Number of Items) × 70%  [Kasavana rule: 70% of fair share]
```

### Classification Rules
- **High Popularity**: Menu Mix % ≥ Popularity Threshold
- **High Profitability**: Item CM ≥ Average CM
- **Star**: High Pop + High Profit
- **Plowhorse**: High Pop + Low Profit
- **Puzzle**: Low Pop + High Profit
- **Dog**: Low Pop + Low Profit

## Omnes Pricing Analysis

Evaluates price distribution and coherence within a menu section:

1. **Price Range Ratio** = Max Price / Min Price | Target: ≤ 2.5
2. **Median Price Zone** = Items priced within ±15% of the section median
3. **Demand Distribution** = % of sales in each price tier
4. **Price Point Clustering** = too many items at the same price = lost revenue

## Josephine Implementation

| Concept | File | Status |
|---------|------|--------|
| Menu Engineering Matrix | `MenuEngineering.tsx` | ✅ Implemented |
| CM Calculation | `useMenuEngineeringData.ts` | ✅ Implemented |
| Omnes Analysis | `usePricingOmnesData.ts` | ✅ Implemented |
| AI Re-pricing Suggestions | — | 🔮 Future |
| Menu Item Photography | — | 🔮 Future |
| Seasonal Menu Rotation Analysis | — | 🔮 Future |

## Design Rules for Menu Engineering UI
- Use color coding: Stars=green, Plowhorses=blue, Puzzles=yellow, Dogs=red
- Show CM as currency, not just percentage
- Default sort: by CM descending within each category
- Include trend arrows (improving/declining vs last period)
