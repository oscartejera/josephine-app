import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { format } from "date-fns";

export const name = "josephine_sales_timeseries";

export const description =
  "Get sales timeseries data (actual + forecast) at hourly, daily, or weekly granularity. " +
  "Returns chart-ready data points with actual sales, forecast, and avg check.";

export const inputSchema = z.object({
  fromISO: z.string().describe("Start date ISO, e.g. '2026-02-01'"),
  toISO: z.string().describe("End date ISO, e.g. '2026-02-14'"),
  granularity: z.enum(["hour", "day", "week"]).describe("Time granularity"),
  locationIds: z.array(z.string().uuid()).optional().describe("Filter to specific locations"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_sales_timeseries");
  const supabase = getSupabase();
  const warnings: string[] = [];

  // Resolve org + locations
  let orgId: string;
  let locationIds = input.locationIds ?? [];

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
        errors: [{ code: "NOT_FOUND", message: "No group/organization found." }],
      }),
    );
  }

  const { data, error } = await (supabase.rpc as Function)("get_sales_timeseries_unified", {
    p_org_id: orgId,
    p_location_ids: locationIds,
    p_from: input.fromISO,
    p_to: input.toISO,
  });

  if (error) {
    return toMcpResult(
      `Timeseries RPC failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const ts = data as Record<string, unknown> | null;
  const dataSource = (ts?.data_source as string) ?? "unknown";
  if (dataSource === "demo") {
    warnings.push("Data source is 'demo' (simulated).");
  }

  // Build series based on granularity
  type DataPoint = { ts: string; actualSales: number; forecastSales: number; actualOrders: number; avgCheck: number };
  const series: DataPoint[] = [];

  if (input.granularity === "hour") {
    const hourly = ((ts?.hourly ?? []) as Array<Record<string, unknown>>);
    for (const h of hourly) {
      const actualSales = Number(h.actual_sales) || 0;
      const actualOrders = Number(h.actual_orders) || 0;
      series.push({
        ts: String(h.ts_hour),
        actualSales,
        forecastSales: Number(h.forecast_sales) || 0,
        actualOrders,
        avgCheck: actualOrders > 0 ? Math.round((actualSales / actualOrders) * 100) / 100 : 0,
      });
    }
  } else {
    // Daily (or weekly — aggregate from daily)
    let daily = ((ts?.daily ?? []) as Array<Record<string, unknown>>);

    // Fallback: aggregate hourly into daily if daily is empty
    if (daily.length === 0) {
      const hourly = ((ts?.hourly ?? []) as Array<Record<string, unknown>>);
      if (hourly.length > 0) {
        warnings.push("Daily data empty; aggregated from hourly (facts_sales_15m fallback).");
        const buckets = new Map<string, { s: number; o: number; fs: number }>();
        for (const h of hourly) {
          const d = new Date(String(h.ts_hour));
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          const prev = buckets.get(key) ?? { s: 0, o: 0, fs: 0 };
          prev.s += Number(h.actual_sales) || 0;
          prev.o += Number(h.actual_orders) || 0;
          prev.fs += Number(h.forecast_sales) || 0;
          buckets.set(key, prev);
        }
        daily = Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, actual_sales: v.s, actual_orders: v.o, forecast_sales: v.fs }));
      }
    }

    if (input.granularity === "week") {
      // Aggregate daily into ISO weeks
      const weeks = new Map<string, { s: number; o: number; fs: number }>();
      for (const d of daily) {
        const dt = new Date(String(d.date) + "T00:00:00");
        const weekStart = new Date(dt);
        weekStart.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // Monday
        const key = `${weekStart.getFullYear()}-W${String(Math.ceil(((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
        const prev = weeks.get(key) ?? { s: 0, o: 0, fs: 0 };
        prev.s += Number(d.actual_sales) || 0;
        prev.o += Number(d.actual_orders) || 0;
        prev.fs += Number(d.forecast_sales) || 0;
        weeks.set(key, prev);
      }
      for (const [week, v] of weeks) {
        series.push({
          ts: week,
          actualSales: Math.round(v.s * 100) / 100,
          forecastSales: Math.round(v.fs * 100) / 100,
          actualOrders: v.o,
          avgCheck: v.o > 0 ? Math.round((v.s / v.o) * 100) / 100 : 0,
        });
      }
    } else {
      for (const d of daily) {
        const actualSales = Number(d.actual_sales) || 0;
        const actualOrders = Number(d.actual_orders) || 0;
        series.push({
          ts: String(d.date),
          actualSales: Math.round(actualSales * 100) / 100,
          forecastSales: Math.round((Number(d.forecast_sales) || 0) * 100) / 100,
          actualOrders,
          avgCheck: actualOrders > 0 ? Math.round((actualSales / actualOrders) * 100) / 100 : 0,
        });
      }
    }
  }

  return toMcpResult(
    `${series.length} data points (${input.granularity}) from ${input.fromISO} to ${input.toISO}.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { granularity: input.granularity, dataSource, series },
      warnings: warnings.length > 0 ? warnings : undefined,
      meta: { pointCount: series.length, resultSizeBytes: JSON.stringify(series).length },
    }),
  );
}
