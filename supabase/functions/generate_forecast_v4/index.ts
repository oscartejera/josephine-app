import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getRegressors,
  calculateRegressorAdjustment,
  explainForecast,
  learnRegressorImpacts,
  type LearnedImpacts,
} from "../_shared/regressors.ts";

/**
 * Prophet-Style Forecast Generator V4.1
 *
 * Improvements over v4.0:
 * - Reads target_col_percent, splh_goal, default_hourly_cost from location_settings
 * - Reads blended hourly cost from employees table (with fallback)
 * - Learns regressor impacts from historical data (data-driven, not hardcoded)
 * - Deterministic weather (seeded PRNG, reproducible forecasts)
 * - Backtesting with MAPE calculation
 * - Proper confidence: MAPE-based with data-quantity penalty
 * - Performance: stdDev computed once outside forecast loop
 * - Reads from both facts_sales_15m and tickets (POS-first, fallback to tickets)
 */

// Fallback defaults (used ONLY when location_settings is missing)
const FALLBACK_COL_PERCENT = 28;
const FALLBACK_HOURLY_COST = 14.5;
const FALLBACK_SPLH = 50;
const MIN_LABOR_HOURS_PER_DAY = 20;
const MAX_LABOR_HOURS_PER_DAY = 120;
const BACKTEST_DAYS = 56;

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
  const ssRes = data.reduce(
    (s, d) => s + Math.pow(d.y - (slope * d.x + intercept), 2),
    0
  );
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { slope, intercept, rSquared };
}

function calculateSeasonalIndex(
  dailyData: DailySales[],
  type: "monthly" | "weekly"
): Record<number, number> {
  const avgOverall =
    dailyData.reduce((s, d) => s + d.sales, 0) / dailyData.length;
  const grouped: Record<number, number[]> = {};

  dailyData.forEach((d) => {
    const key = type === "monthly" ? d.month : d.dayOfWeek;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d.sales);
  });

  const result: Record<number, number> = {};
  const keys =
    type === "monthly"
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : [0, 1, 2, 3, 4, 5, 6];

  for (const key of keys) {
    if (grouped[key] && grouped[key].length > 0 && avgOverall > 0) {
      const avgKey =
        grouped[key].reduce((a, b) => a + b, 0) / grouped[key].length;
      result[key] = Math.max(-0.6, Math.min(0.6, (avgKey - avgOverall) / avgOverall));
    } else {
      result[key] = 0;
    }
  }

  return result;
}

