import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";

export const name = "josephine_purchases_build_po_suggestion";

export const description =
  "Generate a purchase order suggestion based on current stock vs par levels. " +
  "Read-only workflow tool — does not create any records. Uses procurement_suggestions table if available.";

export const inputSchema = z.object({
  locationId: z.string().uuid().describe("Location UUID"),
  strategy: z
    .enum(["min_to_par", "forecast_based"])
    .optional()
    .default("min_to_par")
    .describe("Strategy: 'min_to_par' (fill to par level) or 'forecast_based' (use forecasted usage)"),
  maxItems: z.number().min(1).max(200).optional().default(50).describe("Max items in suggestion"),
  supplierId: z.string().uuid().optional().describe("Filter to items from a specific supplier"),
  fromISO: z.string().optional().describe("Forecast window start (for forecast_based strategy)"),
  toISO: z.string().optional().describe("Forecast window end"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_purchases_build_po_suggestion");
  const supabase = getSupabase();
  const warnings: string[] = [];

  // Get group_id from location
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

  // First try procurement_suggestions (AI-generated)
  const { data: suggestions } = await supabase
    .from("procurement_suggestions")
    .select("*")
    .eq("location_id", input.locationId)
    .eq("status", "pending")
    .order("urgency", { ascending: true })
    .limit(input.maxItems);

  if (suggestions && suggestions.length > 0) {
    const lines = suggestions.map((s) => ({
      itemId: s.item_id,
      suggestedQty: Number(s.suggested_qty),
      currentStock: Number(s.current_stock),
      forecastedUsage: Number(s.forecasted_usage),
      daysOfStockRemaining: Number(s.days_of_stock_remaining),
      urgency: s.urgency,
      estimatedCost: Number(s.estimated_cost),
      rationale: s.rationale,
      deliveryNeededBy: s.delivery_needed_by,
    }));

    const totalEstCost = lines.reduce((s, l) => s + l.estimatedCost, 0);

    return toMcpResult(
      `${lines.length} AI-generated procurement suggestion(s) for ${loc.name}.`,
      buildEnvelope(ctx, {
        status: "ok",
        data: {
          source: "procurement_suggestions",
          locationId: input.locationId,
          locationName: loc.name,
          strategy: "ai_generated",
          lines,
          totals: { lineCount: lines.length, estimatedCost: Math.round(totalEstCost * 100) / 100 },
          dataQuality: { source: "procurement_suggestions", coverage: "full" },
        },
      }),
    );
  }

  // Fallback: compute from inventory_items par levels
  warnings.push("No AI procurement suggestions found. Using simple par-level gap analysis.");

  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, unit, current_stock, par_level, last_cost, category")
    .eq("group_id", loc.group_id)
    .not("par_level", "is", null)
    .order("name")
    .limit(input.maxItems);

  const belowPar = (items ?? [])
    .filter((i) => (i.current_stock ?? 0) < (i.par_level ?? 0))
    .map((i) => {
      const deficit = (i.par_level ?? 0) - (i.current_stock ?? 0);
      return {
        itemId: i.id,
        itemName: i.name,
        unit: i.unit ?? "units",
        category: i.category,
        currentStock: i.current_stock ?? 0,
        parLevel: i.par_level ?? 0,
        suggestedQty: deficit,
        estimatedCost: deficit * (i.last_cost ?? 0),
        rationale: `Below par by ${deficit} ${i.unit ?? "units"}`,
        urgency: (i.current_stock ?? 0) <= 0 ? "critical" : deficit > (i.par_level ?? 1) * 0.5 ? "high" : "medium",
        dataQuality: i.current_stock == null ? "estimated" : "actual",
      };
    })
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 3) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 3);
    });

  if (belowPar.some((i) => i.dataQuality === "estimated")) {
    warnings.push("Some items have null current_stock (treated as 0). Run a stock count for accuracy.");
  }

  const totalEstCost = belowPar.reduce((s, l) => s + l.estimatedCost, 0);

  return toMcpResult(
    `${belowPar.length} item(s) below par for ${loc.name}. Estimated reorder cost: EUR ${Math.round(totalEstCost)}.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: {
        source: "par_level_analysis",
        locationId: input.locationId,
        locationName: loc.name,
        strategy: input.strategy,
        lines: belowPar,
        totals: { lineCount: belowPar.length, estimatedCost: Math.round(totalEstCost * 100) / 100 },
        dataQuality: {
          source: "inventory_items.par_level",
          coverage: items?.length ? "partial" : "none",
          warning: belowPar.some((i) => i.dataQuality === "estimated")
            ? "Some stock levels are estimated (null → 0)"
            : null,
        },
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    }),
  );
}
