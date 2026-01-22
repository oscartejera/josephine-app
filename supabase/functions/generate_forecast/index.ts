import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Robust ML-based Sales Forecasting Engine
 * 
 * Implements:
 * - Decomposition = Trend (Linear Regression) + Seasonality (DOW + WOY)
 * - Multiplicative model: Forecast = Trend * (1 + SI_dow) * (1 + SI_woy)
 * - Backtesting with MSE/MAPE metrics (last 56 days)
 * - Confidence scoring based on MAPE
 * - Fallback to SES if insufficient data
 * - Derives planned_labor_hours and planned_labor_cost from SPLH
 */

const MODEL_VERSION = "LR_SI_DOW_WOY_v2";

interface HistoricalData {
  t: number; // time index
  date: string;
  sales: number;
  dow: number; // 0-6 (Sunday-Saturday)
  woy: number; // 1-53
}

interface SeasonalityIndex {
  [key: number]: number; // Percentage vs trend (can be negative)
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

// ============================================
// STATISTICAL FUNCTIONS
// ============================================

function linearRegression(data: { x: number; y: number }[]): RegressionResult {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const sumY2 = data.reduce((s, d) => s + d.y * d.y, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared
  const yMean = sumY / n;
  const ssTot = data.reduce((s, d) => s + Math.pow(d.y - yMean, 2), 0);
  const ssRes = data.reduce((s, d) => s + Math.pow(d.y - (slope * d.x + intercept), 2), 0);
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  
  return { slope, intercept, rSquared };
}

// Calculate seasonal index as ratio vs trend
function calculateSeasonality(
  data: HistoricalData[],
  trend: RegressionResult,
  groupBy: 'dow' | 'woy'
): SeasonalityIndex {
  const groups: Record<number, number[]> = {};
  
  data.forEach(d => {
    const key = groupBy === 'dow' ? d.dow : d.woy;
    const trendValue = trend.slope * d.t + trend.intercept;
    
    if (trendValue > 0) {
      const ratio = (d.sales - trendValue) / trendValue; // Percentage above/below trend
      if (!groups[key]) groups[key] = [];
      groups[key].push(ratio);
    }
  });
  
  const result: SeasonalityIndex = {};
  for (const key in groups) {
    const values = groups[key];
    result[Number(key)] = values.reduce((s, v) => s + v, 0) / values.length;
  }
  
  return result;
}

// Simple Exponential Smoothing with auto-optimized alpha
function ses(data: number[], alpha: number): number[] {
  if (data.length === 0) return [];
  
  const smoothed: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

function findOptimalAlpha(data: number[]): number {
  const alphas = [0.2, 0.4, 0.6, 0.8];
  let bestAlpha = 0.4;
  let bestMSE = Infinity;
  
  for (const alpha of alphas) {
    const smoothed = ses(data, alpha);
    let mse = 0;
    for (let i = 1; i < data.length; i++) {
      const error = data[i] - smoothed[i - 1];
      mse += error * error;
    }
    mse /= (data.length - 1);
    
    if (mse < bestMSE) {
      bestMSE = mse;
      bestAlpha = alpha;
    }
  }
  
  return bestAlpha;
}

// Calculate MSE and MAPE
function calculateMetrics(actual: number[], predicted: number[]): { mse: number; mape: number } {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { mse: 0, mape: 0 };
  }
  
  let sumSquaredError = 0;
  let sumAbsPercentError = 0;
  let validMapeCount = 0;
  
  for (let i = 0; i < actual.length; i++) {
    const error = actual[i] - predicted[i];
    sumSquaredError += error * error;
    
    if (actual[i] > 0) {
      sumAbsPercentError += Math.abs(error / actual[i]);
      validMapeCount++;
    }
  }
  
  const mse = sumSquaredError / actual.length;
  const mape = validMapeCount > 0 ? sumAbsPercentError / validMapeCount : 0;
  
  return { mse, mape };
}

// Calculate confidence from MAPE (0-100)
function calculateConfidence(mape: number, dataPoints: number): number {
  // MAPE is in 0..1 range (e.g., 0.15 = 15%)
  // confidence = clamp(100 - (MAPE * 100), 0, 100)
  const mapePercent = mape * 100;
  let confidence = 100 - mapePercent;
  
  // Penalize for low data points
  if (dataPoints < 90) {
    confidence *= (dataPoints / 90);
  }
  
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

// Get week of year (1-53)
function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((diff + start.getDay() * 24 * 60 * 60 * 1000) / oneWeek);
}

// ============================================
// MAIN HANDLER
// ============================================

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
    const horizonDays = body.horizon_days || 365;
    const minHistoryDays = body.min_history_days || 90;

    console.log(`[FORECAST] Starting: location=${locationId || 'all'}, horizon=${horizonDays} days`);

    // Get locations to process
    let locationsToProcess: { id: string; name: string }[] = [];
    
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("id, name")
        .eq("id", locationId)
        .single();
      
      if (loc) locationsToProcess = [loc];
    } else {
      const { data: locs } = await supabase
        .from("locations")
        .select("id, name");
      
      locationsToProcess = locs || [];
    }

