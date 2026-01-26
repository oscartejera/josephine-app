
# Plan: Fix Inventory Module Data Display Issues

## Problems Identified

### Problem 1: COGS Breakdown Chart Shows All Zeros
**Root Cause:** The category mapping logic in `useInventoryData.ts` (lines 383-387) only recognizes English category names:
```typescript
const mappedCat = cat.toLowerCase().includes('beverage') || cat.toLowerCase().includes('drink') 
  ? 'Beverage' 
  : cat.toLowerCase().includes('food') || cat.toLowerCase().includes('plato')
  ? 'Food'
  : 'Miscellaneous';
```

But the actual database categories are **Spanish**:
- `Bebidas` → needs to map to "Beverage" (€153,622)
- `Entrantes` → needs to map to "Food" (€152,641)
- `Principales` → needs to map to "Food" (€151,360)
- `Postres` → needs to map to "Food" (€93,524)

Everything falls through to "Miscellaneous" but the amounts are still 0 because of how the mapping accumulates.

### Problem 2: "La Taberna Centro" Shows All Zeros
**Root Cause:** This is a **data issue**, not a code issue. The location `7b6f18b7-068b-453e-a702-380bcd8ce538` has **zero tickets** in the database.

**Database Reality:**
| Location | Ticket Count (Jan 2026) |
|----------|-------------------------|
| Chamberí | 1,672 tickets |
| Salamanca | 1,672 tickets |
| Malasaña | 1,672 tickets |
| **La Taberna Centro** | **0 tickets** |

The code logic is correct - it shows €0 because there are no sales. The fix here is to either:
1. Seed POS data for this location, OR
2. Hide locations with no data from the table, OR
3. Show a clear "No POS data" message

---

## Proposed Fixes

### Fix 1: Update Category Mapping for Spanish Terms

**File:** `src/hooks/useInventoryData.ts`

Update the category mapping to support Spanish categories used in the POS:

```typescript
// Current logic (broken for Spanish)
const mappedCat = cat.toLowerCase().includes('beverage') || cat.toLowerCase().includes('drink') 
  ? 'Beverage' 
  : cat.toLowerCase().includes('food') || cat.toLowerCase().includes('plato')
  ? 'Food'
  : 'Miscellaneous';

// Fixed logic (supports Spanish POS categories)
const catLower = cat.toLowerCase();
const mappedCat = 
  catLower.includes('bebida') || catLower.includes('beverage') || catLower.includes('drink')
    ? 'Beverage' 
  : catLower.includes('entrante') || catLower.includes('principal') || catLower.includes('postre') ||
    catLower.includes('comida') || catLower.includes('food') || catLower.includes('plato')
    ? 'Food'
  : 'Miscellaneous';
```

This will correctly map:
- `Bebidas` → "Beverage"
- `Entrantes`, `Principales`, `Postres` → "Food"

### Fix 2: Handle Locations Without Data Gracefully

**File:** `src/hooks/useInventoryData.ts`

In the location performance calculation, add logic to only include locations with actual ticket data, OR mark them clearly as having no data:

```typescript
// Option A: Filter out locations with no sales data
setLocationPerformance(locations
  .filter(l => effectiveLocationIds.includes(l.id))
  .filter(loc => salesByLoc.has(loc.id) && (salesByLoc.get(loc.id) || 0) > 0)
  .map(loc => { ... }));

// Option B: Include but mark with hasData: false for "No POS data" message
```

### Fix 3: Seed Ticket Data for "La Taberna Centro"

**Database Seeding (Optional):** If the location should have real data, call the `seed_tickets_history` edge function to generate historical POS data for this new location.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useInventoryData.ts` | Update category mapping for Spanish; optionally filter empty locations |

---

## Technical Section

### Updated Category Mapping Logic

```typescript
// Lines 381-396 in useInventoryData.ts
(ticketLines || []).forEach(line => {
  const cat = line.category_name || 'Miscellaneous';
  const catLower = cat.toLowerCase();
  
  // Support both Spanish (POS) and English category names
  const mappedCat = 
    catLower.includes('bebida') || catLower.includes('beverage') || 
    catLower.includes('drink') || catLower.includes('vino') || catLower.includes('cerveza')
      ? 'Beverage' 
    : catLower.includes('entrante') || catLower.includes('principal') || 
      catLower.includes('postre') || catLower.includes('comida') || 
      catLower.includes('food') || catLower.includes('plato')
      ? 'Food'
    : 'Miscellaneous';
  
  const existing = categoryMap.get(mappedCat) || { actual: 0, theoretical: 0 };
  const lineTotal = line.gross_line_total || 0;
  const recipeCost = recipeCostMap.get(line.item_name?.toLowerCase() || '') || lineTotal * 0.28;
  
  existing.actual += recipeCost * 1.05;
  existing.theoretical += recipeCost;
  categoryMap.set(mappedCat, existing);
});
```

### Waste Category Mapping Update

The same fix needs to be applied to the waste category mapping (lines 412-418):

```typescript
(wasteEvents || []).forEach((w: any) => {
  const cat = w.inventory_items?.category || 'food';
  const catLower = cat.toLowerCase();
  const mappedCat = 
    catLower.includes('bebida') || catLower === 'beverage'
      ? 'Beverage' 
    : catLower.includes('comida') || catLower === 'food'
      ? 'Food' 
    : 'Miscellaneous';
  // ... rest of logic
});
```

---

## Expected Results After Fix

### COGS Breakdown (with fix)
| Category | Actual € | Theoretical € |
|----------|----------|---------------|
| **Food** | ~€139,000 (Entrantes + Principales + Postres) | ~€133,000 |
| **Beverage** | ~€42,000 (Bebidas) | ~€40,000 |
| **Miscellaneous** | €0 | €0 |

### Location Performance (with fix)
| Location | Sales | Shows Data? |
|----------|-------|-------------|
| Chamberí | €142,011 | ✅ Yes |
| Salamanca | €140,306 | ✅ Yes |
| Malasaña | €138,663 | ✅ Yes |
| La Taberna Centro | €0 | ⚠️ "No POS data" OR hidden |

---

## Implementation Notes

1. **Backward Compatible:** The new mapping includes both Spanish AND English terms, so it works for any future English POS integrations
2. **Dynamic:** New locations will automatically show correct data once they have POS tickets
3. **Data Seeding:** If "La Taberna Centro" should have demo data, we can run the `seed_tickets_history` edge function for that location
