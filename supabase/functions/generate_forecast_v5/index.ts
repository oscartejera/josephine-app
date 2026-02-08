import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getRegressors, explainForecast } from "../_shared/regressors.ts";

/**
 * Prophet V5 - Real Python Prophet ML Integration
 *
 * This edge function:
 * 1. Fetches historical sales from Supabase
 * 2. Builds regressor values for history + future
 * 3. Sends everything to the Python Prophet service
 * 4. Stores the ML-generated forecast back into forecast_daily_metrics
 *
 * Requires env var: PROPHET_SERVICE_URL (e.g. https://josephine-prophet-xyz.run.app)
 * Optional env var: PROPHET_API_KEY
 */

const TARGET_COL_PERCENT = 28;
const MIN_LABOR_HOURS_PER_DAY = 20;
const MAX_LABOR_HOURS_PER_DAY = 120;
const AVG_HOURLY_RATE = 14.5;

interface ProphetForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  trend: number;
  weekly: number | null;
  yearly: number | null;
  regressor_total: number;
  explanation: string;
}

interface ProphetResponse {
  success: boolean;
  model_version: string;
  location_id: string;
  location_name: string;
  metrics: {
    mape: number;
    rmse: number;
    mae: number;
    r_squared: number;
    data_points: number;
    changepoints: number;
    trend_slope_avg: number;
  };
  forecast: ProphetForecastPoint[];
  components: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prophetServiceUrl = Deno.env.get("PROPHET_SERVICE_URL");
    const prophetApiKey = Deno.env.get("PROPHET_API_KEY") || "";
    const weatherApiKey = Deno.env.get("OPENWEATHER_API_KEY");

