import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Forecast Audit Edge Function
 * 
 * Returns audit metrics for each location:
 * - Historical P50/P90 daily sales (last 365 days)
 * - Forecast min/avg/max for next 30 days
 * - Count of days clamped due to sanity checks
 * - MAPE, MSE, Confidence from last model run
 * - Warning flags if forecast seems unrealistic
 */

interface AuditResult {
  location_id: string;
  location_name: string;
  historical: {
    days_with_data: number;
    p50_daily_sales: number;
    p90_daily_sales: number;
    avg_daily_sales: number;
    max_daily_sales: number;
  };
  forecast_next_30d: {
    min: number;
    avg: number;
    max: number;
    days_count: number;
  };
  model: {
    version: string;
    mape_percent: number;
    mse: number;
    confidence: number;
    generated_at: string | null;
  };
  warnings: string[];
  status: 'healthy' | 'warning' | 'critical';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id; // Optional: audit single location

    console.log(`[AUDIT] Starting forecast audit for ${locationId || 'all locations'}`);

    // Get locations to audit
    let locationsQuery = supabase.from("locations").select("id, name");
    if (locationId) {
      locationsQuery = locationsQuery.eq("id", locationId);
    }
    const { data: locations, error: locError } = await locationsQuery;

    if (locError || !locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No locations found", details: locError?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toISOString().split("T")[0];

    const next30d = new Date(today);
    next30d.setDate(next30d.getDate() + 30);
    const next30dStr = next30d.toISOString().split("T")[0];

    const results: AuditResult[] = [];

    for (const location of locations) {
      console.log(`[AUDIT] Processing ${location.name}...`);
      const warnings: string[] = [];

      // ============================================
      // 1. Fetch historical daily sales (last 365 days)
      // ============================================
      const { data: ticketData } = await supabase
        .from("tickets")
        .select("opened_at, net_total")
        .eq("location_id", location.id)
        .gte("opened_at", yearAgoStr)
        .lt("opened_at", todayStr);

      // Aggregate by date
      const dailySales: Record<string, number> = {};
      (ticketData || []).forEach((t: any) => {
        const dateStr = new Date(t.opened_at).toISOString().split("T")[0];
        dailySales[dateStr] = (dailySales[dateStr] || 0) + (Number(t.net_total) || 0);
      });

      const salesValues = Object.values(dailySales).sort((a, b) => a - b);
      const daysWithData = salesValues.length;

      // Calculate percentiles
      const p50 = daysWithData > 0 ? salesValues[Math.floor(daysWithData * 0.5)] : 0;
      const p90 = daysWithData > 0 ? salesValues[Math.floor(daysWithData * 0.9)] : 0;
      const avgSales = daysWithData > 0 ? salesValues.reduce((a, b) => a + b, 0) / daysWithData : 0;
      const maxSales = daysWithData > 0 ? salesValues[daysWithData - 1] : 0;

      // ============================================
      // 2. Fetch forecast for next 30 days
      // ============================================
      const { data: forecastData } = await supabase
        .from("forecast_daily_metrics")
        .select("date, forecast_sales, model_version, mape, mse, confidence, generated_at")
        .eq("location_id", location.id)
        .gte("date", todayStr)
        .lte("date", next30dStr)
        .order("date");

      const forecasts = (forecastData || []).map((f: any) => Number(f.forecast_sales) || 0);
      const forecastCount = forecasts.length;
      const forecastMin = forecastCount > 0 ? Math.min(...forecasts) : 0;
      const forecastMax = forecastCount > 0 ? Math.max(...forecasts) : 0;
      const forecastAvg = forecastCount > 0 ? forecasts.reduce((a, b) => a + b, 0) / forecastCount : 0;

      // Get model info from first forecast row
      const modelVersion = forecastData?.[0]?.model_version || "unknown";
      const mape = Number(forecastData?.[0]?.mape) || 0;
      const mse = Number(forecastData?.[0]?.mse) || 0;
      const confidence = Number(forecastData?.[0]?.confidence) || 0;
      const generatedAt = forecastData?.[0]?.generated_at || null;

      // ============================================
      // 3. Sanity checks and warnings
      // ============================================
      
      // Check: No forecast data
      if (forecastCount === 0) {
        warnings.push("NO_FORECAST_DATA: No forecast found for next 30 days");
      } else if (forecastCount < 30) {
        warnings.push(`INCOMPLETE_FORECAST: Only ${forecastCount}/30 days forecasted`);
      }

      // Check: No historical data
      if (daysWithData === 0) {
        warnings.push("NO_HISTORICAL_DATA: No sales data in last 365 days");
      } else if (daysWithData < 30) {
        warnings.push(`LOW_HISTORY: Only ${daysWithData} days of historical data`);
      }

      // Check: Forecast exceeds 3x P90 (unrealistic)
      if (p90 > 0 && forecastMax > 3 * p90) {
        warnings.push(`FORECAST_TOO_HIGH: Max forecast €${forecastMax.toFixed(0)} > 3x P90 €${(3 * p90).toFixed(0)}`);
      }

      // Check: Forecast is below P50 (might be too conservative)
      if (p50 > 0 && forecastAvg < p50 * 0.5) {
        warnings.push(`FORECAST_TOO_LOW: Avg forecast €${forecastAvg.toFixed(0)} < 50% of P50 €${(p50 * 0.5).toFixed(0)}`);
      }

      // Check: Low confidence
      if (confidence < 50) {
        warnings.push(`LOW_CONFIDENCE: Model confidence is ${confidence}%`);
      }

      // Check: High MAPE
      if (mape > 0.3) {
        warnings.push(`HIGH_MAPE: Model error rate is ${(mape * 100).toFixed(1)}%`);
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (warnings.some(w => w.startsWith('NO_FORECAST') || w.startsWith('NO_HISTORICAL') || w.startsWith('FORECAST_TOO_HIGH'))) {
        status = 'critical';
      } else if (warnings.length > 0) {
        status = 'warning';
      }

      results.push({
        location_id: location.id,
        location_name: location.name,
        historical: {
          days_with_data: daysWithData,
          p50_daily_sales: Math.round(p50),
          p90_daily_sales: Math.round(p90),
          avg_daily_sales: Math.round(avgSales),
          max_daily_sales: Math.round(maxSales),
        },
        forecast_next_30d: {
          min: Math.round(forecastMin),
          avg: Math.round(forecastAvg),
          max: Math.round(forecastMax),
          days_count: forecastCount,
        },
        model: {
          version: modelVersion,
          mape_percent: Math.round(mape * 1000) / 10,
          mse: Math.round(mse),
          confidence: Math.round(confidence),
          generated_at: generatedAt,
        },
        warnings,
        status,
      });

      console.log(`[AUDIT] ${location.name}: ${status.toUpperCase()} - ${warnings.length} warnings`);
    }

    // Summary stats
    const summary = {
      total_locations: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      critical: results.filter(r => r.status === 'critical').length,
      all_warnings: results.flatMap(r => r.warnings.map(w => ({ location: r.location_name, warning: w }))),
    };

    return new Response(
      JSON.stringify({
        success: true,
        audit_date: todayStr,
        summary,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AUDIT] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
