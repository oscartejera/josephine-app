

# Plan: Motor de AI Sales Forecasting con Gemini

## Resumen

Potenciaremos el sistema de forecasting existente (LR_SI_MONTH_v3) con inteligencia artificial de Gemini para generar predicciones por hora más precisas y explicables. El sistema usará el histórico de tickets, patrones de día de semana, tendencias y factores contextuales para predecir ventas con mayor granularidad.

---

## Arquitectura Propuesta

```text
+---------------------+     +------------------------+     +----------------------+
|   tickets (history) |---->|                        |     |                      |
|   - opened_at       |     |   AI FORECAST ENGINE   |---->| forecast_hourly_     |
|   - net_total       |     |   (Edge Function +     |     | metrics (NEW)        |
|   - covers          |     |    Gemini AI)          |     +----------------------+
+---------------------+     |                        |              |
                            |   1. Aggregate history |              v
+---------------------+     |   2. Detect patterns   |     +----------------------+
|   forecast_daily_   |---->|   3. AI enhancement    |     |   Dashboard          |
|   metrics (existing)|     |   4. Hourly breakdown  |---->|   - Hourly chart     |
+---------------------+     +------------------------+     |   - AI confidence    |
                                                           +----------------------+
                                                                    |
                                                                    v
                                                           +----------------------+
                                                           |   Scheduling         |
                                                           |   - Demand preview   |
                                                           |   - Staff suggestion |
                                                           +----------------------+
```

---

## Componentes a Crear/Modificar

### 1. Nueva Tabla: `forecast_hourly_metrics`

Almacenará las predicciones por hora generadas por IA:

```sql
CREATE TABLE forecast_hourly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  forecast_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  forecast_covers INTEGER NOT NULL DEFAULT 0,
  forecast_orders INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  factors JSONB,  -- {"day_of_week": 0.15, "trend": 0.08, "seasonality": -0.05}
  model_version TEXT DEFAULT 'AI_HOURLY_v1',
  generated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(location_id, date, hour)
);
```

### 2. Edge Function: `ai_forecast_hourly`

Nueva función que usa Gemini para analizar patrones y generar predicciones horarias inteligentes:

**Flujo:**
1. Consultar histórico de ventas por hora (últimos 56 días)
2. Agrupar por día de semana y hora
3. Calcular patrones base (media, percentiles)
4. Enviar contexto a Gemini para:
   - Detectar tendencias no lineales
   - Sugerir ajustes por factores externos
   - Explicar la predicción
5. Generar predicciones horarias para los próximos 14 días
6. Guardar en `forecast_hourly_metrics`

**Endpoint:** `POST /functions/v1/ai_forecast_hourly`
```json
{
  "location_id": "uuid",
  "forecast_days": 14
}
```

### 3. Componente: `HourlyForecastChart`

Nuevo gráfico para el Dashboard que muestre:
- Barras: Ventas reales por hora (si es hoy o histórico)
- Línea: Forecast por hora (de AI)
- Badge: Confianza del modelo (%)
- Tooltip: Factores que influyen en cada hora

### 4. Componente: `ForecastConfidencePanel`

Panel que explica la predicción de IA:
- Confianza general del modelo
- Factores principales detectados
- Comparación vs semana anterior
- Alertas si hay anomalías

### 5. Integración en Dashboard

- Reemplazar datos mock de `hourlySales` con datos reales de `forecast_hourly_metrics`
- Añadir badge de confianza al título del gráfico
- Mostrar tooltip con factores de IA

### 6. Integración en Scheduling

- Mostrar preview de demanda horaria al crear turnos
- Sugerir horas pico para asignar más personal
- Calcular staffing recomendado por hora

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/ai_forecast_hourly/index.ts` | Edge Function con Gemini |
| `src/hooks/useHourlyForecast.ts` | Hook para consultar predicciones |
| `src/components/dashboard/HourlyForecastChart.tsx` | Gráfico mejorado |
| `src/components/dashboard/ForecastConfidencePanel.tsx` | Panel de confianza |
| `src/components/scheduling/DemandPreviewPanel.tsx` | Preview de demanda |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Dashboard.tsx` | Integrar nuevo gráfico y panel |
| `src/pages/Scheduling.tsx` | Añadir preview de demanda |
| `src/components/scheduling/CreateShiftDialog.tsx` | Mostrar demanda esperada |
| `supabase/config.toml` | Registrar nueva función |

---

## Sección Técnica

### Estructura del Edge Function