    if (locationsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: "No locations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    for (const location of locationsToProcess) {
      console.log(`[FORECAST] Processing ${location.name}...`);
      
      // ============================================
      // 1. FETCH HISTORICAL DATA (up to 2 years)
      // ============================================
      const historyStart = new Date(today);
      historyStart.setFullYear(historyStart.getFullYear() - 2);
      const historyStartStr = historyStart.toISOString().split("T")[0];
      
      const { data: salesRaw } = await supabase
        .from("product_sales_daily")
        .select("date, net_sales")
        .eq("location_id", location.id)
        .gte("date", historyStartStr)
        .lt("date", todayStr)
        .order("date");

      // Aggregate by date
      const dailySales: Record<string, number> = {};
      (salesRaw || []).forEach((row: any) => {
        dailySales[row.date] = (dailySales[row.date] || 0) + (Number(row.net_sales) || 0);
      });

      // Build historical data array with indices
      const sortedDates = Object.keys(dailySales).sort();
      const historicalData: HistoricalData[] = sortedDates.map((date, idx) => {
        const d = new Date(date);
        return {
          t: idx + 1,
          date,
          sales: dailySales[date],
          dow: d.getDay(),
          woy: getWeekOfYear(d),
        };
      });

      console.log(`[FORECAST] ${location.name}: ${historicalData.length} historical days`);

      // ============================================
      // 2. DETERMINE MODEL TO USE
      // ============================================
      let modelVersion = MODEL_VERSION;
      let trend: RegressionResult = { slope: 0, intercept: 0, rSquared: 0 };
      let siDow: SeasonalityIndex = {};
      let siWoy: SeasonalityIndex = {};
      let useFallback = false;
      let mse = 0;
      let mape = 0;
      let confidence = 0;

      if (historicalData.length >= minHistoryDays) {
        // ============================================
        // 3A. LINEAR REGRESSION + SEASONALITY
        // ============================================
        
        // Fit linear trend
        trend = linearRegression(historicalData.map(d => ({ x: d.t, y: d.sales })));
        console.log(`[FORECAST] ${location.name}: Trend slope=${trend.slope.toFixed(2)}, R²=${trend.rSquared.toFixed(3)}`);
        
        // Calculate DOW seasonality
        siDow = calculateSeasonality(historicalData, trend, 'dow');
        
        // Calculate WOY seasonality only if >= 2 years of data
        if (historicalData.length >= 365 * 1.5) {
          siWoy = calculateSeasonality(historicalData, trend, 'woy');
          console.log(`[FORECAST] ${location.name}: Using DOW + WOY seasonality`);
        } else {
          console.log(`[FORECAST] ${location.name}: Using DOW seasonality only`);
          modelVersion = "LR_SI_DOW_v2";
        }
        
        // ============================================
        // 4. BACKTESTING (last 56 days)
        // ============================================
        const backtestDays = 56;
        const backtestStart = Math.max(0, historicalData.length - backtestDays);
        const backtestData = historicalData.slice(backtestStart);
        
        const actual = backtestData.map(d => d.sales);
        const predicted = backtestData.map(d => {
          const trendValue = trend.slope * d.t + trend.intercept;
          const dowFactor = 1 + (siDow[d.dow] || 0);
          const woyFactor = 1 + (siWoy[d.woy] || 0);
          return Math.max(0, trendValue * dowFactor * woyFactor);
        });
        
        const metrics = calculateMetrics(actual, predicted);
        mse = Math.round(metrics.mse);
        mape = Math.round(metrics.mape * 1000) / 1000; // 0.xxx format
        confidence = calculateConfidence(mape, historicalData.length);
        
        console.log(`[FORECAST] ${location.name}: MSE=${mse}, MAPE=${(mape * 100).toFixed(1)}%, Confidence=${confidence}%`);
        
      } else {
        // ============================================
        // 3B. FALLBACK: SES + DOW seasonality
        // ============================================
        useFallback = true;
        modelVersion = "SES_DOW_fallback";
        console.log(`[FORECAST] ${location.name}: Using SES fallback (${historicalData.length} < ${minHistoryDays} days)`);
        
        const salesArray = historicalData.map(d => d.sales);
        const alpha = salesArray.length > 7 ? findOptimalAlpha(salesArray) : 0.4;
        const smoothed = ses(salesArray, alpha);
        
        // Use last smoothed value as base, with simple DOW multipliers
        const baseSales = smoothed.length > 0 ? smoothed[smoothed.length - 1] : 2500;
        
        // Calculate simple DOW averages
        const dowSales: Record<number, number[]> = {};
        historicalData.forEach(d => {
          if (!dowSales[d.dow]) dowSales[d.dow] = [];
          dowSales[d.dow].push(d.sales);
        });
        
        const overallMean = historicalData.length > 0
          ? historicalData.reduce((s, d) => s + d.sales, 0) / historicalData.length
          : baseSales;
        
        for (let dow = 0; dow < 7; dow++) {
          if (dowSales[dow] && dowSales[dow].length > 0) {
            const mean = dowSales[dow].reduce((a, b) => a + b, 0) / dowSales[dow].length;
            siDow[dow] = overallMean > 0 ? (mean - overallMean) / overallMean : 0;
          } else {
            siDow[dow] = 0;
          }
        }
        
        // Set trend as flat
        trend = { slope: 0, intercept: baseSales, rSquared: 0 };
        confidence = historicalData.length > 30 ? 30 : 10;
        mse = 0;
        mape = 0;
      }

      // ============================================
      // 5. GET LABOR METRICS FOR PLANNING
      // ============================================
      
      // Get average SPLH (Sales Per Labor Hour) from last 8 weeks
      const splhStart = new Date(today);
      splhStart.setDate(splhStart.getDate() - 56);
      const splhStartStr = splhStart.toISOString().split("T")[0];
      
      const { data: laborData } = await supabase
        .from("pos_daily_metrics")
        .select("net_sales, labor_hours")
        .eq("location_id", location.id)
        .gte("date", splhStartStr)
        .lt("date", todayStr);
      
      let avgSPLH = 80; // Default €80/hour
      if (laborData && laborData.length > 0) {
        let totalSales = 0;
        let totalHours = 0;
        laborData.forEach((row: any) => {
          totalSales += Number(row.net_sales) || 0;
          totalHours += Number(row.labor_hours) || 0;
        });
        if (totalHours > 0) {
          avgSPLH = totalSales / totalHours;
        }
      }
      
      // Get blended hourly cost
      const { data: employees } = await supabase
        .from("employees")
        .select("hourly_cost")
        .eq("location_id", location.id)
        .eq("active", true)
        .not("hourly_cost", "is", null);
      
      let blendedHourlyCost = 15; // Default €15/hour
      if (employees && employees.length > 0) {
        blendedHourlyCost = employees.reduce((s: number, e: any) => s + Number(e.hourly_cost), 0) / employees.length;
      }
      
      // Get target COL%
      const { data: settings } = await supabase
        .from("location_settings")
        .select("target_col_percent")
        .eq("location_id", location.id)
        .maybeSingle();
      
      const targetColPct = settings?.target_col_percent || 22;
      
      console.log(`[FORECAST] ${location.name}: SPLH=€${avgSPLH.toFixed(0)}/h, BlendedCost=€${blendedHourlyCost.toFixed(2)}/h, TargetCOL=${targetColPct}%`);

      // ============================================
      // 6. GENERATE FORECASTS
      // ============================================
      const forecasts: any[] = [];
      const lastT = historicalData.length > 0 ? historicalData[historicalData.length - 1].t : 0;
      const historyStartDate = sortedDates[0] || todayStr;
      const historyEndDate = sortedDates[sortedDates.length - 1] || todayStr;
      
      for (let i = 1; i <= horizonDays; i++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + i);
        const dateStr = forecastDate.toISOString().split("T")[0];
        
        const dow = forecastDate.getDay();
        const woy = getWeekOfYear(forecastDate);
        const t = lastT + i;
        
        // Calculate forecast using model
        const trendValue = trend.slope * t + trend.intercept;
        const dowFactor = 1 + (siDow[dow] || 0);
        const woyFactor = 1 + (siWoy[woy] || 0);
        let forecastSales = trendValue * dowFactor * woyFactor;
        forecastSales = Math.max(0, Math.round(forecastSales * 100) / 100);
        
        // Derive labor metrics
        const plannedLaborHours = avgSPLH > 0 
          ? Math.round((forecastSales / avgSPLH) * 10) / 10
          : Math.round((forecastSales * (targetColPct / 100) / blendedHourlyCost) * 10) / 10;
        const plannedLaborCost = Math.round(plannedLaborHours * blendedHourlyCost * 100) / 100;
        
        forecasts.push({
          location_id: location.id,
          date: dateStr,
          forecast_sales: forecastSales,
          planned_labor_hours: plannedLaborHours,
          planned_labor_cost: plannedLaborCost,
          model_version: modelVersion,
          mse,
          mape,
          confidence,
          generated_at: new Date().toISOString(),
        });
      }

