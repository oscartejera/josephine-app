import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_purchases_create_po";

export const description =
  "Create a purchase order with line items. Creates records in purchase_orders and purchase_order_lines. " +
  "Requires confirm=true, idempotencyKey, and reason.";

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation"),
  reason: z.string().optional().describe("Why this PO is being created"),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  locationId: z.string().uuid().describe("Location UUID"),
  supplierId: z.string().uuid().describe("Supplier UUID"),
  lines: z.array(
    z.object({
      itemId: z.string().uuid().describe("Inventory item UUID"),
      qty: z.number().positive().describe("Quantity to order"),
      unit: z.string().optional().describe("Unit override"),
      priceEstimate: z.number().optional().describe("Estimated unit cost"),
    }),
  ).min(1).describe("Order lines (at least 1)"),
  notes: z.string().optional().describe("Optional notes for the PO"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_purchases_create_po");
  const supabase = getSupabase();

  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase);
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Resolve group_id from location
  const { data: loc } = await supabase
    .from("locations")
    .select("group_id, name")
    .eq("id", input.locationId)
    .single();

  if (!loc) {
    return toMcpResult(
      "Location not found.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "NOT_FOUND", message: `Location ${input.locationId} not found.` }],
      }),
    );
  }

  // Verify supplier exists
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", input.supplierId)
    .single();

  if (!supplier) {
    return toMcpResult(
      "Supplier not found.",
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "NOT_FOUND", message: `Supplier ${input.supplierId} not found.` }],
      }),
    );
  }

  // Create PO header
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      group_id: loc.group_id,
      location_id: input.locationId,
      supplier_id: input.supplierId,
      status: "draft",
    })
    .select()
    .single();

  if (poErr || !po) {
    const code = poErr?.message.includes("policy") ? "RLS_DENIED" as const : "UPSTREAM_ERROR" as const;
    return toMcpResult(
      `PO creation failed: ${poErr?.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code, message: poErr?.message ?? "Unknown error" }],
      }),
    );
  }

  // Create PO lines
  const lineRecords = input.lines.map((l) => ({
    purchase_order_id: po.id,
    inventory_item_id: l.itemId,
    quantity: l.qty,
    unit_cost: l.priceEstimate ?? null,
  }));

  const { data: insertedLines, error: lineErr } = await supabase
    .from("purchase_order_lines")
    .insert(lineRecords)
    .select();

  if (lineErr) {
    // PO header created but lines failed — warn about partial state
    return toMcpResult(
      `PO ${po.id} created but lines failed: ${lineErr.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: { purchaseOrderId: po.id },
        errors: [{ code: "UPSTREAM_ERROR", message: lineErr.message }],
        warnings: [
          `PO header ${po.id} was created in 'draft' status but line insertion failed.`,
          "Delete the PO or retry line insertion manually.",
        ],
      }),
    );
  }

  const totalEstCost = input.lines.reduce((s, l) => s + l.qty * (l.priceEstimate ?? 0), 0);

  const result = {
    purchaseOrder: {
      id: po.id,
      status: po.status,
      supplierId: input.supplierId,
      supplierName: supplier.name,
      locationId: input.locationId,
      locationName: loc.name,
      createdAt: po.created_at,
    },
    lines: (insertedLines ?? []).map((l) => ({
      id: l.id,
      itemId: l.inventory_item_id,
      quantity: Number(l.quantity),
      unitCost: l.unit_cost != null ? Number(l.unit_cost) : null,
    })),
    totals: {
      lineCount: input.lines.length,
      estimatedCost: Math.round(totalEstCost * 100) / 100,
    },
  };

  await finalizeWrite(supabase, "josephine_purchases_create_po", input as WriteInput, guard.requestHash!, result);

  return toMcpResult(
    `PO ${po.id} created (draft) for ${supplier.name} with ${input.lines.length} line(s). Est. cost: EUR ${Math.round(totalEstCost)}.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: result,
      meta: { rowsTouched: 1 + input.lines.length },
    }),
  );
}