    if (!prophetServiceUrl) {
      return new Response(
        JSON.stringify({
          error: "PROPHET_SERVICE_URL not configured",
          help: "Set the PROPHET_SERVICE_URL env var to your deployed Python Prophet service URL",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id;
    const horizonDays = body.horizon_days || 90;
    const seasonalityMode = body.seasonality_mode || "multiplicative";
    const changepointPriorScale = body.changepoint_prior_scale || 0.05;

    console.log(`[FORECAST v5] Real Prophet ML: location=${locationId || "all"}, horizon=${horizonDays}`);

    // ── Get locations ────────────────────────────────────────────────────
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

    // ── Health check on Prophet service ───────────────────────────────────
    try {
      const healthRes = await fetch(`${prophetServiceUrl}/health`);
      if (!healthRes.ok) {
        throw new Error(`Prophet service returned ${healthRes.status}`);
      }
      const healthData = await healthRes.json();
      console.log(`[FORECAST v5] Prophet service healthy: ${JSON.stringify(healthData)}`);
    } catch (healthErr) {
      return new Response(
        JSON.stringify({
          error: "Prophet service unreachable",
          details: healthErr instanceof Error ? healthErr.message : "Unknown",
          url: prophetServiceUrl,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown>[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const location of locations) {
      console.log(`[FORECAST v5] Processing ${location.name}...`);

      // ── Fetch historical sales ───────────────────────────────────────
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
      salesData.forEach((s: { ts_bucket: string; sales_net: number }) => {
        const dateStr = new Date(s.ts_bucket).toISOString().split("T")[0];
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (Number(s.sales_net) || 0);
      });

      const dates = Object.keys(salesByDate).sort();
      if (dates.length < 14) {
        console.log(`${location.name}: only ${dates.length} days, need 14+. Skipping.`);
        continue;
      }

      // ── Build historical data with regressors ────────────────────────
      const historical: Record<string, unknown>[] = [];

      for (const dateStr of dates) {
        const regs = await getRegressors(dateStr, weatherApiKey);
        historical.push({
          ds: dateStr,
          y: salesByDate[dateStr],
          festivo: regs.festivo,
          day_before_festivo: regs.day_before_festivo,
          evento_impact: regs.evento_impact,
          payday: regs.payday,
          temperatura: regs.temperatura,
          rain: regs.rain,
          cold_day: regs.cold_day,
          weekend: regs.weekend,
          mid_week: regs.mid_week,
        });
      }

      // ── Build future regressors ──────────────────────────────────────
      const futureRegressors: Record<string, unknown>[] = [];

      for (let k = 1; k <= horizonDays; k++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(today.getDate() + k);
        const dateStr = forecastDate.toISOString().split("T")[0];
        const regs = await getRegressors(dateStr, weatherApiKey);

        futureRegressors.push({
          ds: dateStr,
          festivo: regs.festivo,
          day_before_festivo: regs.day_before_festivo,
          evento_impact: regs.evento_impact,
          payday: regs.payday,
          temperatura: regs.temperatura,
          rain: regs.rain,
          cold_day: regs.cold_day,
          weekend: regs.weekend,
          mid_week: regs.mid_week,
        });
      }

      // ── Call Python Prophet service ──────────────────────────────────
      console.log(`[FORECAST v5] Calling Prophet API for ${location.name} (${dates.length} days history)...`);

      const prophetRequest = {
        historical,
        horizon_days: horizonDays,
        future_regressors: futureRegressors,
        location_id: location.id,
        location_name: location.name,
        freq: "D",
        yearly_seasonality: dates.length >= 365,
        weekly_seasonality: true,
        daily_seasonality: false,
        seasonality_mode: seasonalityMode,
        changepoint_prior_scale: changepointPriorScale,
        include_regressors: true,
      };

      const prophetHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (prophetApiKey) {
        prophetHeaders["Authorization"] = `Bearer ${prophetApiKey}`;
      }

      const prophetRes = await fetch(`${prophetServiceUrl}/forecast`, {
        method: "POST",
        headers: prophetHeaders,
        body: JSON.stringify(prophetRequest),
      });

      if (!prophetRes.ok) {
        const errText = await prophetRes.text();
        console.error(`[FORECAST v5] Prophet API error for ${location.name}: ${errText}`);
        results.push({
          location_id: location.id,
          location_name: location.name,
          error: `Prophet API returned ${prophetRes.status}: ${errText}`,
        });
        continue;
      }

      const prophetData: ProphetResponse = await prophetRes.json();
      console.log(
        `[FORECAST v5] Prophet returned ${prophetData.forecast.length} forecasts. ` +
        `MAPE=${(prophetData.metrics.mape * 100).toFixed(1)}%, R²=${prophetData.metrics.r_squared.toFixed(3)}`
      );

      // ── Store forecasts in Supabase ──────────────────────────────────
      const forecasts = prophetData.forecast.map((f) => {
        const targetLabourCost = f.yhat * (TARGET_COL_PERCENT / 100);
        const plannedLaborHours = Math.max(
          MIN_LABOR_HOURS_PER_DAY,
          Math.min(MAX_LABOR_HOURS_PER_DAY, targetLabourCost / AVG_HOURLY_RATE)
        );

        return {
          location_id: location.id,
          date: f.ds,
          forecast_sales: Math.round(f.yhat * 100) / 100,
          forecast_sales_lower: Math.round(f.yhat_lower * 100) / 100,
          forecast_sales_upper: Math.round(f.yhat_upper * 100) / 100,
          planned_labor_hours: Math.round(plannedLaborHours * 10) / 10,
          planned_labor_cost: Math.round(targetLabourCost * 100) / 100,
          model_version: "Prophet_v5_Real_ML",
          confidence: Math.round(prophetData.metrics.r_squared * 100),
          mape: prophetData.metrics.mape,
          mse: prophetData.metrics.rmse * prophetData.metrics.rmse,
          explanation: f.explanation,
          generated_at: new Date().toISOString(),
        };
      });

      // Delete existing forecasts for this location
      await supabase
        .from("forecast_daily_metrics")
        .delete()
        .eq("location_id", location.id)
        .gte("date", todayStr);

      // Insert in batches
      for (let i = 0; i < forecasts.length; i += 500) {
        const batch = forecasts.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from("forecast_daily_metrics")
          .insert(batch);

        if (insertErr) {
          console.error(`Insert error for ${location.name}:`, insertErr);
        }
      }

      // Log model run
      await supabase.from("forecast_model_runs").insert({
        location_id: location.id,
        model_version: "Prophet_v5_Real_ML",
        algorithm: "Facebook_Prophet_ML",
        history_start: dates[0],
        history_end: dates[dates.length - 1],
        horizon_days: horizonDays,
        mse: prophetData.metrics.rmse * prophetData.metrics.rmse,
        mape: prophetData.metrics.mape,
        confidence: Math.round(prophetData.metrics.r_squared * 100),
        data_points: dates.length,
        trend_slope: prophetData.metrics.trend_slope_avg,
        trend_intercept: 0,
        seasonality_dow: prophetData.components,
        seasonality_woy: null,
      });

      results.push({
        location_id: location.id,
        location_name: location.name,
        model: "Prophet_v5_Real_ML",
        engine: "Facebook Prophet (Python)",
        forecasts_generated: forecasts.length,
        data_points: dates.length,
        metrics: {
          mape: `${(prophetData.metrics.mape * 100).toFixed(1)}%`,
          rmse: prophetData.metrics.rmse.toFixed(0),
          mae: prophetData.metrics.mae.toFixed(0),
          r_squared: prophetData.metrics.r_squared.toFixed(3),
        },
        confidence: Math.round(prophetData.metrics.r_squared * 100),
        changepoints: prophetData.metrics.changepoints,
        components: prophetData.components,
        sample_forecast: prophetData.forecast.slice(0, 7).map((f) => ({
          date: f.ds,
          forecast: f.yhat,
          lower: f.yhat_lower,
          upper: f.yhat_upper,
          explanation: f.explanation,
        })),
      });

      console.log(`[FORECAST v5] ${location.name}: ${forecasts.length} days forecasted with real Prophet ML`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: "v5_prophet_real_ml",
        engine: "Facebook Prophet (Python)",
        features: [
          "Real Facebook Prophet ML model",
          "Automatic changepoint detection",
          "Bayesian uncertainty intervals (95%)",
          "Multiplicative & additive seasonality",
          "9 external regressors (weather, events, holidays)",
          "Cross-validation metrics (MAPE, RMSE, MAE, R²)",
          "Custom monthly seasonality (Fourier order 5)",
        ],
        horizon_days: horizonDays,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v5] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
