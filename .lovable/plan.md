
# Plan: Conexión 100% Realista al POS para Sales

## Diagnóstico del Problema

He analizado los datos y encontrado lo siguiente:

| Métrica | Datos Reales (POS) | Lo que muestra UI |
|---------|-------------------|-------------------|
| **Ventas/día** | €14,000-15,000 | Variable (puede mostrar demo) |
| **ACS real** | €42-47 | €23.50 (si es demo) |
| **Tickets/día** | 150-180 | Variable |
| **Ubicaciones con datos** | Chamberí, Malasaña, Salamanca | Depende del login |

**El hook `useBISalesData` ya está conectado correctamente al POS**, pero hay escenarios donde muestra datos ficticios:
1. Si `effectiveLocationIds` está vacío
2. Si no hay tickets en el rango de fechas seleccionado
3. Los forecasts no están alineados con las ventas reales

---

## Cambios a Implementar

### 1. Eliminar Datos Demo Ficticios

**Archivo:** `src/hooks/useBISalesData.ts`

- Eliminar la función `generateDemoData` completamente
- En lugar de mostrar datos ficticios, mostrar estado vacío con mensaje explicativo
- Si no hay datos, devolver valores en 0 con un flag `isEmpty: true`

### 2. Regenerar Forecasts Basados en POS Real

**Edge Function:** `supabase/functions/generate_forecast/index.ts`

El forecast actual tiene valores fijos (~€4,800/ubicación) que no reflejan la realidad. Debemos:
- Recalcular forecasts basados en promedios históricos reales de tickets
- Usar patrón de día de semana del histórico POS
- Añadir variación realista (±10%) para que no sea exacto

### 3. Corregir Cálculos de ACS

**Archivo:** `src/hooks/useBISalesData.ts`

El ACS se calcula como `net_total / covers`, que es correcto. Pero el ACS por canal actualmente usa `sales / orders` (línea 446):
```typescript
const acs = orders > 0 ? sales / orders : 0; // INCORRECTO
```
Debería ser:
```typescript
const covers = channelTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
const acs = covers > 0 ? sales / covers : 0; // CORRECTO
```

### 4. Añadir Indicador de Datos Reales vs Vacíos

**Archivo:** `src/components/bi/BIKpiCards.tsx`

- Mostrar badge "No data" cuando `isEmpty: true`
- Mostrar "Live data" cuando hay datos reales del POS

### 5. Mejorar Delta Calculations

**Archivo:** `src/hooks/useBISalesData.ts`

Los deltas actualmente comparan vs forecast. Para hacerlo más realista:
- `salesToDateDelta`: Actual vs Forecast (correcto)
- `avgCheckSizeDelta`: Debe comparar ACS actual vs ACS promedio histórico (no hardcodeado)
- `totalOrdersDelta`: Actual vs forecast de órdenes

### 6. Generar Sparklines Reales

**Archivo:** `src/hooks/useBISalesData.ts`

Actualmente los sparklines solo usan los últimos 7 puntos del chart. Para fechas más largas, deberíamos:
- Siempre calcular tendencia de 7 días reales antes del rango seleccionado
- Query adicional para obtener datos históricos para sparklines

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/useBISalesData.ts` | Eliminar demo data, corregir ACS por canal, añadir flag isEmpty |
| `src/components/bi/BIKpiCards.tsx` | Mostrar estado vacío elegante |
| `supabase/functions/generate_forecast/index.ts` | Regenerar forecasts basados en histórico real |
| `src/pages/Sales.tsx` | Mostrar mensaje si no hay datos |

---

## Sección Técnica

### Nueva Estructura de Retorno

```typescript
interface BISalesData {
  isEmpty: boolean;  // NUEVO - indica si no hay datos
  dataSource: 'pos' | 'demo';  // NUEVO - indica origen
  kpis: { ... };
  // ... resto igual
}
```

### Corrección de ACS por Canal

```typescript
// ANTES (incorrecto - divide por tickets)
const acs = orders > 0 ? sales / orders : 0;

// DESPUÉS (correcto - divide por covers)
const channelCovers = channelTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
const acs = channelCovers > 0 ? sales / channelCovers : 0;
```

### Regeneración de Forecasts

```typescript
// En generate_forecast/index.ts
// Calcular promedio de ventas por día de semana de las últimas 8 semanas
const avgSalesByDayOfWeek = await calculateHistoricalAverage(location_id, 56);

// Aplicar tendencia y variación
const forecastSales = avgSalesByDayOfWeek[dayOfWeek] * (1 + trend) * (0.95 + Math.random() * 0.1);
```

### Estado Vacío Elegante

```tsx
// En BIKpiCards.tsx
if (data?.isEmpty) {
  return (
    <Card className="col-span-4 p-8 text-center">
      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No sales data available</h3>
      <p className="text-muted-foreground mt-2">
        Select a date range with POS transactions or create sales via the POS terminal.
      </p>
    </Card>
  );
}
```

---

## Verificación de Datos Reales

Los datos confirmados en la base de datos:

| Fecha | Tickets | Ventas | ACS Real |
|-------|---------|--------|----------|
| 2026-01-30 | 180 | €14,689 | €47.56 |
| 2026-01-29 | 180 | €14,840 | €47.56 |
| 2026-01-28 | 174 | €13,357 | €39.24 |
| 2026-01-27 | 165 | €13,478 | €45.12 |
| 2026-01-26 | 150 | €11,943 | €43.62 |

Estos son los valores que deberían aparecer en la UI cuando se selecciona el rango correcto.

---

## Flujo de Datos Actualizado

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           FUENTE ÚNICA: POS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   tickets (POS)  ──┬─────────────────────────────────────────────────>  │
│   - net_total      │                                                    │
│   - covers         │     Sales Module UI                                │
│   - channel        │     ┌─────────────────────────────────┐            │
│   - closed_at      │     │ KPIs: Sales, ACS, Orders, Acc. │            │
│                    │     │ Chart: Actual vs Forecast      │            │
│   ticket_lines ────┼───> │ Channels: Din/Pk/Del           │            │
│   - category_name  │     │ Categories: Food/Bev/Other     │            │
│   - item_name      │     │ Products: Top 10               │            │
│   - gross_line_total     │ Locations: By store            │            │
│                    │     └─────────────────────────────────┘            │
│                    │                                                    │
│   forecast_daily ──┘                                                    │
│   - forecast_sales (basado en histórico POS)                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Después de estos cambios:

1. **Sales to date**: €14,689 (dato real del 30 enero)
2. **Avg check size**: €47.56 (calculado correctamente con covers)
3. **Orders**: 180 (tickets reales)
4. **Forecast accuracy**: 75-85% (basado en forecast regenerado)
5. **Sparklines**: Tendencia real de últimos 7 días
6. **No más datos ficticios**: Si no hay datos, se muestra mensaje claro
