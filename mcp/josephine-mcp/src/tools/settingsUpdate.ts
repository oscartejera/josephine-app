import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, recordWriteError, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_settings_update";

export const description =
  "Update location settings (target GP%, COL%, default COGS%, hourly cost). " +
  "Only whitelisted keys are accepted. Requires confirm, idempotencyKey, reason, actor.";

/** Whitelist of allowed setting keys matching location_settings columns */
const ALLOWED_KEYS = new Set([
  "target_gp_percent",
  "target_col_percent",
  "default_cogs_percent",
  "default_hourly_cost",
]);

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation"),
  reason: z.string().optional().describe("Why this setting is being changed"),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  locationId: z.string().uuid().describe("Location UUID"),
  patch: z
    .record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()]))
    .describe(
      "Key-value pairs to update. Allowed keys: target_gp_percent, target_col_percent, " +
      "default_cogs_percent, default_hourly_cost. Example: { target_gp_percent: 70 }",
    ),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_settings_update");
  const supabase = getSupabase();

  // Validate patch keys
  const invalidKeys = Object.keys(input.patch).filter((k) => !ALLOWED_KEYS.has(k));
  if (invalidKeys.length > 0) {
    return toMcpResult(
      `Invalid setting key(s): ${invalidKeys.join(", ")}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [
          {
            code: "INVALID_INPUT",
            message: `Keys not allowed: ${invalidKeys.join(", ")}`,
            hint: `Allowed keys: ${Array.from(ALLOWED_KEYS).join(", ")}`,
          },
        ],
        meta: { execution: "preview" },
      }),
    );
  }

  if (Object.keys(input.patch).length === 0) {
    return toMcpResult(
      "No settings to update (empty patch).",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "INVALID_INPUT", message: "Patch object is empty. Nothing to update." }],
        meta: { execution: "preview" },
      }),
    );
  }

  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase, { estimatedRows: 1 });
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Check if settings row exists
  const { data: existing } = await supabase
    .from("location_settings")
    .select("id")
    .eq("location_id", input.locationId)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("location_settings")
      .update(input.patch)
      .eq("location_id", input.locationId)
      .select()
      .single();
    if (error) {
      recordWriteError("josephine_settings_update");
      return toMcpResult(
        `Settings update failed: ${error.message}`,
        buildEnvelope(ctx, {
          status: "error",
          data: null,
          errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
          meta: { execution: "preview" },
        }),
      );
    }
    result = data;
  } else {
    // Insert new settings row
    const { data, error } = await supabase
      .from("location_settings")
      .insert({ location_id: input.locationId, ...input.patch })
      .select()
      .single();
    if (error) {
      recordWriteError("josephine_settings_update");
      return toMcpResult(
        `Settings insert failed: ${error.message}`,
        buildEnvelope(ctx, {
          status: "error",
          data: null,
          errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
          meta: { execution: "preview" },
        }),
      );
    }
    result = data;
  }

  await finalizeWrite(supabase, guard.guardCtx!, result);

  const changedKeys = Object.keys(input.patch).join(", ");
  return toMcpResult(
    `Settings updated for location ${input.locationId}: ${changedKeys}.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { settings: result },
      meta: { execution: "executed", rowsTouched: 1, changedKeys: Object.keys(input.patch) },
    }),
  );
}
