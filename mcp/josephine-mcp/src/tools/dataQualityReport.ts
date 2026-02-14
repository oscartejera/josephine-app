import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";

export const name = "josephine_data_quality_report";

export const description =
  "Run the audit_data_coherence RPC to check data quality across sales, forecasts, and inventory. " +
  "Returns pass/fail checks for data source consistency, forecast alignment, and sync status.";

export const inputSchema = z.object({
  fromISO: z.string().optional().describe("Start date (optional, default last 30 days)"),
  toISO: z.string().optional().describe("End date (optional, default today)"),
  locationIds: z.array(z.string().uuid()).optional().describe("Location UUIDs to audit"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_data_quality_report");
  const supabase = getSupabase();

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
        errors: [{ code: "NOT_FOUND", message: "No group found." }],
      }),
    );
  }

  const { data, error } = await (supabase.rpc as Function)("audit_data_coherence", {
    p_org_id: orgId,
    p_location_ids: locationIds,
    p_days: 30,
  });

  if (error) {
    return toMcpResult(
      `Data quality audit failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const audit = data as Record<string, unknown>;
  const allPass = audit?.all_pass as boolean;
  const checks = (audit?.checks ?? []) as Array<Record<string, unknown>>;

  const summary = checks.map((c) => {
    const entry: Record<string, unknown> = { name: c.name, pass: c.pass };
    if (c.error) entry.error = c.error;
    if (c.days_checked !== undefined) entry.daysChecked = c.days_checked;
    if (c.days_failed !== undefined) entry.daysFailed = c.days_failed;
    if (c.unmapped_lines !== undefined) entry.unmappedLines = c.unmapped_lines;
    if (c.action) entry.action = c.action;
    return entry;
  });

  const resolvedSource = audit?.resolved_source as Record<string, unknown> | undefined;

  return toMcpResult(
    allPass
      ? "All data quality checks passed."
      : `Data quality issues detected — ${checks.filter((c) => !c.pass).length} check(s) failed.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: {
        allPass,
        resolvedSource: resolvedSource ?? null,
        dateRange: audit?.date_range ?? null,
        checks: summary,
      },
      warnings: allPass ? undefined : ["Some checks failed. Review the 'checks' array for details."],
      meta: { checkCount: checks.length },
    }),
  );
}
