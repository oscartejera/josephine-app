import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Robust ML-based Sales Forecasting Engine v3
 * 
 * Improvements in v3:
 * - Adaptive model selection based on data availability
 * - Improved confidence calculation with data penalty
 * - Better handling of new locations with limited history
 * - UPSERT with proper conflict resolution
 * 
 * Algorithm tiers:
 * - <90 days: AVG_28D (simple moving average)
 * - 90-365 days: LR_SI_WEEKLY (trend + weekly pattern)
 * - >365 days: LR_SI_MONTH (full seasonal model)
 */

const TARGET_COL_PERCENT = 22;
const MIN_LABOR_HOURS_PER_DAY = 20;
const MAX_LABOR_HOURS_PER_DAY = 120;
const BACKTEST_DAYS = 56;

// Data thresholds for model selection
const MIN_DAYS_FOR_BASIC_MODEL = 90;
const MIN_DAYS_FOR_FULL_MODEL = 365;

// ============================================
// INTERFACES
// ============================================

interface DailySales {
  date: string;
  t: number;
  sales: number;
  month: number;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  trendSales?: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

interface SeasonalIndex {
  [key: number]: number;
}

interface AuditResult {
  p50_historical: number;
  p90_historical: number;
  p50_forecast_30d: number;
  avg_forecast_30d: number;
  top10_forecast_days: { date: string; forecast: number }[];
  future_days_count: number;
  flags: string[];
  model_tier: string;
}

// ============================================
// STATISTICAL FUNCTIONS
// ============================================

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function winsorize(arr: number[], lowP = 1, highP = 99): number[] {
  const low = percentile(arr, lowP);
  const high = percentile(arr, highP);
  return arr.map(v => Math.max(low, Math.min(high, v)));
}

function linearRegression(data: { x: number; y: number }[]): RegressionResult {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  if (n === 1) return { slope: 0, intercept: data[0].y, rSquared: 0 };

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

function calculateMonthlySeasonalIndex(
  dailyData: DailySales[],
  trend: RegressionResult
): SeasonalIndex {
  const dataWithTrend = dailyData.map(d => ({
    ...d,
    trendSales: trend.slope * d.t + trend.intercept
  }));

  const monthlyData: Record<string, { actual: number; trend: number; month: number }> = {};
  
  dataWithTrend.forEach(d => {
    const yearMonth = d.date.substring(0, 7);
    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = { actual: 0, trend: 0, month: d.month };
    }
    monthlyData[yearMonth].actual += d.sales;
    monthlyData[yearMonth].trend += d.trendSales || 0;
  });

  const siByMonth: Record<number, number[]> = {};
  
  Object.values(monthlyData).forEach(m => {
    if (m.trend > 0) {
      const si = (m.actual - m.trend) / m.trend;
      if (!siByMonth[m.month]) siByMonth[m.month] = [];
      siByMonth[m.month].push(si);
    }
  });

  const result: SeasonalIndex = {};
  for (let month = 1; month <= 12; month++) {
    if (siByMonth[month] && siByMonth[month].length > 0) {
      const avgSi = siByMonth[month].reduce((a, b) => a + b, 0) / siByMonth[month].length;
      result[month] = Math.max(-0.6, Math.min(0.6, avgSi));
    } else {
      result[month] = 0;
    }
  }

  return result;
}

function calculateWeeklySeasonalIndex(dailyData: DailySales[]): SeasonalIndex {
  const avgOverall = dailyData.reduce((s, d) => s + d.sales, 0) / dailyData.length;
  
  const byDow: Record<number, number[]> = {};
  dailyData.forEach(d => {
    if (!byDow[d.dayOfWeek]) byDow[d.dayOfWeek] = [];
    byDow[d.dayOfWeek].push(d.sales);
  });

  const result: SeasonalIndex = {};
  for (let dow = 0; dow < 7; dow++) {
    if (byDow[dow] && byDow[dow].length > 0 && avgOverall > 0) {
      const avgDow = byDow[dow].reduce((a, b) => a + b, 0) / byDow[dow].length;
      result[dow] = Math.max(-0.5, Math.min(0.5, (avgDow - avgOverall) / avgOverall));
    } else {
      result[dow] = 0;
    }
  }

  return result;
}

function calculateMetrics(actual: number[], predicted: number[]): { mse: number; mape: number } {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { mse: 0, mape: 0 };
  }

