import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { resolvePagination, buildPaginationMeta } from "../lib/pagination.js";

export const name = "josephine_locations_list";

export const description =
  "List all restaurant locations. Supports pagination and filtering by active status.";

export const inputSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe("Max rows to return (1-100, default 25)"),
  cursor: z.string().optional().describe("Pagination cursor from a previous response"),
  includeInactive: z.boolean().optional().default(false).describe("Include inactive locations (default false)"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_locations_list");
  const { limit, offset } = resolvePagination(input);
  const supabase = getSupabase();

  let query = supabase
    .from("locations")
    .select("id, name, city, timezone, currency, active, group_id, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit); // fetch limit+1 for hasMore

  if (!input.includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error, count } = await query;

  if (error) {
    return toMcpResult(
      `Failed to list locations: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message, hint: error.hint ?? null }],
      }),
    );
  }

  const rows = data ?? [];
  const pagination = buildPaginationMeta(limit, offset, rows.length);
  const items = rows.slice(0, limit);

  return toMcpResult(
    `Found ${count ?? items.length} location(s).`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { locations: items },
      pagination,
      meta: { totalCount: count ?? items.length },
    }),
  );
}
