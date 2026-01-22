import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Robust ML-based Sales Forecasting Engine v2
 * 
 * Algorithm: Linear Regression (Trend) + Monthly Seasonal Index (SI)
 * Source of Truth: tickets.net_total
 * 
 * Steps:
 * 1. Prepare daily sales from tickets (winsorize outliers P1/P99)
 * 2. Fit Linear Regression for trend: trend(t) = A0 + A1*t
 * 3. Calculate Monthly Seasonal Index: avg_si[month] = avg((actual - trend) / trend)
 * 4. Forecast: forecast = trend_future * (1 + avg_si[month])
 * 5. Backtest last 56 days for MSE/MAPE/Confidence
 * 6. Derive labor hours/cost using SPLH and target COL% = 22%
 * 7. Audit checks for data quality
 */

const MODEL_VERSION = "LR_SI_MONTH_v2";
const TARGET_COL_PERCENT = 22;
const MIN_LABOR_HOURS_PER_DAY = 20;  // Restaurant minimum
const MAX_LABOR_HOURS_PER_DAY = 120; // 30-table restaurant max
const BACKTEST_DAYS = 56;

// ============================================
// INTERFACES
// ============================================

interface DailySales {
  date: string;
  t: number;        // Time index
  sales: number;    // Actual sales
  month: number;    // 1-12
  trendSales?: number; // Trend prediction for this day
}

interface RegressionResult {
  slope: number;      // A1
  intercept: number;  // A0
  rSquared: number;
}

interface MonthlySeasonalIndex {
  [month: number]: number; // -0.6 to +0.6 typical range
}

interface AuditResult {
  p50_historical: number;
  p90_historical: number;
  p50_forecast_30d: number;
  avg_forecast_30d: number;
  top10_forecast_days: { date: string; forecast: number }[];
  future_days_count: number;
  flags: string[];
}

// ============================================
// STATISTICAL FUNCTIONS
// ============================================

/**
 * Calculate percentile of an array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Winsorize array to P1/P99 to remove outliers
 */
function winsorize(arr: number[], lowP = 1, highP = 99): number[] {
  const low = percentile(arr, lowP);
  const high = percentile(arr, highP);
  return arr.map(v => Math.max(low, Math.min(high, v)));
}

/**
 * Simple Linear Regression: y = A0 + A1*x
 */
function linearRegression(data: { x: number; y: number }[]): RegressionResult {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  if (n === 1) return { slope: 0, intercept: data[0].y, rSquared: 0 };

  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const sumY2 = data.reduce((s, d) => s + d.y * d.y, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  const ssTot = data.reduce((s, d) => s + Math.pow(d.y - yMean, 2), 0);
  const ssRes = data.reduce((s, d) => s + Math.pow(d.y - (slope * d.x + intercept), 2), 0);
  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

  return { slope, intercept, rSquared };
}

/**
 * Calculate Monthly Seasonal Index from historical data
 * SI[month] = avg((actual_month - trend_month) / trend_month)
 */
function calculateMonthlySeasonalIndex(
  dailyData: DailySales[],
  trend: RegressionResult
): MonthlySeasonalIndex {
  // Calculate trend sales for each day
  const dataWithTrend = dailyData.map(d => ({
    ...d,
    trendSales: trend.slope * d.t + trend.intercept
  }));

  // Aggregate by year-month
  const monthlyData: Record<string, { actual: number; trend: number; month: number }> = {};
  
  dataWithTrend.forEach(d => {
    const yearMonth = d.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = { actual: 0, trend: 0, month: d.month };
    }
    monthlyData[yearMonth].actual += d.sales;
    monthlyData[yearMonth].trend += d.trendSales || 0;
  });

  // Calculate SI for each year-month
  const siByMonth: Record<number, number[]> = {};
  
  Object.values(monthlyData).forEach(m => {
    if (m.trend > 0) {
      const si = (m.actual - m.trend) / m.trend;
      if (!siByMonth[m.month]) siByMonth[m.month] = [];
      siByMonth[m.month].push(si);
    }
  });

  // Average SI per month-of-year with guardrails [-0.6, +0.6]
  const result: MonthlySeasonalIndex = {};
  for (let month = 1; month <= 12; month++) {
    if (siByMonth[month] && siByMonth[month].length > 0) {
      const avgSi = siByMonth[month].reduce((a, b) => a + b, 0) / siByMonth[month].length;
      result[month] = Math.max(-0.6, Math.min(0.6, avgSi));
    } else {
      result[month] = 0; // No data for this month
    }
  }

  return result;
}