  let sumSquaredError = 0;
  let sumAbsPercentError = 0;
  const epsilon = 1;

  for (let i = 0; i < actual.length; i++) {
    const error = actual[i] - predicted[i];
    sumSquaredError += error * error;
    const denom = Math.max(actual[i], epsilon);
    sumAbsPercentError += Math.abs(error / denom);
  }

  return {
    mse: sumSquaredError / actual.length,
    mape: sumAbsPercentError / actual.length
  };
}

/**
 * Calculate confidence with data quantity penalty
 * - Base confidence from MAPE
 * - Penalty if < 365 days of data
 * - Minimum 40 if forecast is within historical range
 */
function calculateConfidence(
  mape: number, 
  dataPoints: number, 
  forecastInRange: boolean
): number {
  let base: number;
  const mapePercent = mape * 100;
  
  if (mapePercent < 10) base = 90;
  else if (mapePercent < 20) base = 75;
  else if (mapePercent < 30) base = 60;
  else base = 40;

  // Penalize for low data points
  if (dataPoints < MIN_DAYS_FOR_FULL_MODEL) {
    base = base * (dataPoints / MIN_DAYS_FOR_FULL_MODEL);
  }

  // Minimum 40 if forecast is reasonable
  if (forecastInRange) {
    base = Math.max(40, base);
  }

  return Math.max(0, Math.min(100, Math.round(base)));
}

