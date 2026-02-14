import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { resolvePagination, buildPaginationMeta } from "../lib/pagination.js";

export const name = "josephine_inventory_low_stock";

export const description =
  "List inventory items that are below par level (low stock). " +
  "Returns items with current_stock, par_level, and deficit amount.";

export const inputSchema = z.object({
  locationId: z.string().uuid().describe("Location UUID to check inventory for"),
  thresholdMode: z
    .enum(["par", "min"])
    .optional()
    .default("par")
    .describe("'par' = below par_level (default). 'min' = items at zero stock."),
  limit: z.number().min(1).max(100).optional().describe("Max rows (default 25)"),
  cursor: z.string().optional().describe("Pagination cursor"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_inventory_low_stock");
  const { limit, offset } = resolvePagination(input);
  const supabase = getSupabase();
  const warnings: string[] = [];

  // inventory_items is group-scoped, not location-scoped directly.
  // Get the group_id from the location first.
  const { data: loc } = await supabase
    .from("locations")
    .select("group_id")
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

  let query = supabase
    .from("inventory_items")
    .select("id, name, unit, category, current_stock, par_level, last_cost, created_at", { count: "exact" })
    .eq("group_id", loc.group_id)
    .order("name", { ascending: true })
    .range(offset, offset + limit);

  if (input.thresholdMode === "min") {
    // Items at zero or null stock
    query = query.or("current_stock.is.null,current_stock.lte.0");
  } else {
    // Items below par_level
    // We filter in post-processing since Supabase doesn't support cross-column filters easily
    query = query.not("par_level", "is", null);
  }

  const { data, error, count } = await query;

  if (error) {
    return toMcpResult(
      `Failed to query inventory: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  let items = (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    category: item.category,
    currentStock: item.current_stock ?? 0,
    parLevel: item.par_level,
    deficit: item.par_level != null ? Math.max(0, (item.par_level) - (item.current_stock ?? 0)) : null,
    lastCost: item.last_cost,
    belowPar: item.par_level != null && (item.current_stock ?? 0) < item.par_level,
    dataQuality: item.current_stock == null ? "estimated" : "actual",
  }));

  // For "par" mode, filter only items actually below par
  if (input.thresholdMode === "par") {
    items = items.filter((i) => i.belowPar);
  }

  if (items.some((i) => i.dataQuality === "estimated")) {
    warnings.push("Some items have null current_stock (shown as 0). Run a stock count to get accurate data.");
  }

  const pagination = buildPaginationMeta(limit, offset, items.length);

  return toMcpResult(
    `${items.length} item(s) with low stock for location ${input.locationId}.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { items: items.slice(0, limit), locationId: input.locationId },
      pagination,
      warnings: warnings.length > 0 ? warnings : undefined,
      meta: { totalCount: count },
    }),
  );
}
