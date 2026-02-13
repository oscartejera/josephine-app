import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { computeTimeSeriesMetrics, type TimeSeriesMetrics } from "../_shared/regressors.ts";

/**
 * Forecast Audit Edge Function v3 — Time Series Enhanced
 *
 * Improvements over v2:
 * - Compares past forecasts vs actual sales (forecast monitoring)
 * - Computes MASE, directional accuracy, and forecast bias
 * - Detects forecast degradation over time
 * - Tracks confidence interval calibration (actual within CI?)
 * - Enhanced status with specific recommendations
 */

interface ForecastMonitoring {
  days_compared: number;
  metrics: TimeSeriesMetrics | null;
  bias_direction: 'over-forecasting' | 'under-forecasting' | 'balanced';
  mase_vs_naive: 'better' | 'worse' | 'similar';
  ci_coverage_pct: number; // % of actuals within forecast CI
  accuracy_trend: 'improving' | 'stable' | 'degrading';
}

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
  monitoring: ForecastMonitoring;
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

    console.log(`[AUDIT v3] Starting forecast audit for ${locationId || 'all locations'}`);

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
      console.log(`[AUDIT v3] Processing ${location.name}...`);
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

      console.log(`[AUDIT v3] ${location.name}: ${daysWithData} days, P50=€${p50.toFixed(0)}, P90=€${p90.toFixed(0)}, Avg=€${avgSales.toFixed(0)}`);

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
      // 3. Forecast Monitoring: compare past forecasts vs actuals
      // ============================================
      const monitoring: ForecastMonitoring = {
        days_compared: 0,
        metrics: null,
        bias_direction: 'balanced',
        mase_vs_naive: 'similar',
        ci_coverage_pct: 0,
        accuracy_trend: 'stable',
      };

      // Fetch past forecasts (last 30 days that already happened)
      const past30d = new Date(today);
      past30d.setDate(past30d.getDate() - 30);
      const past30dStr = past30d.toISOString().split("T")[0];

      const { data: pastForecasts } = await supabase
        .from("forecast_daily_metrics")
        .select("date, forecast_sales, forecast_sales_lower, forecast_sales_upper")
        .eq("location_id", location.id)
        .gte("date", past30dStr)
        .lt("date", todayStr)
        .order("date");

      if (pastForecasts && pastForecasts.length > 0 && daysWithData > 0) {
        // Match forecasts to actual sales
        const matched: { date: string; actual: number; forecast: number; lower: number; upper: number }[] = [];
        for (const pf of pastForecasts) {
          const actualSales = dailySales[pf.date];
          if (actualSales !== undefined && actualSales > 0) {
            matched.push({
              date: pf.date,
              actual: actualSales,
              forecast: Number(pf.forecast_sales) || 0,
              lower: Number(pf.forecast_sales_lower) || 0,
              upper: Number(pf.forecast_sales_upper) || 0,
            });
          }
        }

        if (matched.length >= 7) {
          const actuals = matched.map(m => m.actual);
          const predictions = matched.map(m => m.forecast);
          const historicalSeries = salesValues; // all historical daily values

          const metrics = computeTimeSeriesMetrics(actuals, predictions, historicalSeries);
          monitoring.days_compared = matched.length;
          monitoring.metrics = metrics;

          // Bias direction
          if (metrics.forecast_bias > actuals.reduce((a, b) => a + b, 0) / actuals.length * 0.05) {
            monitoring.bias_direction = 'under-forecasting';
          } else if (metrics.forecast_bias < -actuals.reduce((a, b) => a + b, 0) / actuals.length * 0.05) {
            monitoring.bias_direction = 'over-forecasting';
          }

          // MASE vs naive
          monitoring.mase_vs_naive = metrics.mase < 0.9 ? 'better' : metrics.mase > 1.1 ? 'worse' : 'similar';

          // CI coverage
          let withinCI = 0;
          for (const m of matched) {
            if (m.actual >= m.lower && m.actual <= m.upper) withinCI++;
          }
          monitoring.ci_coverage_pct = Math.round((withinCI / matched.length) * 100);

          // Accuracy trend: compare first half vs second half of matched period
          if (matched.length >= 14) {
            const mid = Math.floor(matched.length / 2);
            const firstHalf = matched.slice(0, mid);
            const secondHalf = matched.slice(mid);
            const mape1 = firstHalf.reduce((s, m) => s + Math.abs((m.actual - m.forecast) / m.actual), 0) / firstHalf.length;
            const mape2 = secondHalf.reduce((s, m) => s + Math.abs((m.actual - m.forecast) / m.actual), 0) / secondHalf.length;
            if (mape2 < mape1 * 0.85) monitoring.accuracy_trend = 'improving';
            else if (mape2 > mape1 * 1.15) monitoring.accuracy_trend = 'degrading';
          }

          console.log(
            `[AUDIT v3] ${location.name}: Monitoring ${matched.length}d ` +
            `MAPE=${(metrics.mape * 100).toFixed(1)}% MASE=${metrics.mase.toFixed(3)} ` +
            `DirAcc=${(metrics.directional_accuracy * 100).toFixed(0)}% Bias=${metrics.forecast_bias.toFixed(0)} ` +
            `CI_Coverage=${monitoring.ci_coverage_pct}%`
          );
        }
      }

      // ============================================
      // 4. Generate warnings based on THIS location's data
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

        // Restaurant sales typically have 25-35% MAPE - only warn above 35%
        if (mape > 0.35) {
          warnings.push(`HIGH_ERROR: MAPE ${(mape * 100).toFixed(1)}% may indicate volatility`);
        }
      }

      // Monitoring-based warnings (new in v3)
      if (monitoring.metrics) {
        if (monitoring.mase_vs_naive === 'worse') {
          warnings.push(`WORSE_THAN_NAIVE: MASE=${monitoring.metrics.mase.toFixed(2)} (>1 = worse than yesterday's value as forecast)`);
        }
        if (monitoring.metrics.directional_accuracy < 0.45) {
          warnings.push(`LOW_DIRECTIONAL_ACC: ${(monitoring.metrics.directional_accuracy * 100).toFixed(0)}% (coin flip is 50%)`);
        }
        if (monitoring.ci_coverage_pct < 80) {
          warnings.push(`CI_MISCALIBRATED: Only ${monitoring.ci_coverage_pct}% of actuals within 95% CI (expect ~95%)`);
        }
        if (monitoring.accuracy_trend === 'degrading') {
          warnings.push(`ACCURACY_DEGRADING: Forecast accuracy dropping - consider retraining`);
        }
        if (monitoring.bias_direction !== 'balanced') {
          const biasAmt = Math.abs(monitoring.metrics.forecast_bias).toFixed(0);
          warnings.push(`FORECAST_BIAS: ${monitoring.bias_direction} by ~€${biasAmt}/day`);
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
        monitoring,
        warnings,
        status,
      });

      console.log(`[AUDIT v3] ${location.name}: ${status.toUpperCase()} - ${warnings.length} warnings`);
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
        version: "v3",
        summary,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AUDIT v3] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
