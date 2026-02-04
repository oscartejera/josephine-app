# 📊 Guía de Datos Demo - Josephine

Esta guía explica cómo generar datos demo coherentes para demos/inversores y cómo switchear a datos reales de POS.

## 🎯 Arquitectura de Datos

### **Flujo de Datos:**

```
POS Real (Square/Toast/etc.)
    ↓
Tickets & Payments
    ↓
facts_sales_15m ←┐
    ↓            │
facts_labor_daily │  
    ↓            │  Relationships
facts_item_mix    │  coherentes
    ↓            │
KPIs & Analytics ┘
```

## 🏗️ Tablas Principales

### **1. Master Data (estáticas)**
- `locations` - 3 ubicaciones: La Taberna Centro, Chamberí, Malasaña
- `employees` - ~30 empleados por location con roles (Chef, Server, Bartender, Host, Manager)
- `cdm_items` - ~20 productos del menú con precios y costos

### **2. Facts Tables (transaccionales - generadas)**
- `facts_sales_15m` - Ventas cada 15 minutos (30-60 días)
- `facts_labor_daily` - Labour metrics por día (30-60 días)
- `facts_item_mix_daily` - Productos vendidos por día (30-60 días)

## 🚀 Opción 1: Datos Demo Generados (para demos)

### **Características:**
- ✅ **60 días de historia** con patrones realistas
- ✅ **Coherencia total**: Sales ↔ Labour ↔ Products alineados
- ✅ **Patrones semanales**: Weekends +50%, mid-week -15%
- ✅ **3 locations** con características únicas
- ✅ **Variación realista**: Random ±10% por realismo

### **Cómo generar:**

#### **Método A: SQL Migration (automático al deploy)**

La migración `20260204_seed_demo_data_simple.sql` se ejecuta automáticamente cuando se hace push a Lovable.

```sql
-- Ejecutar manualmente si es necesario:
SELECT * FROM seed_josephine_demo_data();
```

#### **Método B: Edge Function (on-demand)**

```typescript
// Desde el frontend (botón "Generate Demo Data"):
const { data } = await supabase.functions.invoke('seed_demo_data', {
  body: { days: 60, locations: 3 }
});
```

### **Datos generados:**

**Locations:**
- La Taberna Centro (Salamanca) - Premium, ticket alto €26
- Chamberí (Madrid) - Mid-range, ticket medio €23
- Malasaña (Madrid) - Casual, ticket bajo €22

**Employees (por location):**
- 8 Chefs @ €18/hour
- 12 Servers @ €12/hour
- 5 Bartenders @ €14/hour
- 3 Hosts @ €11/hour
- 2 Managers @ €25/hour
- Total: 30 employees × 3 locations = 90 empleados

**Sales patterns:**
```
Weekend (Fri-Sun): €18,000/día base
Mid-week (Tue-Wed): €10,000/día (dip)
Regular (Mon-Thu): €13,000/día
```

**Labour patterns (coherente con sales):**
```
COL% Target: 28%
COL% Actual: 30% (realista - ligeramente sobre target)
SPLH Target: €75/hour
Hours/día: Sales × 0.30 / €14.50 avg wage
```

**Operating hours:**
- 10:00 - 23:00 (13 horas)
- Lunch peak: 12:00-15:00 (40% de daily sales)
- Dinner peak: 19:00-22:00 (45% de daily sales)

## 🔌 Opción 2: Datos Reales de POS

### **Flujo de integración:**

```typescript
// 1. Usuario conecta POS desde /settings/integrations
await supabase.functions.invoke('square-oauth-start', {
  body: { locationId: 'uuid-here' }
});

// 2. Webhook recibe tickets en tiempo real
// POST /functions/v1/square-webhook
{
  "event": "payment.created",
  "data": { /* ticket data */ }
}

// 3. Normalizer procesa y guarda en facts_sales_15m
await supabase.functions.invoke('cdm-normalizer', {
  body: { ticket, source: 'square' }
});

// 4. Sistema calcula labour automáticamente
// Cron job cada hora: aggregate sales → calculate labour needs
```

### **Tablas que se populan automáticamente:**
- ✅ `facts_sales_15m` - desde webhooks POS
- ✅ `tickets` & `ticket_lines` - raw data del POS
- ✅ `facts_item_mix_daily` - agregado de ticket_lines
- ⚠️ `facts_labor_daily` - requiere integración HR/Scheduling
- ⚠️ `employees` - requiere import manual o integración HR

## 🔄 Switchear entre Demo y Real

### **Demo Mode (default):**
```typescript
// En useLabourData.ts, useSalesData.ts, etc.
const { data } = useSalesData({ 
  locationIds, 
  startDate, 
  endDate 
});

// Si no hay datos reales en DB → auto-genera mock data
if (!data || data.length === 0) {
  return generateMockData(startDate, endDate);
}
```

