import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Forecast Audit Edge Function v2
 * 
 * Improvements:
 * - Compares each location against ITS OWN historical data (not global)
 * - Better status classification (not everything is "critical")
 * - New flags for data quality vs forecast quality issues
 * - Model tier awareness
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
    data_quality: 'excellent' | 'good' | 'limited' | 'insufficient';
  };
  forecast_next_30d: {
    min: number;
    avg: number;
    max: number;
    days_count: number;
    within_historical_range: boolean;
  };
  model: {
    version: string;
    tier: string;
    mape_percent: number;
    mse: number;
    confidence: number;
    generated_at: string | null;
  };
  warnings: string[];
  status: 'healthy' | 'warning' | 'needs_attention';
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
    const locationId = body.location_id;

    console.log(`[AUDIT v2] Starting forecast audit for ${locationId || 'all locations'}`);

    // Get ACTIVE locations only
    let locationsQuery = supabase.from("locations").select("id, name").eq("active", true);
    if (locationId) {
      locationsQuery = supabase.from("locations").select("id, name").eq("id", locationId);
    }
    const { data: locations, error: locError } = await locationsQuery;

    if (locError || !locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active locations found", details: locError?.message }),
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
      console.log(`[AUDIT v2] Processing ${location.name}...`);
      const warnings: string[] = [];

      // ============================================
      // 1. Fetch historical daily sales (ALL history, paginated)
      // ============================================
      const dailySales: Record<string, number> = {};
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: ticketBatch } = await supabase
          .from("tickets")
          .select("opened_at, net_total")
          .eq("location_id", location.id)
          .order("opened_at")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (!ticketBatch || ticketBatch.length === 0) {
          hasMore = false;
        } else {
          ticketBatch.forEach((t: any) => {
            const dateStr = new Date(t.opened_at).toISOString().split("T")[0];
            dailySales[dateStr] = (dailySales[dateStr] || 0) + (Number(t.net_total) || 0);
          });
          hasMore = ticketBatch.length === pageSize;
          page++;
        }
      }

      const salesValues = Object.values(dailySales).filter(v => v > 0).sort((a, b) => a - b);
      const daysWithData = salesValues.length;

      // Calculate percentiles for THIS location (daily aggregated values)
      const p50 = daysWithData > 0 ? salesValues[Math.floor(daysWithData * 0.5)] : 0;
      const p90 = daysWithData > 0 ? salesValues[Math.floor(daysWithData * 0.9)] : 0;
      const avgSales = daysWithData > 0 ? salesValues.reduce((a, b) => a + b, 0) / daysWithData : 0;
      const maxSales = daysWithData > 0 ? salesValues[daysWithData - 1] : 0;

      console.log(`[AUDIT v2] ${location.name}: ${daysWithData} days, P50=€${p50.toFixed(0)}, P90=€${p90.toFixed(0)}, Avg=€${avgSales.toFixed(0)}`);

      // Classify data quality
      let dataQuality: 'excellent' | 'good' | 'limited' | 'insufficient';
      if (daysWithData >= 365) dataQuality = 'excellent';
      else if (daysWithData >= 90) dataQuality = 'good';
      else if (daysWithData >= 30) dataQuality = 'limited';
      else dataQuality = 'insufficient';

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

      // Check if forecast is within historical range
      const withinRange = daysWithData > 0 && 
        forecastAvg >= p50 * 0.5 && 
        forecastAvg <= p90 * 2;

      // Get model info
      const modelVersion = forecastData?.[0]?.model_version || "unknown";
      const mape = Number(forecastData?.[0]?.mape) || 0;
      const mse = Number(forecastData?.[0]?.mse) || 0;
      const confidence = Number(forecastData?.[0]?.confidence) || 0;
      const generatedAt = forecastData?.[0]?.generated_at || null;

      // Determine model tier from version
      let modelTier = "unknown";
      if (modelVersion.includes("AVG")) modelTier = "simple_average";
      else if (modelVersion.includes("WEEKLY")) modelTier = "trend_weekly";
      else if (modelVersion.includes("MONTH")) modelTier = "trend_monthly";

      // ============================================
      // 3. Generate warnings based on THIS location's data
      // ============================================
      
      // Data quality warnings
      if (daysWithData === 0) {
        warnings.push("NO_HISTORY: No sales data in last 365 days");
      } else if (daysWithData < 30) {
        warnings.push(`LIMITED_HISTORY: Only ${daysWithData} days of data`);
      } else if (daysWithData < 90) {
        warnings.push(`GROWING_HISTORY: ${daysWithData} days (model improving)`);
      }

      // Forecast quality warnings
      if (forecastCount === 0) {
        warnings.push("NO_FORECAST: Run generate_forecast to create predictions");
      } else if (forecastCount < 30) {
        warnings.push(`INCOMPLETE_FORECAST: Only ${forecastCount}/30 days`);
      }

      // Range checks (only if we have both data and forecast)
      if (daysWithData > 0 && forecastCount > 0) {
        if (forecastAvg > p90 * 2) {
          warnings.push(`HIGH_FORECAST: Avg €${forecastAvg.toFixed(0)} > 2x P90 €${(p90 * 2).toFixed(0)}`);
        } else if (forecastAvg < p50 * 0.5 && p50 > 0) {
          warnings.push(`LOW_FORECAST: Avg €${forecastAvg.toFixed(0)} < 50% of P50 €${(p50 * 0.5).toFixed(0)}`);
        }

        if (confidence < 50 && dataQuality !== 'insufficient') {
          warnings.push(`LOW_CONFIDENCE: ${confidence}% (expected higher with ${daysWithData} days)`);
        }

        if (mape > 0.3) {
          warnings.push(`HIGH_ERROR: MAPE ${(mape * 100).toFixed(1)}% may indicate volatility`);
        }
      }

      // ============================================
      // 4. Determine status
      // ============================================
      let status: 'healthy' | 'warning' | 'needs_attention' = 'healthy';
      
      if (warnings.some(w => w.startsWith('NO_FORECAST') || w.startsWith('NO_HISTORY'))) {
        status = 'needs_attention';
      } else if (warnings.some(w => 
        w.startsWith('HIGH_FORECAST') || 
        w.startsWith('LOW_FORECAST') ||
        w.startsWith('LOW_CONFIDENCE') ||
        w.startsWith('HIGH_ERROR')
      )) {
        status = 'warning';
      } else if (warnings.some(w => 
        w.startsWith('LIMITED_HISTORY') ||
        w.startsWith('GROWING_HISTORY') ||
        w.startsWith('INCOMPLETE_FORECAST')
      )) {
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
          data_quality: dataQuality,
        },
        forecast_next_30d: {
          min: Math.round(forecastMin),
          avg: Math.round(forecastAvg),
          max: Math.round(forecastMax),
          days_count: forecastCount,
          within_historical_range: withinRange,
        },
        model: {
          version: modelVersion,
          tier: modelTier,
          mape_percent: Math.round(mape * 1000) / 10,
          mse: Math.round(mse),
          confidence: Math.round(confidence),
          generated_at: generatedAt,
        },
        warnings,
        status,
      });

      console.log(`[AUDIT v2] ${location.name}: ${status.toUpperCase()} - ${warnings.length} warnings`);
    }

    // Summary
    const summary = {
      total_locations: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      needs_attention: results.filter(r => r.status === 'needs_attention').length,
      data_quality_breakdown: {
        excellent: results.filter(r => r.historical.data_quality === 'excellent').length,
        good: results.filter(r => r.historical.data_quality === 'good').length,
        limited: results.filter(r => r.historical.data_quality === 'limited').length,
        insufficient: results.filter(r => r.historical.data_quality === 'insufficient').length,
      },
      all_warnings: results.flatMap(r => r.warnings.map(w => ({ 
        location: r.location_name, 
        warning: w,
        status: r.status
      }))),
    };

    return new Response(
      JSON.stringify({
        success: true,
        audit_date: todayStr,
        version: "v2",
        summary,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AUDIT v2] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
