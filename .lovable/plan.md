
# Plan: Sales Module - Copia Exacta de Nory

## Resumen

Transformaremos el módulo de ventas `/insights/sales` para que sea una réplica pixel-perfect del dashboard de Nory. Esto incluye cambios visuales, de estructura y funcionales para alinear completamente la experiencia con la de Nory.

---

## Análisis Comparativo: Estado Actual vs Nory

### Ya Implementado (Similares a Nory)

| Componente | Estado Actual |
|------------|---------------|
| Date Picker con navegación ←/→ | ✅ `DateRangePickerNoryLike.tsx` |
| KPI Cards (Sales, ACS, Dwell) | ✅ `BIKpiCards.tsx` |
| Gráfico Sales vs Forecast | ✅ `BISalesChart.tsx` |
| Tabla de Canales | ✅ `BIChannelsTable.tsx` |
| Tabla de Localizaciones | ✅ `BILocationTable.tsx` |
| Panel Ask Josephine (AI) | ✅ `AskJosephinePanel.tsx` |
| Tokens de color BI específicos | ✅ `--bi-actual`, `--bi-forecast`, etc. |
| Indicador "Live" en tiempo real | ✅ Badge con animación ping |

### Diferencias Visuales a Corregir

| Elemento | Actual | Nory Target |
|----------|--------|-------------|
| **Esquema de colores** | Púrpura (#6366F1) | Mismo púrpura pero más saturado en barras |
| **Gráfico principal** | 3 barras (Actual, Live, Forecast) | Solo 2 barras (Actual púrpura, Forecast gris) + línea ACS |
| **Leyenda del gráfico** | Debajo del chart | Integrada en el header del chart |
| **Título de KPIs** | "Sales to date" | Mantener pero añadir sparkline mini |
| **Channel Bar en KPI** | Barra horizontal dividida | Idéntico a Nory ✓ |
| **Tabla Channels** | Headers dobles | Nory usa headers más compactos |
| **Orden de secciones** | KPIs → Chart → Channels → Categories → Locations | Igual pero Channels antes de Chart |

### Funcionalidades Faltantes para Paridad Exacta

| Feature | Descripción | Prioridad |
|---------|-------------|-----------|
| **Forecast Accuracy KPI** | 4º KPI card mostrando % precisión del modelo | Alta |
| **Total Orders KPI** | Mostrar # de pedidos totales en un KPI | Media |
| **Mini sparklines en KPIs** | Tendencia de 7 días en cada KPI card | Media |
| **Chart hover tooltip mejorado** | Mostrar delta % en tooltip | Baja |
| **Export button** | Botón para exportar datos a CSV | Baja |

---

## Cambios a Implementar

### 1. Reordenar Layout de Página

**Archivo:** `src/pages/Sales.tsx`

Nuevo orden de secciones:
1. Header (breadcrumbs + date picker + compare + Live badge)
2. KPI Cards (4 cards en fila)
3. Channels Table (movido arriba)
4. Sales vs Forecast Chart
5. Categories + Products (lado a lado)
6. Locations Table

### 2. Añadir 4º KPI Card: Forecast Accuracy

**Archivo:** `src/components/bi/BIKpiCards.tsx`

Cambiar de 3 a 4 columnas:
- **Sales to date** (actual)
- **Average check size** (actual)
- **Orders** (nuevo - total de pedidos)
- **Forecast accuracy** (nuevo - % de precisión)

### 3. Simplificar Gráfico Principal

**Archivo:** `src/components/bi/BISalesChart.tsx`

Cambios:
- Eliminar barra "Forecast Live" (redundante)
- Mantener solo: Actual (púrpura sólido) + Forecast (gris/outline)
- Línea ACS con formato Nory (sin dots intermedios)
- Mover leyenda al header de la card
- Añadir "View: Sales | Orders" tabs en el header

### 4. Compactar Tabla de Canales

**Archivo:** `src/components/bi/BIChannelsTable.tsx`

Cambios:
- Reducir padding
- Headers más compactos sin "Actual/Projected" en sub-headers
- Añadir fila de "% del total" para cada canal

### 5. Añadir Mini Sparklines a KPIs

**Archivo:** `src/components/bi/BIKpiCards.tsx`

Para cada KPI card:
- Añadir sparkline de 7 días debajo del valor principal
- Usar `recharts` AreaChart miniatura sin ejes

### 6. Mejorar Export Button

**Archivo:** `src/components/bi/BISalesHeader.tsx`

Añadir:
- Botón "Export" junto a "Ask Josephine"
- Dropdown con opciones: CSV, PDF

### 7. Actualizar Tokens de Color

**Archivo:** `src/index.css`

Ajustar saturación:
```css
--bi-actual: 263 75% 55%; /* más saturado */
--bi-forecast: 220 10% 75%; /* más gris/neutral */
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Sales.tsx` | Reordenar componentes, añadir tabs |
| `src/components/bi/BIKpiCards.tsx` | 4 KPIs, añadir Orders + Accuracy, sparklines |
| `src/components/bi/BISalesChart.tsx` | Simplificar a 2 barras, mover leyenda, añadir tabs |
| `src/components/bi/BIChannelsTable.tsx` | Compactar headers, añadir % total |
| `src/components/bi/BISalesHeader.tsx` | Añadir Export button |
| `src/hooks/useBISalesData.ts` | Añadir `totalOrders` y `forecastAccuracy` a KPIs |
| `src/index.css` | Ajustar tokens BI |

---

## Sección Técnica

### Nueva Estructura de KPIs

```typescript
interface BIKpis {
  salesToDate: number;
  salesToDateDelta: number;
  avgCheckSize: number;
  avgCheckSizeDelta: number;
  totalOrders: number;           // NUEVO
  totalOrdersDelta: number;       // NUEVO
  forecastAccuracy: number;       // NUEVO (0-100%)
  dwellTime: number | null;       // Se mantiene pero en tooltip
  // ... resto igual
}
```

### Cálculo de Forecast Accuracy

```typescript
// En useBISalesData.ts
const forecastAccuracy = useMemo(() => {
  if (!chartData || chartData.length === 0) return 0;
  
  const withBoth = chartData.filter(d => d.actual > 0 && d.forecast > 0);
  if (withBoth.length === 0) return 0;
  
  const mape = withBoth.reduce((sum, d) => {
    return sum + Math.abs((d.actual - d.forecast) / d.forecast);
  }, 0) / withBoth.length;
  
  return Math.round((1 - mape) * 100);
}, [chartData]);
```

### Sparkline Component

```tsx
// Mini sparkline para KPI cards
function KpiSparkline({ data }: { data: number[] }) {
  return (
    <ResponsiveContainer width="100%" height={24}>
      <AreaChart data={data.map((v, i) => ({ v }))}>
        <Area 
          type="monotone" 
          dataKey="v" 
          fill="hsl(var(--bi-actual) / 0.2)" 
          stroke="hsl(var(--bi-actual))"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Chart Header con Tabs y Leyenda

```tsx
<CardHeader className="flex flex-row items-center justify-between pb-2">
  <div className="flex items-center gap-4">
    <CardTitle className="text-lg font-semibold">Sales v Forecast</CardTitle>
    <Tabs value={view} onValueChange={setView}>
      <TabsList className="h-7">
        <TabsTrigger value="sales" className="text-xs px-3 h-6">Sales</TabsTrigger>
        <TabsTrigger value="orders" className="text-xs px-3 h-6">Orders</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
  <div className="flex items-center gap-4 text-xs">
    <LegendItem color="bi-actual" label="Actual" type="bar" />
    <LegendItem color="bi-forecast" label="Forecast" type="bar" />
    <LegendItem color="bi-acs" label="Avg Check" type="line" />
  </div>
</CardHeader>
```

---

## Mockup de Layout Final

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Insights / Sales           ◀ 20 Jan ▶    Compare: Forecast   🟢 Live  │
│  ☐ All locations ▼                                    [Export] [✨ Ask] │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ Sales       │ │ Avg Check   │ │ Orders      │ │ Accuracy    │        │
│ │ €12,450     │ │ €23.50      │ │ 530         │ │ 94%         │        │
│ │ +5.2%▲      │ │ +2.1%▲      │ │ -1.3%▼      │ │ —           │        │
│ │ ▄▄▆▇█▅▄▃   │ │ ▁▂▄▅▅▆▇▆   │ │ ▅▆▅▄▅▆▇▆   │ │             │        │
│ │ ░░░░░░░░░░░│ │             │ │             │ │             │        │
│ │ Din 55% Pk 25% Del 20%     │ │ Din Pk Del  │ │             │        │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────────────────────┤
│ Channels                                                                │
│ ┌───────────┬──────────────────────┬──────────────────────┐            │
│ │ Channel   │      Sales           │   Avg Check Size     │            │
│ │           │ Actual    Forecast   │ Actual    Forecast   │            │
│ ├───────────┼──────────────────────┼──────────────────────┤            │
│ │ Dine in   │ €6,800    €6,500     │ €28.50    €27.00     │            │
│ │           │ +4.6%                │ +5.5%                │            │
│ │ Pick-up   │ €3,100    €3,200     │ €18.20    €19.00     │            │
│ │ Delivery  │ €2,550    €2,400     │ €21.30    €20.50     │            │
│ │ TOTAL     │ €12,450   €12,100    │ €23.50    €22.80     │            │
│ └───────────┴──────────────────────┴──────────────────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│ Sales v Forecast    [Sales | Orders]       ■ Actual ■ Forecast — ACS  │
│ ┌───────────────────────────────────────────────────────────────────┐  │
│ │                                                        ━━━━━━━━   │  │
│ │   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   │  │
│ │   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   │  │
│ │   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   ██  ░░   │  │
│ │  Mon      Tue      Wed      Thu      Fri      Sat      Sun       │  │
│ └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────┐│
│ │ Sales per Product Categories│ │ Products                   Sort: ▼ ││
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Food 65%   │ │ Hamburguesa      €1,500   ▓▓▓ 12% ││
│ │ ▓▓▓▓▓▓▓▓░░░░░░░ Bev  28%   │ │ Pizza            €1,240   ▓▓░ 10% ││
│ │ ▓▓░░░░░░░░░░░░░ Other 7%   │ │ Ensalada         €980     ▓░░  8% ││
│ └─────────────────────────────┘ └─────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ Sales by location                                    🔍 Search...      │
│ ┌──────────────┬─────────────────────┬─────────────────────┬─────────┐ │
│ │ Location     │     Sales           │      Channels        │ Other  │ │
│ │              │ Actual   Forecast   │ Din   Del   Pk       │ ACS    │ │
│ ├──────────────┼─────────────────────┼─────────────────────┼─────────┤ │
│ │ Centro       │ €4,360   €4,200     │ €2.4k €1.1k €860    │ €26.50 │ │
│ │ Salamanca    │ €3,480   €3,350     │ €1.9k €940  €640    │ €28.20 │ │
│ │ ...          │ ...      ...        │ ...   ...   ...     │ ...    │ │
│ │ SUM / AVG    │ €12,450  €12,100    │ —     —     —       │ €23.50 │ │
│ └──────────────┴─────────────────────┴─────────────────────┴─────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementación

### Fase 1: Estructura y KPIs (Este PR)
1. Añadir Orders y Forecast Accuracy a KPIs
2. Cambiar grid de 3 a 4 columnas
3. Implementar mini sparklines
4. Reordenar layout (Channels antes de Chart)

### Fase 2: Chart y Canales
5. Simplificar chart a 2 barras
6. Añadir tabs Sales/Orders en header
7. Mover leyenda al header
8. Compactar tabla Channels

### Fase 3: Polish Visual
9. Ajustar tokens de color
10. Añadir botón Export
11. Mejorar tooltips
12. Responsive tweaks

---

## Consideraciones

- **Compatibilidad móvil**: Los 4 KPIs se apilarán en 2x2 en móvil
- **Performance**: Los sparklines usan datos ya cargados, sin queries adicionales
- **Datos vacíos**: Forecast Accuracy mostrará "—" si no hay suficientes datos
- **Internacionalización**: Nuevos textos añadidos a los archivos i18n