function fillMissingDates(
  salesByDate: Record<string, number>,
  startDate: Date,
  endDate: Date
): DailySales[] {
  const result: DailySales[] = [];
  const current = new Date(startDate);
  let t = 1;

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    result.push({
      date: dateStr,
      t,
      sales: salesByDate[dateStr] || 0,
      month: current.getMonth() + 1,
      dayOfWeek: current.getDay(),
    });
    current.setDate(current.getDate() + 1);
    t++;
  }

  return result;
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

    console.log(`[FORECAST v3] Starting: location=${locationId || 'all'}, horizon=${horizonDays} days`);

    // ============================================
    // STEP 1: Get ACTIVE locations only
    // ============================================
    let locationsQuery = supabase.from("locations").select("id, name").eq("active", true);
    if (locationId) {
      locationsQuery = supabase.from("locations").select("id, name").eq("id", locationId);
    }
    
    const { data: locationsData } = await locationsQuery;
    const locationsToProcess = locationsData || [];

    if (locationsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active locations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const location of locationsToProcess) {
      console.log(`[FORECAST v3] Processing ${location.name}...`);
      const logs: string[] = [];
      logs.push(`Processing ${location.name}`);

      // ============================================
      // STEP 2: Fetch historical sales with pagination
      // ============================================
      const salesByDate: Record<string, number> = {};
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalTickets = 0;

      while (hasMore) {
        const { data: ticketBatch, error: ticketError } = await supabase
          .from("tickets")
          .select("opened_at, net_total")
          .eq("location_id", location.id)
          .order("opened_at")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (ticketError) {
          logs.push(`ERROR: ${ticketError.message}`);
          break;
        }

        if (!ticketBatch || ticketBatch.length === 0) {
          hasMore = false;
        } else {
          totalTickets += ticketBatch.length;
          
          ticketBatch.forEach((t: any) => {
            const dateStr = new Date(t.opened_at).toISOString().split("T")[0];
            salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (Number(t.net_total) || 0);
          });

          hasMore = ticketBatch.length === pageSize;
          page++;
        }
      }

      logs.push(`Fetched ${totalTickets} tickets in ${page} pages`);

      if (Object.keys(salesByDate).length === 0) {
        logs.push("No ticket data found - skipping");
        results.push({
          location_id: location.id,
          location_name: location.name,
          status: "skipped",
          reason: "no_data",
          logs,
        });
        continue;
      }

      // Build date range and daily series
      const dates = Object.keys(salesByDate).sort();
      const minDateStr = dates[0];
      const maxDateStr = dates[dates.length - 1];
      const minDate = new Date(minDateStr);
      const maxDate = new Date(maxDateStr);

      logs.push(`Date range: ${minDateStr} to ${maxDateStr}`);

      const dailyData = fillMissingDates(salesByDate, minDate, maxDate);
      const dataPoints = dailyData.length;
      logs.push(`Total data points: ${dataPoints}`);

      // ============================================
      // STEP 3: Calculate historical percentiles
      // ============================================
      const salesValues = dailyData.map(d => d.sales).filter(s => s > 0);
      const p1 = percentile(salesValues, 1);
      const p50 = percentile(salesValues, 50);
      const p90 = percentile(salesValues, 90);
      const p99 = percentile(salesValues, 99);
      
      logs.push(`P1=${p1.toFixed(0)}, P50=${p50.toFixed(0)}, P90=${p90.toFixed(0)}, P99=${p99.toFixed(0)}`);

      // Winsorize
      const winsorizedSales = winsorize(dailyData.map(d => d.sales), 1, 99);
      dailyData.forEach((d, i) => {
        d.sales = winsorizedSales[i];
      });

      // ============================================
      // STEP 4: Select model tier based on data availability
      // ============================================
      let modelVersion: string;
      let modelTier: string;
      let trend: RegressionResult = { slope: 0, intercept: p50, rSquared: 0 };
      let seasonalIndex: SeasonalIndex = {};
      let useMonthly = false;

      if (dataPoints < MIN_DAYS_FOR_BASIC_MODEL) {
        // Tier 1: Simple average (< 90 days)
        modelVersion = "AVG_28D_v1";
        modelTier = "simple_average";
        const last28 = dailyData.slice(-28);
        const avg28 = last28.reduce((s, d) => s + d.sales, 0) / last28.length;
        trend = { slope: 0, intercept: avg28, rSquared: 0 };
        logs.push(`Model: AVG_28D (${dataPoints} < 90 days)`);
      } else if (dataPoints < MIN_DAYS_FOR_FULL_MODEL) {
        // Tier 2: LR + Weekly SI (90-365 days)
        modelVersion = "LR_SI_WEEKLY_v1";
        modelTier = "trend_weekly";
        const regressionInput = dailyData.map(d => ({ x: d.t, y: d.sales }));
        trend = linearRegression(regressionInput);
        seasonalIndex = calculateWeeklySeasonalIndex(dailyData);
        useMonthly = false;
        logs.push(`Model: LR_SI_WEEKLY (${dataPoints} days), R²=${trend.rSquared.toFixed(3)}`);
      } else {
        // Tier 3: Full LR + Monthly SI (365+ days)
        modelVersion = "LR_SI_MONTH_v3";
        modelTier = "trend_monthly";
        const regressionInput = dailyData.map(d => ({ x: d.t, y: d.sales }));
        trend = linearRegression(regressionInput);
        seasonalIndex = calculateMonthlySeasonalIndex(dailyData, trend);
        useMonthly = true;
        logs.push(`Model: LR_SI_MONTH (${dataPoints} days), R²=${trend.rSquared.toFixed(3)}`);
      }

      // ============================================
      // STEP 5: Backtesting
      // ============================================
      let mse = 0;
      let mape = 0;
      
      const hasEnoughForBacktest = dataPoints > BACKTEST_DAYS + 30;
      const trainingEndIdx = hasEnoughForBacktest ? dataPoints - BACKTEST_DAYS : dataPoints;
      const backtestData = hasEnoughForBacktest ? dailyData.slice(trainingEndIdx) : [];

      if (backtestData.length > 0) {
        const actualBacktest = backtestData.map(d => d.sales);
        const predictedBacktest = backtestData.map(d => {
          const trendValue = trend.slope * d.t + trend.intercept;
          const siKey = useMonthly ? d.month : d.dayOfWeek;
          const si = seasonalIndex[siKey] || 0;
          return Math.max(0, trendValue * (1 + si));
        });

        const metrics = calculateMetrics(actualBacktest, predictedBacktest);
        mse = Math.round(metrics.mse);
        mape = Math.round(metrics.mape * 1000) / 1000;

        logs.push(`Backtest: MSE=${mse.toFixed(0)}, MAPE=${(mape * 100).toFixed(1)}%`);
      }

      // ============================================
      // STEP 6: Get labor metrics
      // ============================================
      const splhStart = new Date(today);
      splhStart.setDate(splhStart.getDate() - 56);
      
      const { data: laborData } = await supabase
        .from("pos_daily_metrics")
        .select("net_sales, labor_hours")
        .eq("location_id", location.id)
        .gte("date", splhStart.toISOString().split("T")[0])
        .lt("date", todayStr);

      let splh = 80;
      if (laborData && laborData.length > 0) {
        let totalSales = 0;
        let totalHours = 0;
        laborData.forEach((row: any) => {
          totalSales += Number(row.net_sales) || 0;
          totalHours += Number(row.labor_hours) || 0;
        });
        if (totalHours > 0) splh = totalSales / totalHours;
      }

      const { data: employees } = await supabase
        .from("employees")
        .select("hourly_cost")
        .eq("location_id", location.id)
        .eq("active", true)
        .not("hourly_cost", "is", null);

      let blendedHourlyCost = 15;
      if (employees && employees.length > 0) {
        blendedHourlyCost = employees.reduce((s: number, e: any) => s + Number(e.hourly_cost), 0) / employees.length;
      }

      logs.push(`SPLH=€${splh.toFixed(0)}/h, Blended cost=€${blendedHourlyCost.toFixed(2)}/h`);

      // ============================================
      // STEP 7: Generate forecast
      // ============================================
      const forecasts: any[] = [];
      const lastT = dataPoints;
      const auditForecasts: { date: string; forecast: number }[] = [];

      // Reasonable forecast bounds based on THIS location's history
      const minForecast = Math.max(0, p1 * 0.5);
      const maxForecast = p99 * 1.5; // Reduced from 2x to 1.5x

      for (let k = 1; k <= horizonDays; k++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + k);
        const dateStr = forecastDate.toISOString().split("T")[0];
        const month = forecastDate.getMonth() + 1;
        const dayOfWeek = forecastDate.getDay();
        const t = lastT + k;

        // Calculate forecast based on model tier
        const trendValue = trend.slope * t + trend.intercept;
        const siKey = useMonthly ? month : dayOfWeek;
        const si = seasonalIndex[siKey] || 0;
        let forecastSales = trendValue * (1 + si);
        
        // Clamp to reasonable range
        forecastSales = Math.max(minForecast, Math.min(maxForecast, forecastSales));
        forecastSales = Math.round(forecastSales * 100) / 100;

        // Derive labor hours
        let plannedLaborHours = splh > 0 ? forecastSales / splh : forecastSales * 0.22 / blendedHourlyCost;
        plannedLaborHours = Math.max(MIN_LABOR_HOURS_PER_DAY, Math.min(MAX_LABOR_HOURS_PER_DAY, plannedLaborHours));
        plannedLaborHours = Math.round(plannedLaborHours * 10) / 10;

        // Calculate cost with COL% target
        let plannedLaborCost = plannedLaborHours * blendedHourlyCost;
        const currentCol = forecastSales > 0 ? (plannedLaborCost / forecastSales) * 100 : 0;
        
        if (currentCol > TARGET_COL_PERCENT + 5) {
          const targetCost = forecastSales * (TARGET_COL_PERCENT / 100);
          const adjustedHours = Math.max(MIN_LABOR_HOURS_PER_DAY, targetCost / blendedHourlyCost);
          plannedLaborHours = Math.round(adjustedHours * 10) / 10;
          plannedLaborCost = plannedLaborHours * blendedHourlyCost;
        }
        
        plannedLaborCost = Math.round(plannedLaborCost * 100) / 100;

        forecasts.push({
          location_id: location.id,
          date: dateStr,
          forecast_sales: forecastSales,
          planned_labor_hours: plannedLaborHours,
          planned_labor_cost: plannedLaborCost,
          model_version: modelVersion,
          mse,
          mape,
          confidence: 0, // Calculated after audit
          generated_at: new Date().toISOString(),
        });

        if (k <= 30) {
          auditForecasts.push({ date: dateStr, forecast: forecastSales });
        }
      }

      // ============================================
      // STEP 8: Audit and confidence calculation
      // ============================================
      const avgForecast30d = auditForecasts.reduce((s, f) => s + f.forecast, 0) / auditForecasts.length;
      const forecastInRange = avgForecast30d >= p50 * 0.5 && avgForecast30d <= p90 * 2;
      const confidence = calculateConfidence(mape, dataPoints, forecastInRange);

      // Update confidence in all forecasts
      forecasts.forEach(f => {
        f.confidence = confidence;
      });

      const audit: AuditResult = {
        p50_historical: Math.round(p50),
        p90_historical: Math.round(p90),
        p50_forecast_30d: Math.round(percentile(auditForecasts.map(f => f.forecast), 50)),
        avg_forecast_30d: Math.round(avgForecast30d),
        top10_forecast_days: auditForecasts
          .sort((a, b) => b.forecast - a.forecast)
          .slice(0, 10)
          .map(f => ({ date: f.date, forecast: Math.round(f.forecast) })),
        future_days_count: horizonDays,
        flags: [],
        model_tier: modelTier,
      };

      // Check for warnings
      if (dataPoints < MIN_DAYS_FOR_BASIC_MODEL) {
        audit.flags.push("INSUFFICIENT_HISTORY");
        logs.push(`⚠️ Less than ${MIN_DAYS_FOR_BASIC_MODEL} days of history`);
      }

      if (!forecastInRange) {
        audit.flags.push("FORECAST_OUT_OF_RANGE");
        logs.push(`⚠️ Forecast avg €${avgForecast30d.toFixed(0)} outside historical range`);
      }

      logs.push(`Audit: P50=${audit.p50_historical}, P90=${audit.p90_historical}, Forecast avg=${audit.avg_forecast_30d}, Conf=${confidence}%`);

      // ============================================
      // STEP 9: Delete existing forecasts and insert new ones
      // ============================================
      
      // Delete existing forecasts for this location (clean slate)
      const { error: deleteError } = await supabase
        .from("forecast_daily_metrics")
        .delete()
        .eq("location_id", location.id)
        .gte("date", todayStr);

      if (deleteError) {
        logs.push(`Delete error: ${deleteError.message}`);
      }

      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < forecasts.length; i += batchSize) {
        const batch = forecasts.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("forecast_daily_metrics")
          .insert(batch);

        if (insertError) {
          logs.push(`Insert error batch ${i / batchSize}: ${insertError.message}`);
        }
      }

      // ============================================
      // STEP 10: Log model run
      // ============================================
      await supabase.from("forecast_model_runs").insert({
        location_id: location.id,
        model_version: modelVersion,
        algorithm: modelTier,
        history_start: minDateStr,
        history_end: maxDateStr,
        horizon_days: horizonDays,
        mse,
        mape,
        confidence,
        data_points: dataPoints,
        trend_slope: trend.slope,
        trend_intercept: trend.intercept,
        seasonality_dow: useMonthly ? null : seasonalIndex,
        seasonality_woy: useMonthly ? seasonalIndex : null,
      });

      logs.push(`Generated ${forecasts.length} forecast days`);

      results.push({
        location_id: location.id,
        location_name: location.name,
        model_version: modelVersion,
        model_tier: modelTier,
        forecasts_generated: forecasts.length,
        data_points: dataPoints,
        trend: { slope: trend.slope, intercept: trend.intercept, r_squared: trend.rSquared },
        seasonal_index: seasonalIndex,
        mse,
        mape_percent: Math.round(mape * 1000) / 10,
        confidence,
        splh: Math.round(splh),
        blended_hourly_cost: Math.round(blendedHourlyCost * 100) / 100,
        audit,
        logs,
      });

      console.log(`[FORECAST v3] ${location.name}: ${forecasts.length} days, Model=${modelVersion}, Conf=${confidence}%`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: "v3",
        algorithm: "Adaptive Model Selection (AVG/Weekly/Monthly)",
        horizon_days: horizonDays,
        target_col_percent: TARGET_COL_PERCENT,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v3] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