/**
 * Calculate MSE and MAPE for model evaluation
 */
function calculateMetrics(
  actual: number[],
  predicted: number[]
): { mse: number; mape: number } {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { mse: 0, mape: 0 };
  }

  let sumSquaredError = 0;
  let sumAbsPercentError = 0;
  let validMapeCount = 0;
  const epsilon = 1; // Avoid division by zero

  for (let i = 0; i < actual.length; i++) {
    const error = actual[i] - predicted[i];
    sumSquaredError += error * error;
    
    const denom = Math.max(actual[i], epsilon);
    sumAbsPercentError += Math.abs(error / denom);
    validMapeCount++;
  }

  const mse = sumSquaredError / actual.length;
  const mape = validMapeCount > 0 ? sumAbsPercentError / validMapeCount : 0;

  return { mse, mape };
}

/**
 * Calculate confidence score from MAPE
 * 90 if MAPE < 10%, 75 if 10-20%, 60 if 20-30%, 40 if >30%
 */
function calculateConfidence(mape: number, dataPoints: number): number {
  let base: number;
  const mapePercent = mape * 100;
  
  if (mapePercent < 10) base = 90;
  else if (mapePercent < 20) base = 75;
  else if (mapePercent < 30) base = 60;
  else base = 40;

  // Penalize for low data points (need at least 90 days)
  if (dataPoints < 90) {
    base = base * (dataPoints / 90);
  }

  return Math.max(0, Math.min(100, Math.round(base)));
}

