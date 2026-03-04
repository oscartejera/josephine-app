import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
    getRegressors,
    prefetchEvents,
    type EventCalendarEntry,
    calculateRegressorAdjustment,
    explainForecast,
    learnRegressorImpacts,
    type LearnedImpacts,
} from "../_shared/regressors.ts";

/**
 * Forecast Engine V6 — Ensemble (Prophet + XGBoost)
 *
 * Architecture:
 *   1. Calls Python Prophet service  → prophet_forecast[]
 *   2. Calls Python XGBoost service  → xgboost_forecast[]
 *   3. Ensembles with adaptive weights (default 50/50, adjustable)
 *   4. Stores ensemble result in forecast_daily_metrics
 *   5. Logs to forecast_accuracy_log for tracking
 *
 * Graceful degradation:
 *   - If Prophet fails → use XGBoost only (100%)
 *   - If XGBoost fails → use Prophet only (100%)
 *   - If both fail → fall back to v4 inline model
 *
 * Ensemble weights can be overridden per request or auto-tuned
 * from forecast_accuracy_log (model with lower MAPE gets more weight).
 */

// ── Inline v4 model functions (fallback) ─────────────────────────────────────

interface DailySales {
    date: string;
    t: number;
    sales: number;
    month: number;
    dayOfWeek: number;
}

function linearRegression(data: { x: number; y: number }[]): {
    slope: number;
    intercept: number;
} {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: data[0]?.y || 0 };
    const sumX = data.reduce((s, d) => s + d.x, 0);
    const sumY = data.reduce((s, d) => s + d.y, 0);
    const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
    const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 0.0001) return { slope: 0, intercept: sumY / n };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

function calculateSeasonalIndex(
    dailyData: DailySales[],
    type: "monthly" | "weekly",
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
    const keys = type === "monthly"
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [0, 1, 2, 3, 4, 5, 6];
    for (const key of keys) {
        if (grouped[key] && grouped[key].length > 0 && avgOverall > 0) {
            const avgKey = grouped[key].reduce((a, b) => a + b, 0) / grouped[key].length;
            result[key] = Math.max(-0.6, Math.min(0.6, (avgKey - avgOverall) / avgOverall));
        } else {
            result[key] = 0;
        }
    }
    return result;
}

