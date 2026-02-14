import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_inventory_adjust_onhand";

export const description =
  "Adjust on-hand stock for an inventory item. Creates a stock_movements record " +
  "(type='adjustment') and updates inventory_items.current_stock. " +
  "Provide either newOnHand (absolute) or delta (relative). Requires confirm, idempotencyKey, reason.";

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation"),
  reason: z.string().optional().describe("Why this adjustment is being made, e.g. 'Physical count correction'"),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  locationId: z.string().uuid().describe("Location UUID"),
  itemId: z.string().uuid().describe("Inventory item UUID"),
  newOnHand: z.number().optional().describe("Absolute new on-hand quantity (mutually exclusive with delta)"),
  delta: z.number().optional().describe("Relative change (+/-) (mutually exclusive with newOnHand)"),
  unit: z.string().optional().describe("Unit of measure override"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_inventory_adjust_onhand");
  const supabase = getSupabase();

  // Validate that exactly one of newOnHand or delta is provided
  if (input.newOnHand == null && input.delta == null) {
    return toMcpResult(
      "Must provide either newOnHand or delta.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "INVALID_INPUT", message: "Provide either newOnHand (absolute) or delta (relative), not neither." }],
      }),
    );
  }
  if (input.newOnHand != null && input.delta != null) {
    return toMcpResult(
      "Provide only one of newOnHand or delta, not both.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "INVALID_INPUT", message: "Provide either newOnHand or delta, not both." }],
      }),
    );
  }

  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase);
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Get current item
  const { data: item, error: itemErr } = await supabase
    .from("inventory_items")
    .select("id, name, current_stock, unit")
    .eq("id", input.itemId)
    .single();

  if (itemErr || !item) {
    return toMcpResult(
      `Item ${input.itemId} not found.`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "NOT_FOUND", message: `Inventory item ${input.itemId} not found.` }],
      }),
    );
  }

  const previousStock = Number(item.current_stock) || 0;
  const newStock = input.newOnHand != null ? input.newOnHand : previousStock + (input.delta ?? 0);
  const adjustmentDelta = newStock - previousStock;
  const unit = input.unit ?? item.unit ?? "units";

  // 1. Insert stock_movements record
  const { error: mvErr } = await supabase.from("stock_movements").insert({
    location_id: input.locationId,
    item_id: input.itemId,
    movement_type: "adjustment",
    quantity: adjustmentDelta,
    unit,
    notes: input.reason ?? "MCP adjustment",
    cost: 0,
  });

  if (mvErr) {
    const code = mvErr.message.includes("policy") ? "RLS_DENIED" as const : "UPSTREAM_ERROR" as const;
    return toMcpResult(
      `Stock movement insert failed: ${mvErr.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code, message: mvErr.message }],
      }),
    );
  }

  // 2. Update inventory_items.current_stock
  const { error: updateErr } = await supabase
    .from("inventory_items")
    .update({ current_stock: newStock })
    .eq("id", input.itemId);

  if (updateErr) {
    return toMcpResult(
      `Item stock update failed: ${updateErr.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: updateErr.message }],
        warnings: ["stock_movements record was created but current_stock update failed. Manual correction needed."],
      }),
    );
  }

  const result = {
    itemId: input.itemId,
    itemName: item.name,
    previousStock,
    newStock,
    delta: adjustmentDelta,
    unit,
  };

  await finalizeWrite(supabase, "josephine_inventory_adjust_onhand", input as WriteInput, guard.requestHash!, result);

  return toMcpResult(
    `Stock adjusted for "${item.name}": ${previousStock} → ${newStock} ${unit} (delta: ${adjustmentDelta >= 0 ? "+" : ""}${adjustmentDelta}).`,
    buildEnvelope(ctx, {
      status: "ok",
      data: result,
      meta: { rowsTouched: 2 },
    }),
  );
}
