import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { resolvePagination, buildPaginationMeta } from "../lib/pagination.js";

export const name = "josephine_etl_last_runs";

export const description =
  "List recent ETL/integration sync runs. Shows status, duration, and stats for each sync.";

export const inputSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe("Max rows (default 25)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  source: z.string().optional().describe("Filter by provider name (e.g. 'square')"),
  status: z.enum(["success", "failed", "running"]).optional().describe("Filter by run status"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_etl_last_runs");
  const { limit, offset } = resolvePagination(input);
  const supabase = getSupabase();

  // integration_sync_runs joined with integration_accounts for provider info
  let query = supabase
    .from("integration_sync_runs")
    .select(
      "id, integration_account_id, started_at, ended_at, status, cursor, stats, error_text, created_at",
      { count: "exact" },
    )
    .order("started_at", { ascending: false })
    .range(offset, offset + limit);

  if (input.status) {
    // Map our status to DB status values
    const statusMap: Record<string, string[]> = {
      success: ["ok"],
      failed: ["error", "partial"],
      running: ["running"],
    };
    const dbStatuses = statusMap[input.status] ?? [input.status];
    query = query.in("status", dbStatuses);
  }

  const { data, error, count } = await query;

  if (error) {
    return toMcpResult(
      `Failed to query sync runs: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
      }),
    );
  }

  const runs = (data ?? []).map((r) => ({
    id: r.id,
    integrationAccountId: r.integration_account_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    durationSec:
      r.started_at && r.ended_at
        ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000)
        : null,
    stats: r.stats,
    errorText: r.error_text,
  }));

  const pagination = buildPaginationMeta(limit, offset, runs.length);

  return toMcpResult(
    `${count ?? runs.length} sync run(s) found.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: { runs: runs.slice(0, limit) },
      pagination,
      meta: { totalCount: count },
    }),
  );
}