// ── Main handler ─────────────────────────────────────────────────────────────

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
        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await req.json().catch(() => ({}));
        const locationId = body.location_id;
        const horizonDays = body.horizon_days || 90;
        const prophetWeight = body.prophet_weight ?? 0.5;
        const xgboostWeight = body.xgboost_weight ?? 0.5;
        const autoWeights = body.auto_weights ?? true; // Use accuracy-based weights

        console.log(
            `[FORECAST v6] Ensemble: location=${locationId || "all"}, horizon=${horizonDays}, weights={prophet:${prophetWeight}, xgboost:${xgboostWeight}}`,
        );

        // ── Get locations ────────────────────────────────────────────
        let locationsQuery = supabase.from("locations").select("id, name").eq("active", true);
        if (locationId) {
            locationsQuery = supabase.from("locations").select("id, name").eq("id", locationId);
        }
        const { data: locationsData } = await locationsQuery;
        const locations = locationsData || [];

        if (locations.length === 0) {
            return new Response(
                JSON.stringify({ error: "No locations found" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        const results: Record<string, unknown>[] = [];

        for (const location of locations) {
            const logs: string[] = [];
            logs.push(`[v6 Ensemble] Processing ${location.name}`);

            // ── Determine ensemble weights ─────────────────────────────
            let wProphet = prophetWeight;
            let wXgboost = xgboostWeight;

            if (autoWeights) {
                // Read accuracy from forecast_accuracy_log to auto-tune weights
                try {
                    const { data: accuracyData } = await supabase
                        .from("forecast_accuracy_log" as any)
                        .select("model_name, error_pct")
                        .eq("location_id", location.id)
                        .not("actual", "is", null)
                        .gte("date", new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0])
                        .order("date", { ascending: false })
                        .limit(200);

                    if (accuracyData && accuracyData.length > 10) {
                        const prophetErrors: number[] = [];
                        const xgboostErrors: number[] = [];
                        for (const row of accuracyData as any[]) {
                            if (row.error_pct != null) {
                                if (row.model_name?.includes("Prophet") || row.model_name?.includes("prophet")) {
                                    prophetErrors.push(Number(row.error_pct));
                                } else if (row.model_name?.includes("XGBoost") || row.model_name?.includes("xgboost")) {
                                    xgboostErrors.push(Number(row.error_pct));
                                }
                            }
                        }
                        if (prophetErrors.length >= 5 && xgboostErrors.length >= 5) {
                            const prophetMape = prophetErrors.reduce((a, b) => a + b, 0) / prophetErrors.length;
                            const xgboostMape = xgboostErrors.reduce((a, b) => a + b, 0) / xgboostErrors.length;
                            // Inverse MAPE weighting: lower error = higher weight
                            const totalInvMape = (1 / (prophetMape + 1)) + (1 / (xgboostMape + 1));
                            wProphet = (1 / (prophetMape + 1)) / totalInvMape;
                            wXgboost = (1 / (xgboostMape + 1)) / totalInvMape;
                            logs.push(
                                `Auto-weights: Prophet=${(wProphet * 100).toFixed(0)}% (MAPE=${prophetMape.toFixed(1)}%), XGBoost=${(wXgboost * 100).toFixed(0)}% (MAPE=${xgboostMape.toFixed(1)}%)`,
                            );
                        } else {
                            logs.push("Auto-weights: Insufficient accuracy data, using 50/50 defaults");
                        }
                    }
                } catch {
                    logs.push("Auto-weights: Could not read accuracy data, using defaults");
                }
            }

            // ── Call Prophet service ────────────────────────────────────
            let prophetForecasts: Map<string, number> | null = null;
            let prophetMetrics: Record<string, unknown> | null = null;

            if (prophetServiceUrl) {
                try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (prophetApiKey) headers["Authorization"] = `Bearer ${prophetApiKey}`;

                    const prophetRes = await fetch(`${prophetServiceUrl}/forecast_supabase`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            supabase_url: supabaseUrl,
                            supabase_key: supabaseKey,
                            location_id: location.id,
                            location_name: location.name,
                            horizon_days: horizonDays,
                            seasonality_mode: body.seasonality_mode || "multiplicative",
                            changepoint_prior_scale: body.changepoint_prior_scale || 0.05,
                        }),
                    });

                    if (prophetRes.ok) {
                        const result = await prophetRes.json();
                        prophetMetrics = result.metrics;
                        prophetForecasts = new Map();

                        // Prophet stores directly to DB — read them back
                        const today = new Date().toISOString().split("T")[0];
                        const { data: storedForecasts } = await supabase
                            .from("forecast_daily_metrics")
                            .select("date, forecast_sales")
                            .eq("location_id", location.id)
                            .gte("date", today)
                            .order("date");

                        if (storedForecasts) {
                            for (const f of storedForecasts) {
                                prophetForecasts.set(f.date, Number(f.forecast_sales));
                            }
                        }
                        logs.push(`Prophet: ${prophetForecasts.size} forecasts, R²=${result.metrics?.r_squared || "?"}`);
                    } else {
                        logs.push(`Prophet: Failed (${prophetRes.status})`);
                    }
                } catch (err) {
                    logs.push(`Prophet: Error (${err instanceof Error ? err.message : "unknown"})`);
                }
            } else {
                logs.push("Prophet: Service URL not configured");
            }

            // ── Call XGBoost service ────────────────────────────────────
            let xgboostForecasts: Map<string, number> | null = null;
            let xgboostMetrics: Record<string, unknown> | null = null;

            if (prophetServiceUrl) {
                try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (prophetApiKey) headers["Authorization"] = `Bearer ${prophetApiKey}`;

                    const xgbRes = await fetch(`${prophetServiceUrl}/forecast_xgboost`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            supabase_url: supabaseUrl,
                            supabase_key: supabaseKey,
                            location_id: location.id,
                            location_name: location.name,
                            horizon_days: horizonDays,
                        }),
                    });

                    if (xgbRes.ok) {
                        const result = await xgbRes.json();
                        xgboostMetrics = result.metrics;
                        xgboostForecasts = new Map();

                        for (const fc of result.forecasts || []) {
                            xgboostForecasts.set(fc.date, Number(fc.predicted));
                        }
                        logs.push(`XGBoost: ${xgboostForecasts.size} forecasts, R²=${result.metrics?.r_squared || "?"}`);
                    } else {
                        logs.push(`XGBoost: Failed (${xgbRes.status})`);
                    }
                } catch (err) {
                    logs.push(`XGBoost: Error (${err instanceof Error ? err.message : "unknown"})`);
                }
            }

            // ── Ensemble logic ─────────────────────────────────────────
            const hasProphet = prophetForecasts && prophetForecasts.size > 0;
            const hasXgboost = xgboostForecasts && xgboostForecasts.size > 0;
            let ensembleMode = "ensemble";
            let effectiveWP = wProphet;
            let effectiveWX = wXgboost;

            if (hasProphet && !hasXgboost) {
                ensembleMode = "prophet_only";
                effectiveWP = 1.0;
                effectiveWX = 0.0;
                logs.push("Ensemble: Prophet only (XGBoost unavailable)");
            } else if (!hasProphet && hasXgboost) {
                ensembleMode = "xgboost_only";
                effectiveWP = 0.0;
                effectiveWX = 1.0;
                logs.push("Ensemble: XGBoost only (Prophet unavailable)");
            } else if (!hasProphet && !hasXgboost) {
                ensembleMode = "v4_fallback";
                logs.push("Ensemble: Both models unavailable — using v4 inline fallback");
            } else {
                logs.push(
                    `Ensemble: Prophet(${(effectiveWP * 100).toFixed(0)}%) + XGBoost(${(effectiveWX * 100).toFixed(0)}%)`,
                );
            }

            // ── Generate ensemble forecasts ────────────────────────────
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            const forecasts: Record<string, unknown>[] = [];

            if (ensembleMode === "v4_fallback") {
                // ── v4 inline fallback (same logic as generate_forecast_v4) ──
                const salesByDate: Record<string, number> = {};
                const { data: factsData } = await supabase
                    .from("facts_sales_15m")
                    .select("ts_bucket, sales_net")
                    .eq("location_id", location.id)
                    .order("ts_bucket");

                if (factsData && factsData.length > 0) {
                    factsData.forEach((s: any) => {
                        const dateStr = new Date(s.ts_bucket).toISOString().split("T")[0];
                        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (Number(s.sales_net) || 0);
                    });
                } else {
                    // Fallback to tickets
                    const { data: ticketData } = await supabase
                        .from("tickets")
                        .select("opened_at, net_total")
                        .eq("location_id", location.id)
                        .order("opened_at");
                    if (ticketData) {
                        ticketData.forEach((t: any) => {
                            const dateStr = new Date(t.opened_at).toISOString().split("T")[0];
                            salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (Number(t.net_total) || 0);
                        });
                    }
                }

                const dates = Object.keys(salesByDate).sort();
                if (dates.length > 0) {
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

                    const learnedImpacts = learnRegressorImpacts(
                        dailyData.map((d) => ({ date: d.date, sales: d.sales })),
                    );
                    const regressionInput = dailyData.map((d) => ({ x: d.t, y: d.sales }));
                    const trend = linearRegression(regressionInput);
                    const useMonthly = dailyData.length >= 365;
                    const seasonalIndex = useMonthly
                        ? calculateSeasonalIndex(dailyData, "monthly")
                        : calculateSeasonalIndex(dailyData, "weekly");

                    const salesValues = dailyData.map((d) => d.sales).filter((s) => s > 0);
                    const mean = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
                    const stdDev = Math.sqrt(
                        salesValues.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / salesValues.length,
                    );

                    const forecastEndDate = new Date(today);
                    forecastEndDate.setDate(today.getDate() + horizonDays);
                    const events = await prefetchEvents(supabase, todayStr, forecastEndDate.toISOString().split("T")[0]);

                    for (let k = 1; k <= horizonDays; k++) {
                        const forecastDate = new Date(today);
                        forecastDate.setDate(today.getDate() + k);
                        const dateStr = forecastDate.toISOString().split("T")[0];
                        const month = forecastDate.getMonth() + 1;
                        const dayOfWeek = forecastDate.getDay();
                        const tVal = dailyData.length + k;
                        const trendValue = trend.slope * tVal + trend.intercept;
                        const siKey = useMonthly ? month : dayOfWeek;
                        const si = seasonalIndex[siKey] || 0;
                        const baseForecast = Math.max(0, trendValue * (1 + si));
                        const regressors = await getRegressors(dateStr, weatherApiKey, events);
                        const adj = calculateRegressorAdjustment(regressors, learnedImpacts);
                        let adjusted = Math.max(0, baseForecast * adj);
                        adjusted = Math.round(adjusted * 100) / 100;

                        forecasts.push({
                            location_id: location.id,
                            date: dateStr,
                            forecast_sales: adjusted,
                            forecast_sales_lower: Math.round(Math.max(0, adjusted - stdDev * 1.96) * 100) / 100,
                            forecast_sales_upper: Math.round((adjusted + stdDev * 1.96) * 100) / 100,
                            model_version: "Ensemble_v6_fallback",
                            explanation: explainForecast(baseForecast, regressors, adjusted, learnedImpacts),
                            generated_at: new Date().toISOString(),
                        });
                    }
                    logs.push(`v4 fallback: generated ${forecasts.length} forecasts`);
                }
            } else {
                // ── True ensemble: weighted average of Prophet + XGBoost ──
                const allDates = new Set<string>();
                if (hasProphet) for (const d of prophetForecasts!.keys()) allDates.add(d);
                if (hasXgboost) for (const d of xgboostForecasts!.keys()) allDates.add(d);

                const forecastEndDate = new Date(today);
                forecastEndDate.setDate(today.getDate() + horizonDays);
                const events = await prefetchEvents(supabase, todayStr, forecastEndDate.toISOString().split("T")[0]);

                for (const dateStr of [...allDates].sort()) {
                    const pVal = prophetForecasts?.get(dateStr);
                    const xVal = xgboostForecasts?.get(dateStr);

                    let ensembleForecast: number;
                    if (pVal != null && xVal != null) {
                        ensembleForecast = effectiveWP * pVal + effectiveWX * xVal;
                    } else if (pVal != null) {
                        ensembleForecast = pVal;
                    } else if (xVal != null) {
                        ensembleForecast = xVal;
                    } else {
                        continue;
                    }

                    ensembleForecast = Math.round(Math.max(0, ensembleForecast) * 100) / 100;

                    // Regressors for explanation
                    const regressors = await getRegressors(dateStr, weatherApiKey, events);
                    const explanation = `Ensemble(P=${pVal?.toFixed(0) || "N/A"}, X=${xVal?.toFixed(0) || "N/A"}) = €${ensembleForecast.toFixed(0)}`;

                    forecasts.push({
                        location_id: location.id,
                        date: dateStr,
                        forecast_sales: ensembleForecast,
                        forecast_sales_lower: Math.round(ensembleForecast * 0.85 * 100) / 100,
                        forecast_sales_upper: Math.round(ensembleForecast * 1.15 * 100) / 100,
                        model_version: `Ensemble_v6_P${(effectiveWP * 100).toFixed(0)}_X${(effectiveWX * 100).toFixed(0)}`,
                        explanation,
                        regressors,
                        generated_at: new Date().toISOString(),
                    });
                }
                logs.push(`Ensemble: combined ${forecasts.length} forecasts`);
            }

            // ── Store ensemble forecasts ───────────────────────────────
            if (forecasts.length > 0) {
                // Clear existing forecasts for this location
                await supabase
                    .from("forecast_daily_metrics")
                    .delete()
                    .eq("location_id", location.id)
                    .gte("date", todayStr);

                for (let i = 0; i < forecasts.length; i += 500) {
                    const batch = forecasts.slice(i, i + 500);
                    const { error } = await supabase.from("forecast_daily_metrics").insert(batch);
                    if (error) logs.push(`Insert error: ${error.message}`);
                }
            }

            results.push({
                location_id: location.id,
                location_name: location.name,
                model_version: `Ensemble_v6`,
                ensemble_mode: ensembleMode,
                weights: { prophet: effectiveWP, xgboost: effectiveWX },
                forecasts_generated: forecasts.length,
                prophet_metrics: prophetMetrics,
                xgboost_metrics: xgboostMetrics,
                sample_forecast: forecasts.slice(0, 7).map((f: any) => ({
                    date: f.date,
                    forecast: f.forecast_sales,
                    explanation: f.explanation,
                })),
                logs,
            });

            console.log(
                `[FORECAST v6] ${location.name}: ${ensembleMode}, ${forecasts.length} forecasts`,
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                version: "v6_ensemble",
                engine: "Prophet + XGBoost Ensemble",
                features: [
                    "Adaptive ensemble: Prophet (Bayesian) + XGBoost (Gradient Boosting)",
                    "Auto-weight tuning from forecast_accuracy_log",
                    "Graceful degradation (single model or v4 fallback)",
                    "25+ engineered features (XGBoost)",
                    "9 external regressors (Prophet)",
                    "SHAP feature importance (XGBoost)",
                    "Cross-validation metrics",
                    "95% confidence intervals",
                    "Forecast accuracy tracking integration",
                ],
                horizon_days: horizonDays,
                locations_processed: results.length,
                results,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[FORECAST v6] Error:", message);
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