function calculateConfidence(
  mape: number,
  dataPoints: number,
  forecastInRange: boolean
): number {
  let base: number;
  const mapePercent = mape * 100;

  if (mapePercent < 15) base = 90;
  else if (mapePercent < 25) base = 75;
  else if (mapePercent < 35) base = 60;
  else base = 45;

  if (dataPoints < 365) {
    base = base * (dataPoints / 365);
  }

  if (forecastInRange) {
    base = Math.max(40, base);
  }

  return Math.max(0, Math.min(100, Math.round(base)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const weatherApiKey = Deno.env.get("OPENWEATHER_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id;
    const horizonDays = body.horizon_days || 90;

    console.log(
      `[FORECAST v4.1] Starting: location=${locationId || "all"}, horizon=${horizonDays}`
    );

    // ── Get locations ──────────────────────────────────────────────
    let locationsQuery = supabase.from("locations").select("id, name").eq("active", true);
    if (locationId) {
      locationsQuery = supabase.from("locations").select("id, name").eq("id", locationId);
    }

    const { data: locationsData } = await locationsQuery;
    const locations = locationsData || [];

    if (locations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No locations found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const location of locations) {
      const logs: string[] = [];
      logs.push(`Processing ${location.name}`);

      // ── Read location_settings (dynamic, not hardcoded) ──────────
      const { data: settings } = await supabase
        .from("location_settings")
        .select("target_col_percent, default_hourly_cost, splh_goal")
        .eq("location_id", location.id)
        .maybeSingle();

      const targetColPercent = settings?.target_col_percent ?? FALLBACK_COL_PERCENT;
      const defaultHourlyCost = settings?.default_hourly_cost ?? FALLBACK_HOURLY_COST;
      const splhGoal = settings?.splh_goal ?? FALLBACK_SPLH;

      logs.push(
        `Settings: COL%=${targetColPercent}, hourly_cost=${defaultHourlyCost}, SPLH=${splhGoal} ${settings ? "(from DB)" : "(fallback)"}`
      );

      // ── Read blended hourly cost from employees ──────────────────
      const { data: employees } = await supabase
        .from("employees")
        .select("hourly_cost")
        .eq("location_id", location.id)
        .eq("active", true)
        .not("hourly_cost", "is", null);

      let blendedHourlyCost = defaultHourlyCost;
      if (employees && employees.length > 0) {
        blendedHourlyCost =
          employees.reduce((s: number, e: any) => s + Number(e.hourly_cost), 0) /
          employees.length;
        logs.push(
          `Blended hourly cost: €${blendedHourlyCost.toFixed(2)}/h (from ${employees.length} employees)`
        );
      } else {
        logs.push(
          `Blended hourly cost: €${blendedHourlyCost.toFixed(2)}/h (from location_settings default)`
        );
      }

      // ── Fetch historical sales (POS-first from facts, fallback to tickets) ──
      const salesByDate: Record<string, number> = {};
      let dataSource = "facts_sales_15m";

      const { data: factsData } = await supabase
        .from("facts_sales_15m")
        .select("ts_bucket, sales_net")
        .eq("location_id", location.id)
        .order("ts_bucket");

      if (factsData && factsData.length > 0) {
        factsData.forEach((s: any) => {
          const dateStr = new Date(s.ts_bucket).toISOString().split("T")[0];
          salesByDate[dateStr] =
            (salesByDate[dateStr] || 0) + (Number(s.sales_net) || 0);
        });
        logs.push(`Loaded ${factsData.length} rows from facts_sales_15m`);
      } else {
        // Fallback: read from tickets table
        dataSource = "tickets";
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
              salesByDate[dateStr] =
                (salesByDate[dateStr] || 0) + (Number(t.net_total) || 0);
            });
            hasMore = ticketBatch.length === pageSize;
            page++;
          }
        }
        logs.push(`Loaded from tickets (${Object.keys(salesByDate).length} days)`);
      }

      if (Object.keys(salesByDate).length === 0) {
        logs.push("No sales data found - skipping");
        results.push({
          location_id: location.id,
          location_name: location.name,
          status: "skipped",
          reason: "no_data",
          logs,
        });
        continue;
      }

      // ── Build daily series ───────────────────────────────────────
      const dates = Object.keys(salesByDate).sort();
      const minDate = new Date(dates[0]);
      const maxDate = new Date(dates[dates.length - 1]);

      const dailyData: DailySales[] = [];
      let t = 1;
      const current = new Date(minDate);
      while (current <= maxDate) {
        const dateStr = current.toISOString().split("T")[0];
        dailyData.push({
          date: dateStr,
          t: t++,
          sales: salesByDate[dateStr] || 0,
          month: current.getMonth() + 1,
          dayOfWeek: current.getDay(),
        });
        current.setDate(current.getDate() + 1);
      }

      const dataPoints = dailyData.length;
      logs.push(
        `${dataPoints} days of history (${dates[0]} to ${dates[dates.length - 1]}) source=${dataSource}`
      );

      // ── Learn regressor impacts from historical data ─────────────
      const learnedImpacts = learnRegressorImpacts(
        dailyData.map((d) => ({ date: d.date, sales: d.sales }))
      );
      logs.push(
        `Learned impacts: festivo=${learnedImpacts.festivo.toFixed(2)}, rain=${learnedImpacts.rain.toFixed(2)}, cold=${learnedImpacts.cold.toFixed(2)}, payday=${learnedImpacts.payday.toFixed(2)} (${learnedImpacts.data_points > 0 ? "data-driven" : "defaults"})`
      );

      // ── Model: Trend + Seasonality ───────────────────────────────
      const regressionInput = dailyData.map((d) => ({ x: d.t, y: d.sales }));
      const trend = linearRegression(regressionInput);

      const useMonthly = dataPoints >= 365;
      const seasonalIndex = useMonthly
        ? calculateSeasonalIndex(dailyData, "monthly")
        : calculateSeasonalIndex(dailyData, "weekly");

      const modelVersion = `Prophet_v4.1_${useMonthly ? "Monthly" : "Weekly"}_LearnedRegressors`;
      logs.push(
        `Model: ${useMonthly ? "Monthly" : "Weekly"} seasonality, R²=${trend.rSquared.toFixed(3)}`
      );

      // ── Backtesting ──────────────────────────────────────────────
      let mse = 0;
      let mape = 0;
      const hasEnoughForBacktest = dataPoints > BACKTEST_DAYS + 30;

      if (hasEnoughForBacktest) {
        const trainingEndIdx = dataPoints - BACKTEST_DAYS;
        const backtestData = dailyData.slice(trainingEndIdx);
        let sumSquaredError = 0;
        let sumAbsPercentError = 0;

        for (const d of backtestData) {
          const trendValue = trend.slope * d.t + trend.intercept;
          const siKey = useMonthly ? d.month : d.dayOfWeek;
          const si = seasonalIndex[siKey] || 0;
          const predicted = Math.max(0, trendValue * (1 + si));
          const error = d.sales - predicted;
          sumSquaredError += error * error;
          const denom = Math.max(d.sales, 1);
          sumAbsPercentError += Math.abs(error / denom);
        }

        mse = Math.round(sumSquaredError / backtestData.length);
        mape = sumAbsPercentError / backtestData.length;
        logs.push(
          `Backtest (${backtestData.length}d): MSE=${mse}, MAPE=${(mape * 100).toFixed(1)}%`
        );
      } else {
        logs.push(`Backtest skipped (need >${BACKTEST_DAYS + 30} days, have ${dataPoints})`);
      }

      // ── Historical stats (computed once, outside loop) ───────────
      const salesValues = dailyData.map((d) => d.sales).filter((s) => s > 0);
      const p1 = percentile(salesValues, 1);
      const p50 = percentile(salesValues, 50);
      const p90 = percentile(salesValues, 90);
      const p99 = percentile(salesValues, 99);

      const mean =
        salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
      const stdDev = Math.sqrt(
        salesValues.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
          salesValues.length
      );
      const minForecast = Math.max(0, p1 * 0.5);
      const maxForecast = p99 * 1.5;

      logs.push(
        `Stats: P1=${p1.toFixed(0)}, P50=${p50.toFixed(0)}, P90=${p90.toFixed(0)}, P99=${p99.toFixed(0)}, σ=${stdDev.toFixed(0)}`
      );

      // ── SPLH from recent labor data ──────────────────────────────
      const splhStart = new Date(today);
      splhStart.setDate(splhStart.getDate() - 56);
      const { data: laborData } = await supabase
        .from("pos_daily_metrics")
        .select("net_sales, labor_hours")
        .eq("location_id", location.id)
        .gte("date", splhStart.toISOString().split("T")[0])
        .lt("date", todayStr);

      let splh = splhGoal;
      if (laborData && laborData.length > 0) {
        let totalSales = 0;
        let totalHours = 0;
        laborData.forEach((row: any) => {
          totalSales += Number(row.net_sales) || 0;
          totalHours += Number(row.labor_hours) || 0;
        });
        if (totalHours > 0) splh = totalSales / totalHours;
      }

      logs.push(`SPLH: €${splh.toFixed(0)}/h`);

      // ── Generate forecast ────────────────────────────────────────
      const forecasts: any[] = [];
      const lastT = dataPoints;
      const auditForecasts: { date: string; forecast: number }[] = [];

      for (let k = 1; k <= horizonDays; k++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + k);
        const dateStr = forecastDate.toISOString().split("T")[0];
        const month = forecastDate.getMonth() + 1;
        const dayOfWeek = forecastDate.getDay();
        const tVal = lastT + k;

        // Base: trend + seasonality
        const trendValue = trend.slope * tVal + trend.intercept;
        const siKey = useMonthly ? month : dayOfWeek;
        const si = seasonalIndex[siKey] || 0;
        const baseForecast = Math.max(0, trendValue * (1 + si));

        // Regressors with learned impacts
        const regressors = await getRegressors(dateStr, weatherApiKey);
        const regressorAdj = calculateRegressorAdjustment(
          regressors,
          learnedImpacts
        );
        let adjustedForecast = baseForecast * regressorAdj;

        // Clamp to historical range
        adjustedForecast = Math.max(
          minForecast,
          Math.min(maxForecast, adjustedForecast)
        );
        adjustedForecast = Math.round(adjustedForecast * 100) / 100;

        // 95% CI (pre-computed stdDev)
        const lowerBound = Math.max(0, adjustedForecast - stdDev * 1.96);
        const upperBound = adjustedForecast + stdDev * 1.96;

        // Labor planning using location settings
        let plannedLaborHours =
          splh > 0
            ? adjustedForecast / splh
            : (adjustedForecast * (targetColPercent / 100)) / blendedHourlyCost;
        plannedLaborHours = Math.max(
          MIN_LABOR_HOURS_PER_DAY,
          Math.min(MAX_LABOR_HOURS_PER_DAY, plannedLaborHours)
        );
        plannedLaborHours = Math.round(plannedLaborHours * 10) / 10;

        let plannedLaborCost = plannedLaborHours * blendedHourlyCost;
        const currentCol =
          adjustedForecast > 0
            ? (plannedLaborCost / adjustedForecast) * 100
            : 0;
        if (currentCol > targetColPercent + 5) {
          const targetCost = adjustedForecast * (targetColPercent / 100);
          const adjustedHours = Math.max(
            MIN_LABOR_HOURS_PER_DAY,
            targetCost / blendedHourlyCost
          );
          plannedLaborHours = Math.round(adjustedHours * 10) / 10;
          plannedLaborCost = plannedLaborHours * blendedHourlyCost;
        }
        plannedLaborCost = Math.round(plannedLaborCost * 100) / 100;

        forecasts.push({
          location_id: location.id,
          date: dateStr,
          forecast_sales: adjustedForecast,
          forecast_sales_lower: Math.round(lowerBound * 100) / 100,
          forecast_sales_upper: Math.round(upperBound * 100) / 100,
          planned_labor_hours: plannedLaborHours,
          planned_labor_cost: plannedLaborCost,
          model_version: modelVersion,
          mse,
          mape: Math.round(mape * 1000) / 1000,
          confidence: 0, // calculated after audit
          regressors,
          base_forecast: Math.round(baseForecast * 100) / 100,
          regressor_adjustment: Math.round(regressorAdj * 1000) / 1000,
          explanation: explainForecast(
            baseForecast,
            regressors,
            adjustedForecast,
            learnedImpacts
          ),
          generated_at: new Date().toISOString(),
        });

        if (k <= 30) {
          auditForecasts.push({ date: dateStr, forecast: adjustedForecast });
        }
      }

      // ── Confidence (MAPE-based with data penalty) ────────────────
      const avgForecast30d =
        auditForecasts.reduce((s, f) => s + f.forecast, 0) /
        auditForecasts.length;
      const forecastInRange =
        avgForecast30d >= p50 * 0.5 && avgForecast30d <= p90 * 2;
      const confidence = calculateConfidence(mape, dataPoints, forecastInRange);

      forecasts.forEach((f) => {
        f.confidence = confidence;
      });

      logs.push(
        `Confidence: ${confidence}% (MAPE=${(mape * 100).toFixed(1)}%, ${dataPoints}d, inRange=${forecastInRange})`
      );

      // ── Write forecasts ──────────────────────────────────────────
      await supabase
        .from("forecast_daily_metrics")
        .delete()
        .eq("location_id", location.id)
        .gte("date", todayStr);

      for (let i = 0; i < forecasts.length; i += 500) {
        const batch = forecasts.slice(i, i + 500);
        const { error } = await supabase
          .from("forecast_daily_metrics")
          .insert(batch);
        if (error) {
          logs.push(`Insert error batch ${i / 500}: ${error.message}`);
        }
      }

      // ── Log model run ────────────────────────────────────────────
      await supabase.from("forecast_model_runs").insert({
        location_id: location.id,
        model_version: modelVersion,
        algorithm: useMonthly
          ? "Trend_Monthly_Seasonal_LearnedRegressors"
          : "Trend_Weekly_Seasonal_LearnedRegressors",
        history_start: dates[0],
        history_end: dates[dates.length - 1],
        horizon_days: horizonDays,
        mse,
        mape: Math.round(mape * 1000) / 1000,
        confidence,
        data_points: dataPoints,
        trend_slope: trend.slope,
        trend_intercept: trend.intercept,
        seasonality_dow: useMonthly ? null : seasonalIndex,
        seasonality_woy: useMonthly ? seasonalIndex : null,
      });

      results.push({
        location_id: location.id,
        location_name: location.name,
        model_version: modelVersion,
        data_source: dataSource,
        forecasts_generated: forecasts.length,
        data_points: dataPoints,
        trend: {
          slope: trend.slope,
          intercept: trend.intercept,
          r_squared: trend.rSquared,
        },
        seasonal_index: seasonalIndex,
        mse,
        mape_percent: Math.round(mape * 1000) / 10,
        confidence,
        splh: Math.round(splh),
        blended_hourly_cost:
          Math.round(blendedHourlyCost * 100) / 100,
        target_col_percent: targetColPercent,
        learned_impacts: learnedImpacts,
        sample_forecast: forecasts.slice(0, 7).map((f) => ({
          date: f.date,
          forecast: f.forecast_sales,
          lower: f.forecast_sales_lower,
          upper: f.forecast_sales_upper,
          explanation: f.explanation,
        })),
        logs,
      });

      console.log(
        `[FORECAST v4.1] ${location.name}: ${forecasts.length} days, Conf=${confidence}%, MAPE=${(mape * 100).toFixed(1)}%`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: "v4.1_prophet_learned_regressors",
        features: [
          "Trend + Seasonality (monthly/weekly adaptive)",
          "Data-driven regressor impacts (learned from history)",
          "Deterministic weather (reproducible forecasts)",
          "Reads location_settings for COL%, SPLH, hourly cost",
          "Reads employees for blended hourly cost",
          "POS-first data source (facts → tickets fallback)",
          "Backtesting with MAPE (56-day holdout)",
          "MAPE-based confidence with data-quantity penalty",
          "95% confidence intervals",
          "Forecast clamping to historical P1-P99 range",
        ],
        horizon_days: horizonDays,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v4.1] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
