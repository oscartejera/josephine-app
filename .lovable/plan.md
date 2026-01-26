
# Plan: Paridad Completa con Nory - Conexión 100% POS Real

## Diagnóstico del Estado Actual

He analizado todo el sistema y encontrado lo siguiente:

### Datos Reales Disponibles (Base de Datos)

| Tabla | Registros | Rango de Fechas |
|-------|-----------|-----------------|
| **tickets** | 16,788 | 2024-01-01 → 2026-01-30 |
| **timesheets** | 54,508 | 2022-01-01 → 2026-01-23 |
| **planned_shifts** | 46,533 | 2022-01-01 → 2026-01-31 |
| **waste_events** | 816 | 2025-12-27 → 2026-01-25 |
| **forecast_daily_metrics** | 7,392 | 2022-01-01 → 2027-01-25 |
| **employees** | 108 activos | con hourly_cost ✓ |
| **inventory_items** | 32 | - |
| **recipes** | 22 | - |
| **recipe_ingredients** | 0 | ⚠️ Vacío |

### Módulos con Datos Reales (Ya Conectados)

| Módulo | Estado | Fuente de Datos |
|--------|--------|-----------------|
| **Sales** | ✅ Conectado | `tickets` + `forecast_daily_metrics` |
| **Labour** | ✅ Conectado | RPC `get_labour_kpis` + `sales_daily_unified` |
| **Scheduling** | ✅ Conectado | `planned_shifts` + `forecast_daily_metrics` |
| **Waste** | ✅ Conectado | `waste_events` + `tickets` |

### Módulos con Datos Ficticios/Demo (Requieren Conexión)

| Módulo | Problema | Solución |
|--------|----------|----------|
| **Dashboard** | Alerts fijas, hourlyLabor mock | Conectar a POS real |
| **Inventory** | Usa `demoDataGenerator` como fallback | Eliminar fallback |
| **Procurement** | Usa `FALLBACK_SKUS` fijos | Conectar a `inventory_items` |
| **Menu Engineering** | Parcialmente conectado | Verificar datos reales |
| **Instant P&L** | Flash actuals vs forecast | Verificar conexión |
| **Budgets** | Puede usar datos demo | Verificar conexión |

---

## Cambios a Implementar

### FASE 1: Dashboard 100% Real (Prioridad Alta)

**Archivo:** `src/pages/Dashboard.tsx`

1. **Eliminar Alerts hardcodeadas** (líneas 51-57)
   - Crear componente de alertas dinámicas basado en:
     - COL% > target → alerta
     - Ventas < forecast → alerta
     - Waste > umbral → alerta
   - Consultar datos reales para generar alertas

2. **Conectar HourlyLaborChart a datos reales** (línea 124)
   - Actualmente: `Math.random() * 80 + 20` (mock)
   - Cambiar a: Query de `timesheets` agrupado por hora

3. **Conectar CategoryBreakdownChart a POS**
   - Usar `ticket_lines.category_name` para desglose real

### FASE 2: Inventory sin Fallback Demo (Prioridad Alta)

**Archivo:** `src/hooks/useInventoryData.ts`

1. **Eliminar función `useDemoData`** (línea 489+)
2. **Mostrar empty state elegante** si no hay datos
3. **Conectar recipe_ingredients** para COGS teórico:
   - Actualmente `recipe_ingredients` está vacío
   - Necesita datos para calcular Theoretical COGS
   - Sin esto, usar ratio promedio del POS

### FASE 3: Procurement Conectado a Inventory Real

**Archivo:** `src/hooks/useProcurementData.ts`

1. **Eliminar `FALLBACK_SKUS`** (líneas 64-100)
2. **Conectar a `inventory_items`** reales
3. **Calcular forecast usage desde POS:**
   - Analizar `ticket_lines` → recetas → ingredientes
   - Predecir consumo basado en forecast de ventas

### FASE 4: Alertas Dinámicas Basadas en KPIs

**Nuevo archivo:** `src/hooks/useDashboardAlerts.ts`

```typescript
interface DynamicAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  metric: string;
  source: 'labour' | 'sales' | 'waste' | 'inventory' | 'forecast';
  locationId?: string;
}
```

Lógica de alertas:
- **COL% > target**: `timesheets.labor_cost / tickets.net_total > location_settings.target_col_percent`
- **Ventas < forecast**: `SUM(tickets.net_total) < forecast_daily_metrics.forecast_sales * 0.85`
- **Waste alto**: `SUM(waste_events.waste_value) > threshold`
- **Stock bajo**: `inventory_items.on_hand < min_level`

### FASE 5: Completar Datos Faltantes

**Migraciones de base de datos:**

