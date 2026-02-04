import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getRegressors, calculateRegressorAdjustment, explainForecast } from "../_shared/regressors.ts";

/**
 * Prophet-Style Forecast Generator V4
 * 
 * Mejoras en v4:
 * - Regresores externos: clima, eventos, festivos
 * - Adjustment factors basados en variables exógenas
 * - Explicaciones de por qué el forecast es X
 * - Confidence intervals mejorados
 * - Optimal para 13+ meses de historia
 */

const TARGET_COL_PERCENT = 28;
const MIN_LABOR_HOURS_PER_DAY = 20;
const MAX_LABOR_HOURS_PER_DAY = 120;

interface DailySales {
  date: string;
  t: number;
  sales: number;
  month: number;
  dayOfWeek: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function linearRegression(data: { x: number; y: number }[]): RegressionResult {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.y || 0, rSquared: 0 };

  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssTot = data.reduce((s, d) => s + Math.pow(d.y - yMean, 2), 0);
  const ssRes = data.reduce((s, d) => s + Math.pow(d.y - (slope * d.x + intercept), 2), 0);
  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

  return { slope, intercept, rSquared };
}

function calculateSeasonalIndex(dailyData: DailySales[], type: 'monthly' | 'weekly'): Record<number, number> {
  const avgOverall = dailyData.reduce((s, d) => s + d.sales, 0) / dailyData.length;
  const grouped: Record<number, number[]> = {};

  dailyData.forEach(d => {
    const key = type === 'monthly' ? d.month : d.dayOfWeek;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d.sales);
  });

  const result: Record<number, number> = {};
  const keys = type === 'monthly' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5, 6];

  for (const key of keys) {
    if (grouped[key] && grouped[key].length > 0 && avgOverall > 0) {
      const avgKey = grouped[key].reduce((a, b) => a + b, 0) / grouped[key].length;
      result[key] = (avgKey - avgOverall) / avgOverall;
    } else {
      result[key] = 0;
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const weatherApiKey = Deno.env.get("OPENWEATHER_API_KEY"); // Optional
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id;
    const horizonDays = body.horizon_days || 90; // Default 3 months

    console.log(`[FORECAST v4] Starting with regressors: location=${locationId || 'all'}, horizon=${horizonDays}`);

    // Get locations
    let locationsQuery = supabase.from("locations").select("id, name");
    if (locationId) {
      locationsQuery = locationsQuery.eq("id", locationId);
    }
    
    const { data: locationsData } = await locationsQuery;
    const locations = locationsData || [];

    if (locations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No locations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const location of locations) {
      console.log(`[FORECAST v4] Processing ${location.name}...`);
      
      // Fetch historical sales from facts_sales_15m
      const { data: salesData } = await supabase
        .from("facts_sales_15m")
        .select("ts_bucket, sales_net")
        .eq("location_id", location.id)
        .order("ts_bucket");

      if (!salesData || salesData.length === 0) {
        console.log(`No sales data for ${location.name}, skipping`);
        continue;
      }

      // Aggregate to daily
      const salesByDate: Record<string, number> = {};
      salesData.forEach((s: any) => {
        const dateStr = new Date(s.ts_bucket).toISOString().split('T')[0];
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (Number(s.sales_net) || 0);
      });

      const dates = Object.keys(salesByDate).sort();
      const minDate = new Date(dates[0]);
      const maxDate = new Date(dates[dates.length - 1]);

      // Build daily series
      const dailyData: DailySales[] = [];
      let t = 1;
      const current = new Date(minDate);

      while (current <= maxDate) {
        const dateStr = current.toISOString().split("T")[0];
        const date = new Date(current);
        
        dailyData.push({
          date: dateStr,
          t: t++,
          sales: salesByDate[dateStr] || 0,
          month: date.getMonth() + 1,
          dayOfWeek: date.getDay(),
        });
        
        current.setDate(current.getDate() + 1);
      }

      const dataPoints = dailyData.length;
      console.log(`${location.name}: ${dataPoints} days of history`);

      // Calculate trend
      const regressionInput = dailyData.map(d => ({ x: d.t, y: d.sales }));
      const trend = linearRegression(regressionInput);

      // Calculate seasonal indices
      const useMonthly = dataPoints >= 365;
      const seasonalIndex = useMonthly 
        ? calculateSeasonalIndex(dailyData, 'monthly')
        : calculateSeasonalIndex(dailyData, 'weekly');

      console.log(`Model: ${useMonthly ? 'Monthly' : 'Weekly'} seasonality, R²=${trend.rSquared.toFixed(3)}`);

      // Generate forecast with regressors
      const forecasts: any[] = [];
      const lastT = dataPoints;

      for (let k = 1; k <= horizonDays; k++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + k);
        const dateStr = forecastDate.toISOString().split("T")[0];
        const month = forecastDate.getMonth() + 1;
        const dayOfWeek = forecastDate.getDay();
        const t = lastT + k;

        // Base forecast (trend + seasonality)
        const trendValue = trend.slope * t + trend.intercept;
        const siKey = useMonthly ? month : dayOfWeek;
        const si = seasonalIndex[siKey] || 0;
        const baseForecast = Math.max(0, trendValue * (1 + si));

        // Get regressors for this date
        const regressors = await getRegressors(dateStr, weatherApiKey);
        
        // Apply regressor adjustment
        const regressorAdjustment = calculateRegressorAdjustment(regressors);
        const adjustedForecast = baseForecast * regressorAdjustment;
        
        // Confidence interval (based on historical variance)
        const salesValues = dailyData.map(d => d.sales).filter(s => s > 0);
        const stdDev = Math.sqrt(
          salesValues.reduce((sum, s) => sum + Math.pow(s - (salesValues.reduce((a,b) => a+b, 0) / salesValues.length), 2), 0) / salesValues.length
        );
        
        const lowerBound = Math.max(0, adjustedForecast - stdDev * 1.96); // 95% CI
        const upperBound = adjustedForecast + stdDev * 1.96;

        // Calculate planned labour
        const targetLabourCost = adjustedForecast * (TARGET_COL_PERCENT / 100);
        const plannedLaborHours = Math.max(MIN_LABOR_HOURS_PER_DAY, Math.min(MAX_LABOR_HOURS_PER_DAY, targetLabourCost / 14.5));

        forecasts.push({
          location_id: location.id,
          date: dateStr,
          forecast_sales: Math.round(adjustedForecast * 100) / 100,
          forecast_sales_lower: Math.round(lowerBound * 100) / 100,
          forecast_sales_upper: Math.round(upperBound * 100) / 100,
          planned_labor_hours: Math.round(plannedLaborHours * 10) / 10,
          planned_labor_cost: Math.round(targetLabourCost * 100) / 100,
          model_version: `Prophet_v4_${useMonthly ? 'Monthly' : 'Weekly'}_Regressors`,
          confidence: Math.round(trend.rSquared * 100),
          regressors: regressors,
          base_forecast: Math.round(baseForecast * 100) / 100,
          regressor_adjustment: Math.round(regressorAdjustment * 1000) / 1000,
          explanation: explainForecast(baseForecast, regressors, adjustedForecast),
          generated_at: new Date().toISOString(),
        });
      }

      // Delete existing forecasts
      await supabase
        .from("forecast_daily_metrics")
        .delete()
        .eq("location_id", location.id)
        .gte("date", todayStr);

      // Insert new forecasts in batches
      for (let i = 0; i < forecasts.length; i += 500) {
        const batch = forecasts.slice(i, i + 500);
        const { error } = await supabase
          .from("forecast_daily_metrics")
          .insert(batch);

        if (error) {
          console.error(`Insert error for ${location.name}:`, error);
        }
      }

      // Log model run
      await supabase.from("forecast_model_runs").insert({
        location_id: location.id,
        model_version: `Prophet_v4_Regressors`,
        algorithm: useMonthly ? 'Trend_Monthly_Seasonal_Regressors' : 'Trend_Weekly_Seasonal_Regressors',
        history_start: dates[0],
        history_end: dates[dates.length - 1],
        horizon_days: horizonDays,
        mse: 0,
        mape: 0,
        confidence: Math.round(trend.rSquared * 100),
        data_points: dataPoints,
        trend_slope: trend.slope,
        trend_intercept: trend.intercept,
        seasonality_dow: useMonthly ? null : seasonalIndex,
        seasonality_woy: useMonthly ? seasonalIndex : null,
      });

      results.push({
        location_id: location.id,
        location_name: location.name,
        model: useMonthly ? 'Monthly + Regressors' : 'Weekly + Regressors',
        forecasts_generated: forecasts.length,
        data_points: dataPoints,
        trend_r_squared: Math.round(trend.rSquared * 1000) / 1000,
        confidence: Math.round(trend.rSquared * 100),
        sample_forecast: forecasts.slice(0, 7).map(f => ({
          date: f.date,
          forecast: f.forecast_sales,
          explanation: f.explanation
        }))
      });

      console.log(`✅ ${location.name}: ${forecasts.length} days forecasted`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: "v4_prophet_regressors",
        features: [
          "Trend + Seasonality (monthly/weekly)",
          "External regressors (weather, events, holidays)",
          "Confidence intervals (95%)",
          "Explanation strings",
          "Optimal with 13+ months history"
        ],
        horizon_days: horizonDays,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v4] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
