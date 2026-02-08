import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Prophet V5 - Real Python Prophet ML Integration
 *
 * This edge function delegates ALL heavy work to the Python Prophet service:
 * 1. Fetches locations from Supabase
 * 2. Calls the Python Prophet service's /forecast_supabase endpoint
 *    (which handles data fetch, model fitting, and result storage)
 * 3. Returns the combined results
 *
 * The Python service on Render has no 60s timeout limit, so it can
 * handle 365+ days of data without issues.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prophetServiceUrl = Deno.env.get("PROPHET_SERVICE_URL");
    const prophetApiKey = Deno.env.get("PROPHET_API_KEY") || "";

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

    console.log(`[FORECAST v5] Prophet ML: location=${locationId || "all"}, horizon=${horizonDays}`);

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

    // ── Process each location via Python service ─────────────────────────
    const results: Record<string, unknown>[] = [];

    for (const location of locations) {
      console.log(`[FORECAST v5] Delegating ${location.name} to Python service...`);

      try {
        const prophetHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (prophetApiKey) {
          prophetHeaders["Authorization"] = `Bearer ${prophetApiKey}`;
        }

        const prophetRes = await fetch(`${prophetServiceUrl}/forecast_supabase`, {
          method: "POST",
          headers: prophetHeaders,
          body: JSON.stringify({
            supabase_url: supabaseUrl,
            supabase_key: supabaseKey,
            location_id: location.id,
            location_name: location.name,
            horizon_days: horizonDays,
            seasonality_mode: seasonalityMode,
            changepoint_prior_scale: changepointPriorScale,
          }),
        });

        if (!prophetRes.ok) {
          const errText = await prophetRes.text();
          console.error(`[FORECAST v5] Error for ${location.name}: ${errText}`);
          results.push({
            location_id: location.id,
            location_name: location.name,
            error: `Prophet returned ${prophetRes.status}: ${errText.slice(0, 300)}`,
          });
          continue;
        }

        const result = await prophetRes.json();
        console.log(`[FORECAST v5] ${location.name}: ${result.data_points} days, ${result.forecasts_stored} forecasts stored`);

        results.push({
          location_id: location.id,
          location_name: location.name,
          model: "Prophet_v5_Real_ML",
          engine: "Facebook Prophet (Python)",
          data_points: result.data_points,
          forecasts_generated: result.forecasts_stored,
          metrics: result.metrics,
          confidence: Math.round(parseFloat(result.metrics.r_squared) * 100),
          sample_forecast: result.sample_forecast,
        });
      } catch (err) {
        console.error(`[FORECAST v5] Exception for ${location.name}:`, err);
        results.push({
          location_id: location.id,
          location_name: location.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