### **Production Mode (con POS conectado):**
```typescript
// Mismo código - detecta automáticamente si hay datos reales
const { data } = useSalesData({ locationIds, startDate, endDate });
// Si hay datos en facts_sales_15m → los usa
// Si no hay datos → genera mock
```

### **Flag de modo (opcional):**
```typescript
// Agregar en .env para forzar modo:
VITE_DEMO_MODE=true  // Siempre usa mock data
VITE_DEMO_MODE=false // Solo usa datos reales (error si no hay)
```

## 📈 Relaciones de Datos (coherencia)

### **Sales → Labour:**
```
Labour Hours = Sales × COL% Target / Avg Hourly Wage
COL% Actual = (Labour Hours × Avg Wage) / Sales × 100
SPLH = Sales / Labour Hours
```

### **Sales → Products:**
```
Product Sales = Total Sales × Product Mix %
Top products: Paella (12%), Jamón (6%), Chuletón (5%)
Food/Beverage ratio: 95% / 5%
```

### **Labour → Roles:**
```
Chefs: 26% de labour hours (cocina)
Servers: 40% de labour hours (sala)
Bartenders: 17% de labour hours (bar)
Hosts: 10% de labour hours (entrada)
Managers: 7% de labour hours (gestión)
```

## 🛠️ Comandos Útiles

### **Regenerar datos demo:**
```sql
-- Desde Supabase SQL Editor:
SELECT * FROM seed_josephine_demo_data();
```

### **Limpiar datos demo:**
```sql
DELETE FROM facts_sales_15m WHERE location_id IN (
  SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
```

### **Verificar datos:**
```sql
-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM facts_sales_15m) as sales_records,
  (SELECT COUNT(*) FROM facts_labor_daily) as labour_records,
  (SELECT COUNT(*) FROM locations) as locations,
  (SELECT COUNT(*) FROM employees) as employees;

-- Ver sales por día
SELECT 
  DATE(ts_bucket) as day,
  location_id,
  SUM(sales_net) as daily_sales,
  SUM(tickets) as tickets,
  SUM(covers) as covers
FROM facts_sales_15m
GROUP BY DATE(ts_bucket), location_id
ORDER BY day DESC
LIMIT 21; -- últimos 7 días × 3 locations
```

## 📋 Checklist para Demo

- [ ] Ejecutar `seed_josephine_demo_data()`
- [ ] Verificar Sales module muestra datos (€36k+)
- [ ] Verificar Labour module muestra COL% (~28-30%)
- [ ] Verificar gráficos tienen 7+ días de data
- [ ] Verificar 3 locations aparecen en selectors
- [ ] Verificar drill-down por hora funciona
- [ ] Verificar Ask Josephine responde con contexto real
- [ ] Verificar Products list muestra top items
- [ ] Verificar Labour by Role muestra 5 roles

## 🎬 Para Presentación a Inversores

### **Script recomendado:**

1. **Sales Module:**
   - "Aquí vemos €36k en ventas esta semana"
   - "Miércoles tuvo un dip de -15% (mid-week normal)"
   - Click en miércoles → "Pueden ver breakdown por hora"
   - "Ask Josephine" → "¿Por qué bajaron ventas el miércoles?"

2. **Labour Module:**
   - "COL% está al 30%, ligeramente sobre nuestro target de 28%"
   - "SPLH está en €75/hour - buena productividad"
   - Labour by Role → "Los Chefs representan 26% del labour"
   - Click en día → "Drill-down muestra que el peak hour es 20:00"

3. **Location Selector:**
   - Cambiar entre locations → "Cada ubicación tiene métricas únicas"
   - "Salamanca tiene ticket promedio más alto: €26 vs €22 en Malasaña"

4. **Date Range:**
   - Cambiar a "Month" → "Sistema maneja cualquier rango"
   - "Datos históricos para análisis de tendencias"

## 🔐 Datos Reales - Production Checklist

Cuando esté listo para usar datos reales de POS:

- [ ] Conectar POS desde `/settings/integrations`
- [ ] Configurar webhooks del POS provider
- [ ] Verificar que `square-webhook` o `toast-webhook` funciona
- [ ] Ejecutar sync inicial (últimos 30 días)
- [ ] Verificar datos aparecen en facts_sales_15m
- [ ] Desactivar demo mode (opcional)
- [ ] Configurar cron jobs para agregaciones
- [ ] Conectar HR system para labour data real

## 📞 Soporte

Si algo no funciona:
1. Verificar que locations existen: `SELECT * FROM locations;`
2. Verificar que hay sales data: `SELECT COUNT(*) FROM facts_sales_15m;`
3. Regenerar demo data: `SELECT * FROM seed_josephine_demo_data();`
4. Revisar logs de edge functions en Supabase dashboard

---

**Recuerda:** El sistema está diseñado para funcionar con datos reales Y demos. 
Los hooks detectan automáticamente si hay datos y adaptan su comportamiento.
