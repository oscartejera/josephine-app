/**
 * auto_retrain — Checks forecast accuracy and auto-retrains when MAPE drifts
 *
 * Intended to run on a cron schedule (every 6 hours).
 * Checks forecast_model_runs for latest MAPE per location.
 * If MAPE > 15% (0.15), triggers generate_forecast_v4 for that location.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MAPE_THRESHOLD = 0.15; // 15% — retrain if worse
const MIN_HOURS_BETWEEN_RETRAINS = 12; // Don't retrain too frequently

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        console.log("[AUTO_RETRAIN] Starting MAPE drift check...");

        // Get all active locations
        const { data: locations } = await supabase
            .from("locations")
            .select("id, name")
            .eq("active", true);

        if (!locations || locations.length === 0) {
            return new Response(
                JSON.stringify({ message: "No active locations", retrained: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const retrained: string[] = [];
        const skipped: { id: string; name: string; reason: string; mape?: number }[] = [];

        for (const loc of locations) {
            // Get latest forecast model run for this location
            const { data: latestRun } = await supabase
                .from("forecast_model_runs")
                .select("id, mape, confidence, created_at, model_version")
                .eq("location_id", loc.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!latestRun) {
                skipped.push({ id: loc.id, name: loc.name, reason: "no_model_run" });
                continue;
            }

            const mape = Number(latestRun.mape) || 0;
            const hoursAgo = (Date.now() - new Date(latestRun.created_at).getTime()) / (1000 * 60 * 60);

            // Skip if recently retrained
            if (hoursAgo < MIN_HOURS_BETWEEN_RETRAINS) {
                skipped.push({
                    id: loc.id,
                    name: loc.name,
                    reason: `retrained_${Math.round(hoursAgo)}h_ago`,
                    mape: Math.round(mape * 1000) / 10,
                });
                continue;
            }

            // Check if MAPE exceeds threshold
            if (mape > MAPE_THRESHOLD) {
                console.log(
                    `[AUTO_RETRAIN] ${loc.name}: MAPE=${(mape * 100).toFixed(1)}% > ${MAPE_THRESHOLD * 100}% → TRIGGERING RETRAIN`
                );

                // Trigger generate_forecast_v4 for this location
                try {
                    const { error: invokeError } = await supabase.functions.invoke(
                        "generate_forecast_v4",
                        {
                            body: { location_id: loc.id, horizon_days: 90 },
                        }
                    );

                    if (invokeError) {
                        console.error(`[AUTO_RETRAIN] Failed to retrain ${loc.name}:`, invokeError);
                        skipped.push({
                            id: loc.id,
                            name: loc.name,
                            reason: `invoke_failed: ${invokeError.message}`,
                            mape: Math.round(mape * 1000) / 10,
                        });
                    } else {
                        retrained.push(loc.name);
                        console.log(`[AUTO_RETRAIN] ${loc.name}: Retrain triggered successfully`);
                    }
                } catch (err) {
                    console.error(`[AUTO_RETRAIN] Error invoking for ${loc.name}:`, err);
                    skipped.push({
                        id: loc.id,
                        name: loc.name,
                        reason: `error: ${err instanceof Error ? err.message : "unknown"}`,
                        mape: Math.round(mape * 1000) / 10,
                    });
                }
            } else {
                skipped.push({
                    id: loc.id,
                    name: loc.name,
                    reason: "mape_ok",
                    mape: Math.round(mape * 1000) / 10,
                });
            }
        }

        const result = {
            timestamp: new Date().toISOString(),
            threshold_mape_percent: MAPE_THRESHOLD * 100,
            locations_checked: locations.length,
            retrained,
            skipped,
        };

        console.log(`[AUTO_RETRAIN] Done: ${retrained.length} retrained, ${skipped.length} skipped`);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[AUTO_RETRAIN] Error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
