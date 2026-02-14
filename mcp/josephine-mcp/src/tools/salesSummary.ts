import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";

export const name = "josephine_sales_summary";

export const description =
  "Get aggregated sales KPIs (total sales, orders, avg check) for a date range. " +
  "Uses the get_sales_timeseries_unified RPC which resolves data source automatically.";

export const inputSchema = z.object({
  fromISO: z.string().describe("Start date in ISO format, e.g. '2026-02-01'"),
  toISO: z.string().describe("End date in ISO format, e.g. '2026-02-14'"),
  locationIds: z.array(z.string().uuid()).optional().describe("Filter to specific location UUIDs. Omit for all."),
  compare: z
    .enum(["none", "previous_period"])
    .optional()
    .default("none")
    .describe("Comparison mode (default 'none')"),
  currency: z.string().optional().default("EUR").describe("Currency code for display (default 'EUR')"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_sales_summary");
  const supabase = getSupabase();
  const warnings: string[] = [];

  // We need an org_id. Resolve from locations if locationIds provided, or get first group.
  let orgId: string;
  let locationIds: string[] = input.locationIds ?? [];

  if (locationIds.length > 0) {
    const { data: loc } = await supabase
      .from("locations")
      .select("group_id")
      .eq("id", locationIds[0])
      .single();
    orgId = loc?.group_id ?? "";
  } else {
    const { data: groups } = await supabase.from("groups").select("id").limit(1).single();
    orgId = groups?.id ?? "";
    // Get all locations for this group
    const { data: locs } = await supabase
      .from("locations")
      .select("id")
      .eq("group_id", orgId)
      .eq("active", true);
    locationIds = (locs ?? []).map((l) => l.id);
  }

  if (!orgId) {
    return toMcpResult(
      "No organization found.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "NOT_FOUND", message: "No group/organization found in database." }],
      }),
    );
  }

  // Call the unified RPC
  const { data, error } = await (supabase.rpc as Function)("get_sales_timeseries_unified", {
    p_org_id: orgId,
    p_location_ids: locationIds,
    p_from: input.fromISO,
    p_to: input.toISO,
  });

  if (error) {
    return toMcpResult(
      `Sales summary RPC failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const ts = data as Record<string, unknown> | null;
  if (!ts || !ts.kpis) {
    return toMcpResult(
      "No sales data found for this period.",
      buildEnvelope(ctx, { status: "ok", data: { kpis: null, dataSource: ts?.data_source ?? "unknown" }, warnings: ["No data returned from RPC."] }),
    );
  }

  const kpis = ts.kpis as Record<string, unknown>;
  const dataSource = (ts.data_source as string) ?? "unknown";
  if (dataSource === "demo") {
    warnings.push("Data source is 'demo' (simulated). Connect a POS for real data.");
  }

  const actualSales = Number(kpis.actual_sales) || 0;
  const forecastSales = Number(kpis.forecast_sales) || 0;
  const actualOrders = Number(kpis.actual_orders) || 0;
  const avgCheck = Number(kpis.avg_check_actual) || (actualOrders > 0 ? actualSales / actualOrders : 0);

  // Hourly fallback for KPIs (same logic as frontend fix)
  let finalSales = actualSales;
  let finalOrders = actualOrders;
  if (actualSales === 0 && actualOrders === 0) {
    const hourly = (ts.hourly ?? []) as Array<Record<string, unknown>>;
    if (hourly.length > 0) {
      finalSales = hourly.reduce((s, h) => s + (Number(h.actual_sales) || 0), 0);
      finalOrders = hourly.reduce((s, h) => s + (Number(h.actual_orders) || 0), 0);
      warnings.push("KPIs computed from hourly data (pos_daily_finance had no rows for this data source).");
    }
  }

  const finalAvgCheck = finalOrders > 0 ? finalSales / finalOrders : 0;
  const varianceVsForecast = forecastSales > 0 ? ((finalSales - forecastSales) / forecastSales) * 100 : 0;

  const summary = {
    period: { from: input.fromISO, to: input.toISO },
    currency: input.currency,
    dataSource,
    totalNetSales: Math.round(finalSales * 100) / 100,
    totalOrders: finalOrders,
    avgCheckSize: Math.round(finalAvgCheck * 100) / 100,
    forecastSales: Math.round(forecastSales * 100) / 100,
    varianceVsForecastPct: Math.round(varianceVsForecast * 100) / 100,
    locationCount: locationIds.length,
  };

  return toMcpResult(
    `Sales ${input.fromISO} to ${input.toISO}: ${input.currency} ${summary.totalNetSales.toLocaleString()} (${summary.totalOrders} orders, avg check ${input.currency} ${summary.avgCheckSize}).`,
    buildEnvelope(ctx, {
      status: "ok",
      data: summary,
      warnings: warnings.length > 0 ? warnings : undefined,
      meta: { rowsTouched: 0, resultSizeBytes: JSON.stringify(summary).length },
    }),
  );
}
