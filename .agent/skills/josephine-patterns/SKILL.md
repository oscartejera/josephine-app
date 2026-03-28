---
description: Recetas paso-a-paso para tareas frecuentes en Josephine. Usa cuando necesites añadir páginas, RPCs, sidebar items, o datos demo.
---

# Josephine Development Patterns

> These are Josephine-specific recipes. Follow them exactly to avoid regressions.

## Available Patterns

| Pattern | Use when... |
|---------|-------------|
| [Add New Page](#add-new-page) | Adding a new route/page to the app |
| [Add New RPC](#add-new-rpc) | Creating a new Supabase RPC function |
| [Add Sidebar Item](#add-sidebar-item) | Adding a navigation item to the sidebar |
| [Add Dashboard Widget](#add-dashboard-widget) | Adding a new card/widget to the dashboard |
| [Add Demo Data](#add-demo-data) | Seeding demo data for a new feature |
| [Connect POS Data](#connect-pos-data) | Wiring real POS data to a feature |

---

## Add New Page

### Files to create/modify (checklist)
1. `src/pages/[Name].tsx` — Page component (use `npm run scaffold -- --name X --type page`)
2. `src/hooks/use[Name]Data.ts` — Data hook (scaffolded with page)
3. `src/App.tsx` — Lazy import + Route definition
4. `src/components/layout/AppSidebar.tsx` — Sidebar item (if needed)
5. `src/i18n/locales/en.json` + `es.json` — i18n keys

### Step-by-step

```bash
# 1. Scaffold the page
npm run scaffold -- --name MyFeature --type page --section insights
```

**2. Add lazy import to App.tsx** (alphabetical order in the lazy section):
```tsx
const MyFeature = lazy(() => import("@/pages/MyFeature"));
```

**3. Add Route** (inside the `<Route element={<ProtectedRoute>...}>` block):
```tsx
<Route path="/insights/my-feature" element={
  <Suspense fallback={<SectionLoader section="MyFeature" />}>
    <InsightErrorBoundary pageName="MyFeature">
      <MyFeature />
    </InsightErrorBoundary>
  </Suspense>
} />
```

**4. Add sidebar item** — See [Add Sidebar Item](#add-sidebar-item)

**5. Add i18n keys**:
```json
// en.json
"myFeature": { "title": "My Feature" }
// es.json
"myFeature": { "title": "Mi Feature" }
```

**6. Verify:**
```bash
npm run preflight
```

### Common mistakes
- ❌ Forgetting the `lazy()` import → breaks code splitting
- ❌ Missing `<Suspense>` wrapper → crash on slow loads
- ❌ Missing `<InsightErrorBoundary>` → unhandled errors crash whole app
- ❌ Not adding to sidebar → page exists but users can't find it

---

## Add New RPC

### Files to create/modify (checklist)
1. `supabase/migrations/YYYYMMDDHHMMSS_add_[name].sql` — SQL function
2. `src/data/rpc-contracts.ts` — Zod schema + add to `RPC_REGISTRY`
3. `src/data/[module].ts` — TypeScript wrapper function
4. `src/data/__tests__/rpc-contracts.test.ts` — Contract test auto-covers via registry
5. Regenerate types: `npm run db:types`

### Step-by-step

**1. Create migration** (idempotent SQL):
```sql
-- supabase/migrations/20260328120000_add_my_rpc.sql
CREATE OR REPLACE FUNCTION public.get_my_data(
  p_org_id UUID,
  p_location_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  -- define columns
  id UUID,
  name TEXT,
  value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE organization_id = p_org_id
    AND (p_location_id IS NULL OR location_id = p_location_id)
    AND date BETWEEN p_date_from AND p_date_to;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_data TO authenticated;
NOTIFY pgrst, 'reload schema';
```

**2. Add Zod schema** in `src/data/rpc-contracts.ts`:
```tsx
export const MyDataRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: num,
}).passthrough();

export const MyDataSchema = z.array(MyDataRowSchema);

// Add to RPC_REGISTRY:
export const RPC_REGISTRY = {
  ...existing,
  get_my_data: MyDataSchema,
} as const;
```

**3. Verify:**
```bash
npm run db:lint
npm run db:types
npx vitest run src/data/__tests__/rpc-contracts.test.ts
npm run preflight
```

### Common mistakes
- ❌ Missing `NOTIFY pgrst` → PostgREST cache stale, function not callable
- ❌ Missing `GRANT EXECUTE` → RPC callable by anon but not by authenticated
- ❌ Missing `IF NOT EXISTS` patterns → migration fails on re-run
- ❌ Not adding to `RPC_REGISTRY` → contract test won't cover it

---

## Add Sidebar Item

### File: `src/components/layout/AppSidebar.tsx`

**For Insights section** — add to `insightsChildren` array:
```tsx
{ icon: MyIcon, i18nKey: 'nav.myFeature', path: '/insights/my-feature', key: 'my_feature_permission' as const },
```

**For Workforce section** — add to `workforceChildren` array:
```tsx
{ icon: MyIcon, i18nKey: 'nav.myFeature', path: '/workforce/my-feature', key: 'scheduling' as const },
```

**For Cost Management section** — add a new `<Button>` inside the cost `<CollapsibleContent>`.

**For standalone item** — add a new `<Button>` directly in the `<nav>` block.

### Permission keys (from SIDEBAR_PERMISSIONS)
`dashboard`, `insights`, `sales`, `labour`, `instant_pl`, `reviews`, `inventory`, `waste`, `menu_engineering`, `scheduling`, `availability`, `payroll`, `procurement`, `settings`

### Route detection
Update the relevant `is*Route` variable if the path prefix is new:
```tsx
const isCostRoute = location.pathname.startsWith('/inventory-setup') || ...
```

---

## Add Dashboard Widget

### File: typically a new component in `src/components/dashboard/`

**Pattern:**
```tsx
import { Card } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

export function MyWidget() {
  const { t } = useTranslation();
  // Use a hook for data
  return (
    <Card className="p-5">
      <h3 className="text-sm font-normal text-gray-700">{t('dashboard.myWidget')}</h3>
      <div className="text-3xl font-bold text-gray-900 mt-2">Value</div>
    </Card>
  );
}
```

Then add to `src/pages/Dashboard.tsx` in the appropriate grid section.

---

## Add Demo Data

### Key rules
- Use `CURRENT_DATE ± INTERVAL` for dates — **never** hardcoded dates
- Match the org_id: `7bca34d5-4448-40b8-bb7f-55f1417aeccd`
- After adding, verify: `npm run demo:verify`

### Pattern (in migration or seed script):
```sql
INSERT INTO my_table (organization_id, date, value)
SELECT
  '7bca34d5-4448-40b8-bb7f-55f1417aeccd',
  CURRENT_DATE - (n || ' days')::INTERVAL,
  (RANDOM() * 1000)::NUMERIC(10,2)
FROM generate_series(0, 29) AS n
ON CONFLICT DO NOTHING;
```

---

## Connect POS Data

### Architecture
POS data flows: `POS API → Supabase Edge Function → pos_transactions table → Materialized Views → RPCs`

### Key tables
- `pos_transactions` — raw POS data
- `daily_sales_summary` — aggregated daily view
- `daily_sales_summary_mv` — materialized view (may be stale)

### Pattern for hooks
Use `useDataSource()` hook to detect data source:
```tsx
import { useDataSource } from '@/hooks/useDataSource';

const { source, isDemoMode } = useDataSource();
// source: 'pos' | 'demo' | 'mixed'
```

Always provide demo fallbacks when POS data might not be available.
