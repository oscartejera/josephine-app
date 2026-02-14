import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, recordWriteError, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_inventory_upsert_item";

export const description =
  "Create or update an inventory item. Items are group-scoped (not location-scoped). " +
  "Requires confirm=true, idempotencyKey, reason, and actor.";

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation"),
  reason: z.string().optional().describe("Why this change is being made"),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  locationId: z.string().uuid().optional().describe("Location UUID (used to resolve group_id)"),
  item: z.object({
    id: z.string().uuid().optional().describe("Item UUID for update. Omit to create new."),
    name: z.string().min(1).describe("Item name"),
    unit: z.string().optional().describe("Unit of measure (e.g. 'kg', 'L', 'units')"),
    category: z.string().optional().describe("Item category"),
    par: z.number().optional().describe("Par level (reorder point)"),
    currentStock: z.number().optional().describe("Current stock on hand"),
    lastCost: z.number().optional().describe("Last known unit cost"),
  }),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_inventory_upsert_item");
  const supabase = getSupabase();

  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase, { estimatedRows: 1 });
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Resolve group_id
  let groupId: string;
  if (input.item.id) {
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("group_id")
      .eq("id", input.item.id)
      .single();
    if (!existing) {
      return toMcpResult(
        `Item ${input.item.id} not found.`,
        buildEnvelope(ctx, {
          status: "error",
          data: null,
          errors: [{ code: "NOT_FOUND", message: `Inventory item ${input.item.id} not found.` }],
          meta: { execution: "preview" },
        }),
      );
    }
    groupId = existing.group_id;
  } else if (input.locationId) {
    const { data: loc } = await supabase.from("locations").select("group_id").eq("id", input.locationId).single();
    groupId = loc?.group_id ?? "";
  } else {
    const { data: groups } = await supabase.from("groups").select("id").limit(1).single();
    groupId = groups?.id ?? "";
  }

  if (!groupId) {
    return toMcpResult(
      "Cannot resolve group. Provide locationId or item.id.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "INVALID_INPUT", message: "Could not resolve group_id. Provide locationId or item.id." }],
        meta: { execution: "preview" },
      }),
    );
  }

  const upsertData = {
    ...(input.item.id && { id: input.item.id }),
    group_id: groupId,
    name: input.item.name,
    unit: input.item.unit ?? null,
    category: input.item.category ?? null,
    par_level: input.item.par ?? null,
    current_stock: input.item.currentStock ?? null,
    last_cost: input.item.lastCost ?? null,
  };

  const { data, error } = input.item.id
    ? await supabase.from("inventory_items").update(upsertData).eq("id", input.item.id).select().single()
    : await supabase.from("inventory_items").insert(upsertData).select().single();

  if (error) {
    recordWriteError("josephine_inventory_upsert_item");
    const code = error.message.includes("policy") ? "RLS_DENIED" as const : "UPSTREAM_ERROR" as const;
    return toMcpResult(
      `Inventory upsert failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code, message: error.message }],
        meta: { execution: "preview" },
      }),
    );
  }

  await finalizeWrite(supabase, guard.guardCtx!, data);

  return toMcpResult(
    `Item "${data.name}" ${input.item.id ? "updated" : "created"} (${data.id}).`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { item: data },
      meta: { execution: "executed", rowsTouched: 1, operation: input.item.id ? "update" : "insert" },
    }),
  );
}