/**
 * Fill missing dates with 0 sales to ensure continuous time series
 */
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
      month: current.getMonth() + 1, // 1-12
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

    console.log(`[FORECAST v2] Starting: location=${locationId || 'all'}, horizon=${horizonDays} days`);

    // ============================================
    // STEP 1: Get locations to process
    // ============================================
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
      console.log(`[FORECAST v2] Processing ${location.name}...`);
      const logs: string[] = [];
      logs.push(`Processing ${location.name}`);

      // ============================================
      // STEP 2: Fetch historical sales from TICKETS (using pagination to get all data)
      // Supabase has a default limit of 1000 rows, so we need to paginate
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
          console.error(`[FORECAST v2] Error fetching tickets page ${page}:`, ticketError.message);
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

          if (ticketBatch.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      logs.push(`Fetched ${totalTickets} tickets in ${page + 1} pages`);

      if (Object.keys(salesByDate).length === 0) {
        console.warn(`[FORECAST v2] No ticket data for ${location.name}`);
        logs.push("No ticket data found");
        continue;
      }

      // Calculate date range
      const dates = Object.keys(salesByDate).sort();
      const minDateStr = dates[0];
      const maxDateStr = dates[dates.length - 1];
      const minDate = new Date(minDateStr);
      const maxDate = new Date(maxDateStr);

      // Check for duplicate detection (audit)
      const dailyEntryCounts = dates.length;
      const expectedDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      logs.push(`Date range: ${minDateStr} to ${maxDateStr}`);
      logs.push(`Unique days: ${dailyEntryCounts}, Expected: ${expectedDays}`);

      // ============================================
      // STEP 3: Build continuous daily series with 0-fill
      // ============================================
      const dailyData = fillMissingDates(salesByDate, minDate, maxDate);
      logs.push(`Total data points: ${dailyData.length}`);

      // ============================================
      // STEP 4: Winsorize outliers (P1/P99)
      // ============================================
      const salesValues = dailyData.map(d => d.sales);
      const p1 = percentile(salesValues, 1);
      const p99 = percentile(salesValues, 99);
      const p50 = percentile(salesValues, 50);
      const p90 = percentile(salesValues, 90);
      
      logs.push(`P1=${p1.toFixed(0)}, P50=${p50.toFixed(0)}, P90=${p90.toFixed(0)}, P99=${p99.toFixed(0)}`);

      // Winsorize the data
      const winsorizedSales = winsorize(salesValues, 1, 99);
      dailyData.forEach((d, i) => {
        d.sales = winsorizedSales[i];
      });

      // ============================================
      // STEP 5: Backtesting setup (holdout last 56 days)
      // ============================================
      let mse = 0;
      let mape = 0;
      let confidence = 0;
      
      const hasEnoughForBacktest = dailyData.length > BACKTEST_DAYS + 30;
      const trainingEndIdx = hasEnoughForBacktest ? dailyData.length - BACKTEST_DAYS : dailyData.length;
      const trainingData = dailyData.slice(0, trainingEndIdx);
      const backtestData = hasEnoughForBacktest ? dailyData.slice(trainingEndIdx) : [];

      logs.push(`Training days: ${trainingData.length}, Backtest days: ${backtestData.length}`);

      // ============================================
      // STEP 6: Fit Linear Regression on training data
      // ============================================
      const regressionInput = trainingData.map(d => ({ x: d.t, y: d.sales }));
      const trend = linearRegression(regressionInput);
      
      logs.push(`Trend: slope=${trend.slope.toFixed(2)}, intercept=${trend.intercept.toFixed(0)}, R²=${trend.rSquared.toFixed(3)}`);

      // ============================================
      // STEP 7: Calculate Monthly Seasonal Index
      // ============================================
      const monthSI = calculateMonthlySeasonalIndex(trainingData, trend);
      const siString = Object.entries(monthSI)
        .filter(([_, v]) => v !== 0)
        .map(([m, v]) => `M${m}:${(v * 100).toFixed(0)}%`)
        .join(", ");
      logs.push(`Monthly SI: ${siString || "none detected"}`);

      // ============================================
      // STEP 8: Backtest if we have holdout data
      // ============================================
      if (backtestData.length > 0) {
        const actualBacktest = backtestData.map(d => d.sales);
        const predictedBacktest = backtestData.map(d => {
          const trendValue = trend.slope * d.t + trend.intercept;
          const si = monthSI[d.month] || 0;
          return Math.max(0, trendValue * (1 + si));
        });

        const metrics = calculateMetrics(actualBacktest, predictedBacktest);
        mse = Math.round(metrics.mse);
        mape = Math.round(metrics.mape * 1000) / 1000; // 3 decimal places
        confidence = calculateConfidence(mape, dailyData.length);

        logs.push(`Backtest MSE=${mse.toFixed(0)}, MAPE=${(mape * 100).toFixed(1)}%, Confidence=${confidence}%`);
      } else {
        // If no backtest possible, assign low confidence
        confidence = Math.min(40, Math.round((dailyData.length / 90) * 40));
        logs.push(`No backtest data, confidence=${confidence}%`);
      }

      // ============================================
      // STEP 9: Get labor metrics for planning
      // ============================================
      
      // Get SPLH from pos_daily_metrics (last 8 weeks)
      const splhStart = new Date(today);
      splhStart.setDate(splhStart.getDate() - 56);
      
      const { data: laborData } = await supabase
        .from("pos_daily_metrics")
        .select("net_sales, labor_hours")
        .eq("location_id", location.id)
        .gte("date", splhStart.toISOString().split("T")[0])
        .lt("date", todayStr);

      let splh = 80; // Default €80/hour
      if (laborData && laborData.length > 0) {
        let totalSales = 0;
        let totalHours = 0;
        laborData.forEach((row: any) => {
          totalSales += Number(row.net_sales) || 0;
          totalHours += Number(row.labor_hours) || 0;
        });
        if (totalHours > 0) {
          splh = totalSales / totalHours;
        }
      }

      // Get blended hourly cost from employees
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

      logs.push(`SPLH=€${splh.toFixed(0)}/h, Blended cost=€${blendedHourlyCost.toFixed(2)}/h`);

      // ============================================
      // STEP 10: Generate 365-day forecast
      // ============================================
      const forecasts: any[] = [];
      const lastT = dailyData.length;
      const auditForecasts: { date: string; forecast: number }[] = [];

      for (let k = 1; k <= horizonDays; k++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + k);
        const dateStr = forecastDate.toISOString().split("T")[0];
        const month = forecastDate.getMonth() + 1;
        const t = lastT + k;

        // Calculate forecast: trend * (1 + SI)
        const trendValue = trend.slope * t + trend.intercept;
        const si = monthSI[month] || 0;
        let forecastSales = trendValue * (1 + si);
        
        // Sanity check: clamp to reasonable range based on historical P1/P99
        const minForecast = Math.max(0, p1 * 0.5);
        const maxForecast = p99 * 2;
        forecastSales = Math.max(minForecast, Math.min(maxForecast, forecastSales));
        forecastSales = Math.round(forecastSales * 100) / 100;

        // Derive labor hours using SPLH
        let plannedLaborHours = splh > 0 ? forecastSales / splh : forecastSales * 0.22 / blendedHourlyCost;
        plannedLaborHours = Math.max(MIN_LABOR_HOURS_PER_DAY, Math.min(MAX_LABOR_HOURS_PER_DAY, plannedLaborHours));
        plannedLaborHours = Math.round(plannedLaborHours * 10) / 10;

        // Calculate cost
        let plannedLaborCost = plannedLaborHours * blendedHourlyCost;
        
        // Soft adjustment towards target COL% 22%
        const currentCol = forecastSales > 0 ? (plannedLaborCost / forecastSales) * 100 : 0;
        if (currentCol > TARGET_COL_PERCENT + 5) {
          // Too expensive, reduce hours (but respect minimum)
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
          model_version: MODEL_VERSION,
          mse,
          mape,
          confidence,
          generated_at: new Date().toISOString(),
        });

        // Track for audit (first 30 days)
        if (k <= 30) {
          auditForecasts.push({ date: dateStr, forecast: forecastSales });
        }
      }

      // ============================================
      // STEP 11: Audit checks
      // ============================================
      const audit: AuditResult = {
        p50_historical: Math.round(p50),
        p90_historical: Math.round(p90),
        p50_forecast_30d: Math.round(percentile(auditForecasts.map(f => f.forecast), 50)),
        avg_forecast_30d: Math.round(auditForecasts.reduce((s, f) => s + f.forecast, 0) / auditForecasts.length),
        top10_forecast_days: auditForecasts
          .sort((a, b) => b.forecast - a.forecast)
          .slice(0, 10)
          .map(f => ({ date: f.date, forecast: Math.round(f.forecast) })),
        future_days_count: horizonDays,
        flags: []
      };

      // Flag: MIXED_LOCATIONS_SUSPECTED if forecast > 3 * P90
      const maxForecast30d = Math.max(...auditForecasts.map(f => f.forecast));
      if (maxForecast30d > 3 * p90) {
        audit.flags.push("MIXED_LOCATIONS_SUSPECTED");
        logs.push(`⚠️ WARNING: Max forecast (${maxForecast30d.toFixed(0)}) > 3*P90 (${(3 * p90).toFixed(0)})`);
      }

      // Flag: Data quality check
      if (dailyData.length < 30) {
        audit.flags.push("INSUFFICIENT_HISTORY");
        logs.push("⚠️ WARNING: Less than 30 days of history");
      }

      logs.push(`Audit: Hist P50=${audit.p50_historical}, P90=${audit.p90_historical}, Forecast avg=${audit.avg_forecast_30d}`);
      
      console.log(`[FORECAST v2] ${location.name} audit:`, JSON.stringify(audit, null, 2));

      // ============================================
      // STEP 12: Upsert forecasts
      // ============================================
      const batchSize = 500;
      for (let i = 0; i < forecasts.length; i += batchSize) {
        const batch = forecasts.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from("forecast_daily_metrics")
          .upsert(batch, { onConflict: "location_id,date", ignoreDuplicates: false });

        if (upsertError) {
          console.error(`[FORECAST v2] Upsert error:`, upsertError.message);
          logs.push(`ERROR upserting batch: ${upsertError.message}`);
        }
      }

      // ============================================
      // STEP 13: Log model run
      // ============================================
      const { error: logError } = await supabase
        .from("forecast_model_runs")
        .insert({
          location_id: location.id,
          model_version: MODEL_VERSION,
          algorithm: 'linear_regression_monthly_seasonal',
          history_start: minDateStr,
          history_end: maxDateStr,
          horizon_days: horizonDays,
          mse,
          mape,
          confidence,
          data_points: dailyData.length,
          trend_slope: trend.slope,
          trend_intercept: trend.intercept,
          seasonality_dow: null, // Not using DOW in v2
          seasonality_woy: monthSI, // Store monthly SI here
        });

      if (logError) {
        console.warn(`[FORECAST v2] Log error:`, logError.message);
      }

      logs.push(`Generated ${forecasts.length} forecast days`);

      results.push({
        location_id: location.id,
        location_name: location.name,
        model_version: MODEL_VERSION,
        forecasts_generated: forecasts.length,
        data_points: dailyData.length,
        trend: { slope: trend.slope, intercept: trend.intercept, r_squared: trend.rSquared },
        monthly_si: monthSI,
        mse,
        mape_percent: Math.round(mape * 1000) / 10,
        confidence,
        splh: Math.round(splh),
        blended_hourly_cost: Math.round(blendedHourlyCost * 100) / 100,
        audit,
        logs,
      });

      console.log(`[FORECAST v2] ${location.name}: ${forecasts.length} days, MAPE=${(mape * 100).toFixed(1)}%, Conf=${confidence}%`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        model_version: MODEL_VERSION,
        algorithm: "Linear Regression + Monthly Seasonal Index",
        horizon_days: horizonDays,
        target_col_percent: TARGET_COL_PERCENT,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v2] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
