import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Service hours for restaurant (10:00 - 23:00)
const SERVICE_HOURS = Array.from({ length: 14 }, (_, i) => i + 10);

// Hourly weight distribution for fallback (peak at lunch 13-14 and dinner 21-22)
const HOURLY_WEIGHTS: Record<number, number> = {
  10: 0.03, 11: 0.05, 12: 0.08, 13: 0.12, 14: 0.11, 15: 0.06,
  16: 0.04, 17: 0.05, 18: 0.07, 19: 0.09, 20: 0.11, 21: 0.10, 22: 0.07, 23: 0.02
};

interface HourlyPattern {
  hour: number;
  dayOfWeek: number;
  avgSales: number;
  avgCovers: number;
  avgOrders: number;
  p25: number;
  p75: number;
  dataPoints: number;
}

interface ForecastResult {
  hour: number;
  forecast_sales: number;
  forecast_covers: number;
  forecast_orders: number;
  confidence: number;
  factors: Record<string, number>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location_id, forecast_days = 14 } = await req.json();

    if (!location_id) {
      return new Response(
        JSON.stringify({ error: "location_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch 56 days of historical ticket data
    const historyDays = 56;
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - historyDays);

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("opened_at, net_total, covers")
      .eq("location_id", location_id)
      .eq("status", "closed")
      .gte("opened_at", historyStart.toISOString())
      .order("opened_at", { ascending: true });

    if (ticketsError) {
      console.error("Error fetching tickets:", ticketsError);
      throw new Error(`Failed to fetch tickets: ${ticketsError.message}`);
    }

    // 2. Aggregate by day of week and hour
    const patterns = aggregateHourlyPatterns(tickets || []);
    
    // 3. Calculate overall trends
    const trend28d = calculateTrend(tickets || [], 28);
    const trend7d = calculateTrend(tickets || [], 7);

    // 4. Get daily forecast for baseline (if available)
    const forecastStart = new Date();
    const forecastEnd = new Date();
    forecastEnd.setDate(forecastEnd.getDate() + forecast_days);

    const { data: dailyForecasts } = await supabase
      .from("forecast_daily_metrics")
      .select("date, forecast_sales, forecast_orders")
      .eq("location_id", location_id)
      .gte("date", forecastStart.toISOString().split("T")[0])
      .lte("date", forecastEnd.toISOString().split("T")[0]);

    // 5. Generate hourly forecasts
    let hourlyForecasts: Array<{
      location_id: string;
      date: string;
      hour: number;
      forecast_sales: number;
      forecast_covers: number;
      forecast_orders: number;
      confidence: number;
      factors: Record<string, number>;
      model_version: string;
    }> = [];

    // Try AI-enhanced forecasting first
    if (lovableApiKey && patterns.length > 0) {
      try {
        const aiForecasts = await generateAIForecasts(
          lovableApiKey,
          patterns,
          trend28d,
          trend7d,
          forecast_days,
          dailyForecasts || []
        );
        
        // Map AI results to DB format
        for (let d = 0; d < forecast_days; d++) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + d);
          const dateStr = targetDate.toISOString().split("T")[0];
          const dayOfWeek = targetDate.getDay();

          const dayForecasts = aiForecasts.filter(f => f.dayOfWeek === dayOfWeek);
          
          for (const forecast of dayForecasts) {
            hourlyForecasts.push({
              location_id,
              date: dateStr,
              hour: forecast.hour,
              forecast_sales: forecast.forecast_sales,
              forecast_covers: forecast.forecast_covers,
              forecast_orders: forecast.forecast_orders,
              confidence: forecast.confidence,
              factors: forecast.factors,
              model_version: "AI_HOURLY_v1",
            });
          }
        }
      } catch (aiError) {
        console.error("AI forecasting failed, using fallback:", aiError);
        hourlyForecasts = generateFallbackForecasts(
          location_id,
          patterns,
          dailyForecasts || [],
          forecast_days,
          trend28d
        );
      }
    } else {
      // Fallback to statistical method
      hourlyForecasts = generateFallbackForecasts(
        location_id,
        patterns,
        dailyForecasts || [],
        forecast_days,
        trend28d
      );
    }

    // 6. Upsert forecasts to database
    if (hourlyForecasts.length > 0) {
      const { error: upsertError } = await supabase
        .from("forecast_hourly_metrics")
        .upsert(hourlyForecasts, {
          onConflict: "location_id,date,hour",
        });

      if (upsertError) {
        console.error("Error upserting forecasts:", upsertError);
        throw new Error(`Failed to save forecasts: ${upsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        forecasts_generated: hourlyForecasts.length,
        days: forecast_days,
        model: hourlyForecasts[0]?.model_version || "FALLBACK",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai_forecast_hourly error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function aggregateHourlyPatterns(tickets: Array<{ opened_at: string; net_total: number; covers: number }>): HourlyPattern[] {
  const buckets: Map<string, number[]> = new Map();
  const coverBuckets: Map<string, number[]> = new Map();

  for (const ticket of tickets) {
    const date = new Date(ticket.opened_at);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    
    if (hour < 10 || hour > 23) continue;

    const key = `${dayOfWeek}-${hour}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      coverBuckets.set(key, []);
    }
    buckets.get(key)!.push(Number(ticket.net_total) || 0);
    coverBuckets.get(key)!.push(Number(ticket.covers) || 0);
  }

  const patterns: HourlyPattern[] = [];
  
  for (const [key, sales] of buckets) {
    const [dow, hour] = key.split("-").map(Number);
    const covers = coverBuckets.get(key) || [];
    
    const sortedSales = [...sales].sort((a, b) => a - b);
    const p25Idx = Math.floor(sortedSales.length * 0.25);
    const p75Idx = Math.floor(sortedSales.length * 0.75);

    patterns.push({
      hour,
      dayOfWeek: dow,
      avgSales: sales.reduce((a, b) => a + b, 0) / sales.length,
      avgCovers: covers.reduce((a, b) => a + b, 0) / covers.length,
      avgOrders: sales.length / 8, // ~8 weeks of data
      p25: sortedSales[p25Idx] || 0,
      p75: sortedSales[p75Idx] || 0,
      dataPoints: sales.length,
    });
  }

  return patterns;
}

function calculateTrend(tickets: Array<{ opened_at: string; net_total: number }>, days: number): number {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const previousCutoff = new Date();
  previousCutoff.setDate(previousCutoff.getDate() - days * 2);

  let currentTotal = 0;
  let previousTotal = 0;

  for (const ticket of tickets) {
    const date = new Date(ticket.opened_at);
    const amount = Number(ticket.net_total) || 0;
    
    if (date >= cutoff && date <= now) {
      currentTotal += amount;
    } else if (date >= previousCutoff && date < cutoff) {
      previousTotal += amount;
    }
  }

  if (previousTotal === 0) return 0;
  return ((currentTotal - previousTotal) / previousTotal) * 100;
}

async function generateAIForecasts(
  apiKey: string,
  patterns: HourlyPattern[],
  trend28d: number,
  trend7d: number,
  forecastDays: number,
  dailyForecasts: Array<{ date: string; forecast_sales: number; forecast_orders: number }>
): Promise<Array<ForecastResult & { dayOfWeek: number }>> {
  
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  
  // Build pattern summary for prompt
  const patternSummary = patterns
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
    .map(p => `${dayNames[p.dayOfWeek]} ${p.hour}:00: Media €${p.avgSales.toFixed(0)}, P75 €${p.p75.toFixed(0)}, P25 €${p.p25.toFixed(0)}, N=${p.dataPoints}`)
    .join("\n");

  const systemPrompt = `Eres un analista experto en forecasting de restaurantes. Tu tarea es generar predicciones de ventas por hora basándote en patrones históricos, tendencias y día de la semana.

REGLAS:
1. Mantén coherencia con los patrones históricos observados
2. Ajusta por tendencias recientes (trend_28d, trend_7d)
3. Respeta los picos típicos: almuerzo (13-14h) y cena (21-22h)
4. Asigna confianza baja (30-50) si hay pocos datos históricos
5. Asigna confianza alta (70-90) si los patrones son consistentes`;

  const userPrompt = `PATRONES HISTÓRICOS (últimos 56 días):
${patternSummary}

TENDENCIAS:
- Últimos 28 días vs anteriores: ${trend28d >= 0 ? "+" : ""}${trend28d.toFixed(1)}%
- Últimos 7 días vs anteriores: ${trend7d >= 0 ? "+" : ""}${trend7d.toFixed(1)}%

TAREA:
Genera predicciones horarias para cada día de la semana (0=Domingo a 6=Sábado), horas de servicio (10:00-23:00).
Para cada combinación día-hora, proporciona forecast_sales, forecast_covers, forecast_orders y confidence (0-100).`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_hourly_forecast",
            description: "Generate hourly sales forecasts for each day of the week",
            parameters: {
              type: "object",
              properties: {
                forecasts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      dayOfWeek: { type: "integer", description: "0=Sunday to 6=Saturday" },
                      hour: { type: "integer", description: "Hour of day (10-23)" },
                      forecast_sales: { type: "number", description: "Predicted sales in EUR" },
                      forecast_covers: { type: "integer", description: "Predicted number of covers" },
                      forecast_orders: { type: "integer", description: "Predicted number of orders" },
                      confidence: { type: "integer", description: "Confidence score 0-100" },
                      factors: {
                        type: "object",
                        properties: {
                          day_pattern: { type: "number" },
                          trend: { type: "number" },
                          hour_pattern: { type: "number" },
                        },
                      },
                    },
                    required: ["dayOfWeek", "hour", "forecast_sales", "confidence"],
                  },
                },
              },
              required: ["forecasts"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_hourly_forecast" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call response from AI");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return parsed.forecasts || [];
}

