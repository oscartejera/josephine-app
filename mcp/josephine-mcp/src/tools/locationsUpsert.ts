import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, recordWriteError, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_locations_upsert";

export const description =
  "Create or update a restaurant location. Requires confirm=true, idempotencyKey, reason, and actor.";

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute the write"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation, e.g. 'loc-upsert-centro-20260214'"),
  reason: z.string().optional().describe("Why this change is being made"),
  actor: z
    .object({ name: z.string().optional(), role: z.string().optional() })
    .optional()
    .describe("Who is making this change"),
  location: z.object({
    id: z.string().uuid().optional().describe("Location UUID for update. Omit to create new."),
    name: z.string().min(1).describe("Location name"),
    timezone: z.string().optional().describe("IANA timezone, e.g. 'Europe/Madrid'"),
    city: z.string().optional().describe("City name"),
    currency: z.string().optional().default("EUR").describe("Currency code"),
    status: z.enum(["active", "inactive"]).optional().default("active").describe("Location status"),
  }),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_locations_upsert");
  const supabase = getSupabase();

  // Write guard: confirm, idempotencyKey, reason, actor, write-enabled, circuit breaker
  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase, { estimatedRows: 1 });
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Need a group_id. If updating, get from existing. If creating, get first group.
  let groupId: string;
  if (input.location.id) {
    const { data: existing } = await supabase
      .from("locations")
      .select("group_id")
      .eq("id", input.location.id)
      .single();
    if (!existing) {
      return toMcpResult(
        `Location ${input.location.id} not found for update.`,
        buildEnvelope(ctx, {
          status: "error",
          data: null,
          errors: [{ code: "NOT_FOUND", message: `Location ${input.location.id} not found.` }],
          meta: { execution: "preview" },
        }),
      );
    }
    groupId = existing.group_id;
  } else {
    const { data: groups } = await supabase.from("groups").select("id").limit(1).single();
    groupId = groups?.id ?? "";
    if (!groupId) {
      return toMcpResult(
        "No group found to create location in.",
        buildEnvelope(ctx, {
          status: "error",
          data: null,
          errors: [{ code: "NOT_FOUND", message: "No group/organization found." }],
          meta: { execution: "preview" },
        }),
      );
    }
  }

  const upsertData = {
    ...(input.location.id && { id: input.location.id }),
    group_id: groupId,
    name: input.location.name,
    timezone: input.location.timezone ?? "Europe/Madrid",
    city: input.location.city ?? null,
    currency: input.location.currency ?? "EUR",
    active: input.location.status !== "inactive",
  };

  const { data, error } = input.location.id
    ? await supabase.from("locations").update(upsertData).eq("id", input.location.id).select().single()
    : await supabase.from("locations").insert(upsertData).select().single();

  if (error) {
    recordWriteError("josephine_locations_upsert");
    const code = error.message.includes("permission") || error.message.includes("policy")
      ? "RLS_DENIED" as const
      : "UPSTREAM_ERROR" as const;
    return toMcpResult(
      `Location upsert failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{
          code,
          message: error.message,
          hint: code === "RLS_DENIED" ? "Ensure you're using SUPABASE_SERVICE_ROLE_KEY for write operations." : null,
        }],
        meta: { execution: "preview" },
      }),
    );
  }

  // Store idempotency record via GuardContext
  await finalizeWrite(supabase, guard.guardCtx!, data);

  return toMcpResult(
    `Location "${data.name}" ${input.location.id ? "updated" : "created"} (${data.id}).`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { location: data },
      meta: { execution: "executed", rowsTouched: 1, operation: input.location.id ? "update" : "insert" },
    }),
  );
}
