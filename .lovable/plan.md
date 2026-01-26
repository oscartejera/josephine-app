

# Plan: Eliminar TODO lo Ficticio - Paridad 100% con Nory

## Módulos con Datos Demo/Mock Restantes

| Módulo | Problema | Prioridad |
|--------|----------|-----------|
| **Dashboard** | `Math.random()` para margen de productos (línea 120) | 🔴 Alta |
| **Waste** | `generateDemoData()` si no hay waste_events | 🔴 Alta |
| **Reviews** | 100% mock - `generateMockReviews()` | 🔴 Alta |
| **Instant P&L** | COGS estimado con `SeededRandom` (25-32%) | 🟡 Media |
| **Reconciliation** | Items hardcodeados si no hay stock counts | 🟡 Media |
| **Procurement** | `Math.random()` para forecast usage | 🟡 Media |
| **Order History** | 100% mock - genera pedidos ficticios | 🟡 Media |
| **Payroll** | KPIs mock (€45k gross, €35k net) | 🟡 Media |
| **KDS Dashboard** | Valores default cuando no hay datos | 🟢 Baja |

---

## Cambios a Implementar

### FASE 1: Dashboard (Prioridad Alta)

**Archivo:** `src/pages/Dashboard.tsx`

1. **Eliminar margen aleatorio** (línea 120)
   - Actualmente: `margin: Math.floor(55 + Math.random() * 20)`
   - Solución: Calcular margen real desde `recipes.cost_ratio` o usar 0 si no existe
   
```typescript
// ANTES
setTopItems(sortedItems.map((item, i) => ({ 
  rank: i + 1, 
  ...item, 
  margin: Math.floor(55 + Math.random() * 20)  // ❌ FICTICIO
})));

// DESPUÉS
// Fetch recipe costs from DB
const { data: recipes } = await supabase
  .from('recipes')
  .select('name, cost_ratio');
const costMap = new Map(recipes?.map(r => [r.name.toLowerCase(), r.cost_ratio]) || []);

setTopItems(sortedItems.map((item, i) => {
  const costRatio = costMap.get(item.name.toLowerCase()) || 0.30; // Default 30% COGS
  const margin = Math.round((1 - costRatio) * 100);
  return { rank: i + 1, ...item, margin };
}));
```

### FASE 2: Waste Module (Prioridad Alta)

**Archivo:** `src/hooks/useWasteData.ts`

1. **Eliminar `generateDemoData()`** (líneas 448-520)
2. **Mostrar empty state** si no hay waste_events

```typescript
// Eliminar completamente esta función:
const generateDemoData = () => { ... }

// Y el useEffect que la llama:
useEffect(() => {
  if (!isLoading && metrics.totalAccountedWaste === 0) {
    generateDemoData(); // ❌ ELIMINAR
  }
}, ...);

// Reemplazar con:
// Si no hay datos, simplemente mostrar métricas en 0
// El UI ya maneja esto con empty states
```

### FASE 3: Reviews Module (Prioridad Alta)

**Archivo:** `src/hooks/useReviewsData.ts`

Este módulo es 100% ficticio. Opciones:
1. **Opción A**: Conectar a tabla `reviews` real (requiere crear tabla + RLS)
2. **Opción B**: Mostrar empty state con CTA para integrar Google/TripAdvisor

```typescript
// Crear tabla reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id),
  platform text NOT NULL, -- 'google', 'tripadvisor', 'yelp'
  external_id text,
  rating int2 CHECK (rating >= 1 AND rating <= 5),
  author_name text,
  content text,
  created_at timestamptz NOT NULL,
  replied_at timestamptz,
  reply_content text,
  group_id uuid REFERENCES groups(id)
);

// RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own group reviews" ON reviews
  FOR SELECT USING (group_id IN (SELECT group_id FROM user_groups WHERE user_id = auth.uid()));
```

### FASE 4: Instant P&L (Prioridad Media)

**Archivo:** `src/hooks/useInstantPLData.ts`

1. **COGS**: Usar ratio real de `recipes.cost_ratio` en vez de random 25-32%
2. **Labour**: Ya está conectado a `timesheets` - verificar que no usa fallback

```typescript
// ANTES (líneas 176-182)
const cogsRatio = rng.between(0.25, 0.32); // ❌ FICTICIO

// DESPUÉS
// Calcular COGS real desde ticket_lines + recipes
const { data: ticketLines } = await supabase
  .from('ticket_lines')
  .select('item_name, gross_line_total')
  .eq('tickets.location_id', loc.id)
  .gte('tickets.closed_at', from)
  .lte('tickets.closed_at', to);

const { data: recipes } = await supabase
  .from('recipes')
  .select('name, cost_ratio');

const costMap = new Map(recipes?.map(r => [r.name.toLowerCase(), r.cost_ratio]) || []);

const cogsActual = ticketLines?.reduce((sum, line) => {
  const ratio = costMap.get(line.item_name?.toLowerCase()) || 0.30;
  return sum + (line.gross_line_total || 0) * ratio;
}, 0) || 0;
```

### FASE 5: Reconciliation (Prioridad Media)

**Archivo:** `src/hooks/useReconciliationData.ts`

1. **Eliminar `demoItems` hardcodeados** (líneas 217-229)
2. **Usar `inventory_items` reales**
3. **Empty state** si no hay stock counts

```typescript
// ELIMINAR líneas 217-229 (demoItems array)

// Usar inventory_items reales
const { data: items } = await supabase
  .from('inventory_items')
  .select('id, name, unit')
  .eq('location_id', locationId);

if (!items || items.length === 0) {
  setError(new Error('NO_INVENTORY_ITEMS'));
  return;
}
```