function generateFallbackForecasts(
  locationId: string,
  patterns: HourlyPattern[],
  dailyForecasts: Array<{ date: string; forecast_sales: number; forecast_orders: number }>,
  forecastDays: number,
  trend28d: number
): Array<{
  location_id: string;
  date: string;
  hour: number;
  forecast_sales: number;
  forecast_covers: number;
  forecast_orders: number;
  confidence: number;
  factors: Record<string, number>;
  model_version: string;
}> {
  const results: Array<{
    location_id: string;
    date: string;
    hour: number;
    forecast_sales: number;
    forecast_covers: number;
    forecast_orders: number;
    confidence: number;
    factors: Record<string, number>;
    model_version: string;
  }> = [];

  const patternMap = new Map<string, HourlyPattern>();
  for (const p of patterns) {
    patternMap.set(`${p.dayOfWeek}-${p.hour}`, p);
  }

  // Calculate average daily sales from patterns
  const avgDailySales = patterns.reduce((sum, p) => sum + p.avgSales, 0) / 7;

  for (let d = 0; d < forecastDays; d++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + d);
    const dateStr = targetDate.toISOString().split("T")[0];
    const dayOfWeek = targetDate.getDay();

    // Get daily forecast if available
    const dailyForecast = dailyForecasts.find(f => f.date === dateStr);
    const dailyTotal = dailyForecast?.forecast_sales || avgDailySales * (1 + trend28d / 100);

    for (const hour of SERVICE_HOURS) {
      const pattern = patternMap.get(`${dayOfWeek}-${hour}`);
      const weight = HOURLY_WEIGHTS[hour] || 0.05;

      // Distribute daily forecast using hourly weights
      let forecastSales = dailyTotal * weight;
      let confidence = 40;

      // If we have historical pattern, blend it
      if (pattern && pattern.dataPoints >= 3) {
        forecastSales = (forecastSales + pattern.avgSales * (1 + trend28d / 100)) / 2;
        confidence = Math.min(80, 40 + pattern.dataPoints * 3);
      }

      results.push({
        location_id: locationId,
        date: dateStr,
        hour,
        forecast_sales: Math.round(forecastSales * 100) / 100,
        forecast_covers: pattern ? Math.round(pattern.avgCovers) : Math.round(forecastSales / 25),
        forecast_orders: pattern ? Math.round(pattern.avgOrders) : Math.round(forecastSales / 40),
        confidence,
        factors: {
          day_pattern: pattern ? 0.4 : 0,
          trend: trend28d / 100,
          weight_distribution: weight,
        },
        model_version: "FALLBACK_v1",
      });
    }
  }

  return results;
}