      // ============================================
      // 7. UPSERT FORECASTS
      // ============================================
      const batchSize = 500;
      for (let i = 0; i < forecasts.length; i += batchSize) {
        const batch = forecasts.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from("forecast_daily_metrics")
          .upsert(batch, { onConflict: "location_id,date", ignoreDuplicates: false });
        
        if (upsertError) {
          console.error(`[FORECAST] Upsert error for ${location.name}:`, upsertError.message);
        }
      }

      // ============================================
      // 8. LOG MODEL RUN
      // ============================================
      const { error: logError } = await supabase
        .from("forecast_model_runs")
        .insert({
          location_id: location.id,
          model_version: modelVersion,
          algorithm: useFallback ? 'ses_seasonal' : 'linear_regression_seasonal',
          history_start: historyStartDate,
          history_end: historyEndDate,
          horizon_days: horizonDays,
          mse,
          mape,
          confidence,
          data_points: historicalData.length,
          trend_slope: trend.slope,
          trend_intercept: trend.intercept,
          seasonality_dow: siDow,
          seasonality_woy: Object.keys(siWoy).length > 0 ? siWoy : null,
        });
      
      if (logError) {
        console.warn(`[FORECAST] Log error for ${location.name}:`, logError.message);
      }

      results.push({
        location_id: location.id,
        location_name: location.name,
        model_version: modelVersion,
        forecasts_generated: forecasts.length,
        data_points: historicalData.length,
        mse,
        mape: Math.round(mape * 1000) / 10, // Convert to percentage
        confidence,
        avg_splh: Math.round(avgSPLH),
        blended_hourly_cost: Math.round(blendedHourlyCost * 100) / 100,
      });
      
      console.log(`[FORECAST] ${location.name}: Generated ${forecasts.length} forecasts`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        model_version: MODEL_VERSION,
        horizon_days: horizonDays,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});