# Inventory Management — F&B Operations

> Source: EHL Supply Chain & F&B Cost Control
> Agent: Reference when building inventory, stock management, or purchasing features

## Core Principles

### FIFO (First In, First Out)
- Oldest stock used first to minimize spoilage
- Critical for perishables (produce, dairy, proteins)
- Implementation: organize storage with dates visible, newest stock behind oldest

### Par Level System
- **Par Level** = Minimum quantity of each item needed to meet demand until next delivery
- **Formula**: Par Level = (Average Daily Usage × Lead Time Days) + Safety Stock
- **Reorder Point** = Par Level - Current Stock ≤ 0 → trigger order
- **Order Quantity** = Par Level - Current Stock

### Inventory Categories (ABC Analysis)
- **A Items** (70-80% of cost, 10-20% of items): Daily monitoring, tight controls
- **B Items** (15-20% of cost, 20-30% of items): Weekly monitoring
- **C Items** (5-10% of cost, 50-70% of items): Monthly monitoring

## Stock-Take Process

### Weekly Physical Count
1. Count all items at consistent time (before or after service)
2. Record quantities in standard units
3. Multiply by unit cost → inventory value
4. Compare to theoretical usage

### Variance Analysis
```
Theoretical Usage = Opening Stock + Purchases - Closing Stock (expected based on recipes sold)
Actual Usage = Opening Stock + Purchases - Physical Closing Stock
Variance = Actual Usage - Theoretical Usage
Variance % = (Variance / Theoretical) × 100 | Target: < 3%
```

### Common Variance Causes
| Variance Type | Cause | Detection |
|---------------|-------|-----------|
| Positive (used more) | Over-portioning, waste, theft | Check recipe adherence |
| Negative (used less) | Under-portioning, wrong count | Recount, verify recipes |
| Timing | Deliveries not recorded | Match POs to receipts |

## Waste Tracking Categories

1. **Preparation waste** — peeling, trimming, butchering (expected, factor into yield %)
2. **Spoilage** — expired, quality deterioration (minimize with FIFO + par levels)
3. **Over-production** — cooked but not sold (improve forecasting)
4. **Customer returns** — sent back by guests (quality control issue)
5. **Spillage/accidents** — dropped, spilled (training issue)

### Yield Percentage
```
Yield % = (Usable Weight / As-Purchased Weight) × 100
True Cost per Usable Unit = Purchase Price / Yield %
```

## Josephine Implementation Map

| Concept | File | Status |
|---------|------|--------|
| Inventory tracking | `Inventory.tsx` | ✅ Implemented |
| Stock counting | `StockAuditPage.tsx` | ✅ Implemented |
| Variance analysis | `InventoryReconciliation.tsx` | ✅ Implemented |
| Waste tracking | `Waste.tsx`, `WasteEntryPage.tsx` | ✅ Implemented |
| Dead stock detection | `useStockAudit.ts` | ✅ Implemented (RPC: get_dead_stock) |
| Par levels | — | 🔮 Future |
| Reorder points | — | 🔮 Future |
| ABC categorization | — | 🔮 Future |
| Yield % tracking | — | 🔮 Future |
| Supplier ordering | — | 🔮 Future (Procurement v2) |