### FASE 6: Procurement (Prioridad Media)

**Archivo:** `src/hooks/useProcurementData.ts`

1. **Eliminar `generateForecastUsage()`** con Math.random (líneas 66-72)
2. **Calcular forecast usage real** desde histórico de ticket_lines

```typescript
// ELIMINAR
function generateForecastUsage(days: number = 30): number[] {
  const baseUsage = Math.floor(Math.random() * 6) + 2; // ❌ FICTICIO
  ...
}

// REEMPLAZAR CON
async function calculateRealForecastUsage(itemId: string, days: number = 30): Promise<number[]> {
  // Query histórico de consumo desde ticket_lines + recipe_ingredients
  const { data } = await supabase
    .from('ticket_lines')
    .select('quantity, tickets!inner(closed_at)')
    .eq('item_name', itemName)
    .gte('tickets.closed_at', subDays(new Date(), days).toISOString());
  
  // Agrupar por día
  const dailyUsage = new Map<string, number>();
  data?.forEach(line => {
    const day = format(new Date(line.tickets.closed_at), 'yyyy-MM-dd');
    dailyUsage.set(day, (dailyUsage.get(day) || 0) + line.quantity);
  });
  
  return Array.from(dailyUsage.values());
}
```

### FASE 7: Order History (Prioridad Media)

**Archivo:** `src/components/procurement/OrderHistoryPanel.tsx`

1. **Eliminar generación mock** (líneas 53-85)
2. **Crear tabla `purchase_orders`** para histórico real

```sql
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id),
  supplier_id uuid REFERENCES suppliers(id),
  order_number text NOT NULL,
  status text DEFAULT 'pending', -- pending, sent, delivered, cancelled
  ordered_at timestamptz DEFAULT now(),
  expected_delivery_at timestamptz,
  delivered_at timestamptz,
  subtotal numeric(12,2),
  tax numeric(12,2),
  delivery_fee numeric(12,2),
  total numeric(12,2),
  group_id uuid REFERENCES groups(id)
);

CREATE TABLE purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id),
  item_name text,
  quantity numeric(10,2),
  unit_price numeric(10,2),
  total numeric(12,2)
);
```

### FASE 8: Payroll KPIs (Prioridad Media)

**Archivo:** `src/components/payroll/PayrollHome.tsx`

1. **Conectar KPIs a `payslips` reales** (líneas 42-49)

```typescript
// ANTES
const kpis = {
  totalGross: currentRun ? 45000 : 0, // ❌ HARDCODED
  totalNet: currentRun ? 35000 : 0,   // ❌ HARDCODED
  ...
};

// DESPUÉS
const { data: payslips } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay, employer_ss, irpf_withheld')
  .eq('payroll_run_id', currentRun?.id);

const kpis = {
  totalGross: payslips?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0,
  totalNet: payslips?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0,
  totalEmployerSS: payslips?.reduce((sum, p) => sum + Number(p.employer_ss), 0) || 0,
  totalIRPF: payslips?.reduce((sum, p) => sum + Number(p.irpf_withheld), 0) || 0,
  employeeCount: payslips?.length || 0,
};
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Dashboard.tsx` | Margen real desde recipes |
| `src/hooks/useWasteData.ts` | Eliminar generateDemoData |
| `src/hooks/useReviewsData.ts` | Conectar a tabla reviews o empty state |
| `src/hooks/useInstantPLData.ts` | COGS real desde recipes |
| `src/hooks/useReconciliationData.ts` | Eliminar demoItems |
| `src/hooks/useProcurementData.ts` | Forecast usage real |
| `src/components/procurement/OrderHistoryPanel.tsx` | Conectar a purchase_orders |
| `src/components/payroll/PayrollHome.tsx` | KPIs desde payslips |
| `src/components/payroll/PayrollCalculate.tsx` | Eliminar variation mock |

---

## Tablas Nuevas Requeridas

| Tabla | Propósito |
|-------|-----------|
| `reviews` | Reviews de Google/TripAdvisor/Yelp |
| `purchase_orders` | Histórico de pedidos a proveedores |
| `purchase_order_lines` | Líneas de cada pedido |

---

## Orden de Implementación

1. **Dashboard margen real** (cambio simple, alto impacto visual)
2. **Waste sin demo data** (eliminar código ficticio)
3. **Instant P&L COGS real** (usa datos existentes)
4. **Reconciliation sin fallback** (empty state elegante)
5. **Procurement forecast real** (requiere más lógica)
6. **Payroll KPIs reales** (ya tiene tabla payslips)
7. **Reviews tabla nueva** (requiere migración DB)
8. **Order History tabla nueva** (requiere migración DB)

---

## Resultado Final

Después de estos cambios, **CERO** datos ficticios:

| Módulo | Estado |
|--------|--------|
| Dashboard | ✅ 100% POS real |
| Sales | ✅ 100% POS real |
| Labour | ✅ 100% timesheets |
| Scheduling | ✅ 100% planned_shifts |
| Waste | ✅ 100% waste_events |
| Inventory | ✅ 100% tickets + stock_counts |
| Instant P&L | ✅ 100% calculado real |
| Menu Engineering | ✅ 100% ticket_lines |
| Budgets | ✅ 100% forecast vs actual |
| Reviews | ✅ Empty state / real cuando integrado |
| Procurement | ✅ Real forecast + purchase_orders |
| Payroll | ✅ 100% payslips |

