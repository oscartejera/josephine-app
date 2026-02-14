import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { resolvePagination, buildPaginationMeta } from "../lib/pagination.js";

export const name = "josephine_inventory_item_history";

export const description =
  "Get stock movement history for a specific inventory item at a location. " +
  "Shows purchases, usage, waste, transfers, and adjustments.";

export const inputSchema = z.object({
  locationId: z.string().uuid().describe("Location UUID"),
  itemId: z.string().uuid().describe("Inventory item UUID"),
  fromISO: z.string().describe("Start date ISO, e.g. '2026-01-01'"),
  toISO: z.string().describe("End date ISO, e.g. '2026-02-14'"),
  limit: z.number().min(1).max(100).optional().describe("Max rows (default 25)"),
  cursor: z.string().optional().describe("Pagination cursor"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_inventory_item_history");
  const { limit, offset } = resolvePagination(input);
  const supabase = getSupabase();

  const { data, error, count } = await supabase
    .from("stock_movements")
    .select("id, movement_type, quantity, unit, cost, notes, reference_id, created_at", { count: "exact" })
    .eq("location_id", input.locationId)
    .eq("item_id", input.itemId)
    .gte("created_at", input.fromISO + "T00:00:00Z")
    .lte("created_at", input.toISO + "T23:59:59Z")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    return toMcpResult(
      `Failed to query stock movements: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const movements = (data ?? []).map((m) => ({
    id: m.id,
    type: m.movement_type,
    quantity: Number(m.quantity),
    unit: m.unit,
    cost: m.cost != null ? Number(m.cost) : null,
    notes: m.notes,
    referenceId: m.reference_id,
    createdAt: m.created_at,
  }));

  const pagination = buildPaginationMeta(limit, offset, movements.length);

  // Also fetch current item info
  const { data: item } = await supabase
    .from("inventory_items")
    .select("name, current_stock, par_level, unit")
    .eq("id", input.itemId)
    .single();

  return toMcpResult(
    `${count ?? movements.length} movement(s) for item "${item?.name ?? input.itemId}".`,
    buildEnvelope(ctx, {
      status: "ok",
      data: {
        item: item
          ? { id: input.itemId, name: item.name, currentStock: item.current_stock, parLevel: item.par_level, unit: item.unit }
          : null,
        movements: movements.slice(0, limit),
        period: { from: input.fromISO, to: input.toISO },
      },
      pagination,
      meta: { totalCount: count },
    }),
  );
}