```typescript
// ai_forecast_hourly/index.ts
// 1. Fetch 56 days of hourly sales data
// 2. Aggregate by day_of_week + hour
// 3. Calculate statistical baselines (P25, P50, P75)
// 4. Build prompt for Gemini with context
// 5. Parse AI response for adjustments
// 6. Generate hourly forecasts with factors
// 7. Upsert to forecast_hourly_metrics
```

### Prompt de Gemini (ejemplo)

```text
Eres un analista de restaurantes. Analiza estos datos de ventas por hora:

PATRONES HISTÓRICOS (últimos 56 días):
- Lunes 12:00: Media €320, P75 €380, P25 €260
- Lunes 13:00: Media €450, P75 €520, P25 €390
...

CONTEXTO:
- Fecha objetivo: 2026-01-27 (Lunes)
- Tendencia 28d: +5% vs periodo anterior
- Última semana: -2% vs forecast

TAREA:
Genera predicciones horarias para cada hora del servicio (10:00-23:00).
Para cada hora, indica:
1. forecast_sales: ventas esperadas en €
2. confidence: 0-100
3. factors: {"trend": X, "day_pattern": Y, "recent_performance": Z}

Responde en JSON válido.
```

### Llamada a Lovable AI Gateway

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: FORECAST_SYSTEM_PROMPT },
      { role: "user", content: buildForecastPrompt(historicalData, targetDate) }
    ],
    tools: [{
      type: "function",
      function: {
        name: "generate_hourly_forecast",
        parameters: {
          type: "object",
          properties: {
            forecasts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  hour: { type: "integer" },
                  forecast_sales: { type: "number" },
                  forecast_covers: { type: "integer" },
                  confidence: { type: "integer" },
                  factors: { type: "object" }
                },
                required: ["hour", "forecast_sales", "confidence"]
              }
            }
          },
          required: ["forecasts"]
        }
      }
    }],
    tool_choice: { type: "function", function: { name: "generate_hourly_forecast" } }
  }),
});
```

### Hook useHourlyForecast

```typescript
export function useHourlyForecast(locationId: string, date: Date) {
  return useQuery({
    queryKey: ['hourly-forecast', locationId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase
        .from('forecast_hourly_metrics')
        .select('*')
        .eq('location_id', locationId)
        .eq('date', format(date, 'yyyy-MM-dd'))
        .order('hour');
      
      return data || [];
    }
  });
}
```

---

## Integración Visual

### Dashboard - Gráfico Horario Mejorado

El nuevo `HourlyForecastChart` mostrará:
- Eje X: Horas (10:00 - 23:00)
- Eje Y: Ventas en €
- Barras azules: Ventas reales (si disponibles)
- Línea punteada: Forecast de IA
- Área sombreada: Rango de confianza (P25-P75)
- Badge superior: "AI Forecast • 78% confidence"

### Dashboard - Panel de Confianza

Sidebar o card adicional con:
- Confianza del modelo: 78%
- Principales factores detectados:
  - "Lunes típicamente +12% vs media"
  - "Tendencia semanal: +5%"
  - "Clima favorable (si se integra API)"
- Comparación: "Forecast vs Real ayer: -3%"

### Scheduling - Preview de Demanda

Al crear un turno o al ver la semana:
- Mini-gráfico de barras por hora mostrando demanda esperada
- Colores: Verde (baja), Amarillo (media), Rojo (alta)
- Sugerencia: "Peak 13:00-14:00: considera +1 FOH"

---

## Fases de Implementación

### Fase 1: Infraestructura (Este PR)
1. Crear tabla `forecast_hourly_metrics`
2. Crear Edge Function `ai_forecast_hourly` con Gemini
3. Crear hook `useHourlyForecast`
4. Integrar gráfico básico en Dashboard

### Fase 2: Mejoras Visuales
5. Crear `ForecastConfidencePanel` en Dashboard
6. Añadir `DemandPreviewPanel` en Scheduling
7. Integrar sugerencias de staffing

### Fase 3: Automatización
8. Trigger automático cada madrugada para regenerar forecasts
9. Alertas si forecast diverge significativamente de realidad
10. Histórico de precisión del modelo

---

## Consideraciones

- **Rate Limits**: La función usará Gemini Flash (más económico) y se ejecutará máximo 1x/día por location
- **Fallback**: Si Gemini falla, usar distribución de `HOURLY_WEIGHTS` sobre `forecast_daily_metrics`
- **Caching**: Los forecasts se almacenan en DB, no se regeneran en cada request
- **Permisos**: Solo usuarios con `insights.view` pueden ver el panel de confianza