1. **Seed recipe_ingredients** para calcular COGS teórico
2. **Crear tabla `alerts_config`** con umbrales por location

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Dashboard.tsx` | Eliminar mocks, conectar alerts dinámicas |
| `src/hooks/useInventoryData.ts` | Eliminar `useDemoData`, solo datos reales |
| `src/hooks/useProcurementData.ts` | Eliminar `FALLBACK_SKUS` |
| `src/hooks/useDashboardAlerts.ts` | **NUEVO** - Alertas dinámicas |
| `src/components/dashboard/AlertsPanel.tsx` | Conectar a hook real |
| `src/components/dashboard/CategoryBreakdownChart.tsx` | Datos de POS |

---

## Sección Técnica

### Hook de Alertas Dinámicas

```typescript
// src/hooks/useDashboardAlerts.ts
export function useDashboardAlerts(locationId: string | null, dateRange: DateRangeValue) {
  return useQuery({
    queryKey: ['dashboard-alerts', locationId, dateRange],
    queryFn: async () => {
      const alerts: DynamicAlert[] = [];
      
      // 1. Check COL% vs target
      const { data: labourData } = await supabase.rpc('get_labour_kpis', {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        selected_location_id: locationId
      });
      
      if (labourData && labourData.actual_col_pct > (labourData.planned_col_pct * 1.1)) {
        alerts.push({
          id: 'col-high',
          type: 'warning',
          title: 'Labor alto',
          description: `COL% ${labourData.actual_col_pct.toFixed(1)}% vs objetivo ${labourData.planned_col_pct.toFixed(1)}%`,
          metric: `${labourData.actual_col_pct.toFixed(1)}%`,
          source: 'labour'
        });
      }
      
      // 2. Check Sales vs Forecast
      const salesDelta = ((labourData.actual_sales - labourData.forecast_sales) / labourData.forecast_sales) * 100;
      if (salesDelta < -10) {
        alerts.push({
          id: 'sales-low',
          type: 'warning',
          title: 'Ventas bajo forecast',
          description: `Ventas ${Math.abs(salesDelta).toFixed(1)}% por debajo del forecast`,
          metric: `${salesDelta.toFixed(1)}%`,
          source: 'sales'
        });
      }
      
      // 3. Check Waste
      const { data: wasteData } = await supabase
        .from('waste_events')
        .select('waste_value')
        .gte('created_at', `${format(dateRange.from, 'yyyy-MM-dd')}T00:00:00`)
        .lte('created_at', `${format(dateRange.to, 'yyyy-MM-dd')}T23:59:59`);
      
      const totalWaste = wasteData?.reduce((sum, w) => sum + (w.waste_value || 0), 0) || 0;
      if (totalWaste > 100) { // Threshold €100
        alerts.push({
          id: 'waste-high',
          type: 'warning',
          title: 'Waste elevado',
          description: `€${totalWaste.toFixed(0)} de waste en el periodo`,
          metric: `€${totalWaste.toFixed(0)}`,
          source: 'waste'
        });
      }
      
      return alerts;
    }
  });
}
```

### Hourly Labor Chart Real

```typescript
// En Dashboard.tsx - fetchData()
const fetchHourlyLabor = async (from: Date, to: Date, locationId: string | null) => {
  let query = supabase
    .from('timesheets')
    .select('clock_in, clock_out, labor_cost')
    .gte('clock_in', from.toISOString())
    .lte('clock_in', to.toISOString());
  
  if (locationId && locationId !== 'all') {
    query = query.eq('location_id', locationId);
  }
  
  const { data } = await query;
  
  // Group by hour
  const hourlyMap = new Map<number, { labor: number; recommended: number }>();
  for (let h = 10; h <= 23; h++) {
    hourlyMap.set(h, { labor: 0, recommended: 0 });
  }
  
  data?.forEach(ts => {
    const hour = new Date(ts.clock_in).getHours();
    if (hourlyMap.has(hour)) {
      const current = hourlyMap.get(hour)!;
      current.labor += ts.labor_cost || 0;
    }
  });
  
  // Get recommended from forecast
  const { data: forecast } = await supabase
    .from('forecast_hourly_metrics')
    .select('hour, forecast_sales')
    .eq('location_id', locationId)
    .eq('date', format(from, 'yyyy-MM-dd'));
  
  forecast?.forEach(f => {
    if (hourlyMap.has(f.hour)) {
      // Recommended labor = forecast_sales * target_col% / avg_hourly_wage
      const current = hourlyMap.get(f.hour)!;
      current.recommended = f.forecast_sales * 0.22 / 12; // approx
    }
  });
  
  return Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    hour: `${hour}:00`,
    real: data.labor,
    recommended: data.recommended
  }));
};
```

### Empty State para Inventory

```tsx
// En useInventoryData.ts - reemplazar useDemoData
if (!hasRealData && isMountedRef.current) {
  setMetrics(defaultMetrics);
  setError(new Error('NO_DATA'));
  setIsLoading(false);
  return;
}
```

---

## Flujo de Datos Final

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FUENTE ÚNICA: POS (tickets)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   tickets ─────┬──────────────────────────────────────────────────────> │
│   ticket_lines │                                                        │
│                │    Dashboard                                           │
│   timesheets ──┼──> ┌─────────────────────────────────┐                │
│                │    │ • KPIs (ventas, GP%, COL%)      │                │
│   waste_events ┼──> │ • Alerts dinámicas              │                │
│                │    │ • Hourly charts (real data)     │                │
│   forecast_*  ─┘    └─────────────────────────────────┘                │
│                                                                         │
│   inventory_items ──> Procurement ──> Stock levels reales              │
│   recipes ──────────> Menu Engineering ──> Profit/popularity           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Después de estos cambios, la aplicación será 100% operativa:

1. **Dashboard**: Alertas reales basadas en KPIs del día
2. **Sales**: ✅ Ya conectado (verificado)
3. **Labour**: ✅ Ya conectado (usa RPCs)
4. **Scheduling**: ✅ Ya conectado
5. **Waste**: ✅ Ya conectado
6. **Inventory**: Solo datos reales, sin fallback demo
7. **Procurement**: Stock real, sin SKUs ficticios
8. **Menu Engineering**: Basado en ventas reales de productos

---

## Orden de Implementación

1. **Dashboard Alerts dinámicas** (impacto visual inmediato)
2. **Dashboard HourlyLabor real** (elimina mock más obvio)
3. **Inventory sin demo fallback** (consistencia de datos)
4. **Procurement conectado** (operación real)
5. **Seed recipe_ingredients** (para COGS teórico preciso)
