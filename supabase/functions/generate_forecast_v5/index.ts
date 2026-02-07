import { corsHeaders } from "../_shared/cors.ts";

/**
 * Forecast V5 — Prophet Proxy
 *
 * This Edge Function acts as a lightweight proxy that triggers the external
 * Python Prophet microservice. The actual forecasting runs in the Python
 * service (Railway/Fly.io) which has access to Prophet, numpy, pandas.
 *
 * Usage:
 *   POST /functions/v1/generate_forecast_v5
 *   Body: { "location_id": "uuid" | null, "horizon_days": 90, "sync": false }
 *
 * Environment:
 *   FORECAST_SERVICE_URL — URL of the Python forecast service (e.g. https://josephine-forecast.up.railway.app)
 *   FORECAST_API_KEY     — Optional API key for the forecast service
 */

const FORECAST_SERVICE_URL = Deno.env.get("FORECAST_SERVICE_URL") || "http://localhost:8000";
const FORECAST_API_KEY = Deno.env.get("FORECAST_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id || null;
    const horizonDays = body.horizon_days || 90;
    const sync = body.sync || false;

    console.log(
      `[FORECAST v5] Calling Prophet service: location=${locationId || "all"}, ` +
      `horizon=${horizonDays}, sync=${sync}`
    );

    // Choose endpoint: /forecast/sync for blocking, /forecast for background
    const endpoint = sync ? "/forecast/sync" : "/forecast";
    const url = `${FORECAST_SERVICE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (FORECAST_API_KEY) {
      headers["Authorization"] = `Bearer ${FORECAST_API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        location_id: locationId,
        horizon_days: horizonDays,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FORECAST v5] Prophet service error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `Prophet service returned ${response.status}`,
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    console.log(`[FORECAST v5] Prophet service responded:`, result.status || "ok");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORECAST v5] Error:", message);

    // If the Prophet service is unreachable, return a helpful error
    if (message.includes("ConnectionRefused") || message.includes("fetch")) {
      return new Response(
        JSON.stringify({
          error: "Prophet forecast service is not reachable",
          hint: `Ensure the service is running at ${FORECAST_SERVICE_URL}. ` +
                `Set FORECAST_SERVICE_URL in Supabase Edge Function secrets.`,
          service_url: FORECAST_SERVICE_URL,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
