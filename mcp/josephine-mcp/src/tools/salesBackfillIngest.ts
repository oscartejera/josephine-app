import { z } from "zod";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";

export const name = "josephine_sales_backfill_ingest";

export const description =
  "Backfill historical sales data from external sources. " +
  "Currently NOT_SUPPORTED — the repo's raw_events/ingest pipeline requires a specific integration account. " +
  "Use edge functions (square-sync, pos_import) for real POS data import instead.";

export const inputSchema = z.object({
  confirm: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  reason: z.string().optional(),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  source: z.enum(["csv", "square", "manual"]).describe("Data source type"),
  fromISO: z.string().describe("Start date"),
  toISO: z.string().describe("End date"),
  locationId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(_input: Input) {
  const ctx = startContext("josephine_sales_backfill_ingest");

  return toMcpResult(
    "Sales backfill ingest is not currently supported via MCP.",
    buildEnvelope(ctx, {
      status: "not_supported",
      data: null,
      errors: [
        {
          code: "NOT_SUPPORTED",
          message:
            "The raw_events ingest pipeline requires a configured integration_account with OAuth credentials. " +
            "Direct backfill via MCP is not supported.",
          hint:
            "Alternatives: (1) Use the 'square-sync' edge function for Square POS data. " +
            "(2) Use 'pos_import' edge function for CSV imports. " +
            "(3) Use 'seed_pos_365' edge function to seed demo data.",
        },
      ],
    }),
  );
}
