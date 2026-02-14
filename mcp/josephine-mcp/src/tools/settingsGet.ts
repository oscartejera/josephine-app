import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";

export const name = "josephine_settings_get";

export const description =
  "Get location settings (target GP%, target COL%, default COGS%, default hourly cost). " +
  "If no locationId is provided, returns settings for all locations.";

export const inputSchema = z.object({
  locationId: z.string().uuid().optional().describe("Specific location UUID. Omit for all."),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_settings_get");
  const supabase = getSupabase();

  let query = supabase
    .from("location_settings")
    .select("id, location_id, target_gp_percent, target_col_percent, default_cogs_percent, default_hourly_cost, created_at");

  if (input.locationId) {
    query = query.eq("location_id", input.locationId);
  }

  const { data, error } = await query;

  if (error) {
    return toMcpResult(
      `Failed to fetch settings: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const settings = (data ?? []).map((s) => ({
    id: s.id,
    locationId: s.location_id,
    targetGpPercent: s.target_gp_percent,
    targetColPercent: s.target_col_percent,
    defaultCogsPercent: s.default_cogs_percent,
    defaultHourlyCost: s.default_hourly_cost,
    createdAt: s.created_at,
  }));

  // Also fetch location names for context
  const locationIds = settings.map((s) => s.locationId);
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .in("id", locationIds);

  const locMap = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const enriched = settings.map((s) => ({
    ...s,
    locationName: locMap.get(s.locationId) ?? null,
  }));

  return toMcpResult(
    `${enriched.length} location setting(s) found.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { settings: enriched },
      meta: { count: enriched.length },
    }),
  );
}
