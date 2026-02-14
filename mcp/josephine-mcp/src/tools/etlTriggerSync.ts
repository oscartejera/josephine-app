import { z } from "zod";
import { getSupabase } from "../supabaseClient.js";
import { startContext, buildEnvelope, toMcpResult } from "../lib/response.js";
import { writeGuard, finalizeWrite, recordWriteError, type WriteInput } from "../lib/writeGuard.js";

export const name = "josephine_etl_trigger_sync";

export const description =
  "Trigger an ETL sync via existing Supabase edge functions. " +
  "Supported sources: 'square-sync', 'process-raw-events', 'run_etl'. " +
  "Requires confirm, idempotencyKey, reason, actor.";

const SUPPORTED_FUNCTIONS = new Set([
  "square-sync",
  "process-raw-events",
  "run_etl",
  "pos_import",
]);

export const inputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute"),
  idempotencyKey: z.string().optional().describe("Unique key for this operation"),
  reason: z.string().optional().describe("Why this sync is being triggered"),
  actor: z.object({ name: z.string().optional(), role: z.string().optional() }).optional(),
  source: z.string().describe("Edge function to invoke: 'square-sync', 'process-raw-events', 'run_etl', 'pos_import'"),
  locationId: z.string().uuid().optional().describe("Optional location UUID to scope the sync"),
});

export type Input = z.infer<typeof inputSchema>;

export async function execute(input: Input) {
  const ctx = startContext("josephine_etl_trigger_sync");
  const supabase = getSupabase();

  if (!SUPPORTED_FUNCTIONS.has(input.source)) {
    return toMcpResult(
      `Unsupported sync source: ${input.source}`,
      buildEnvelope(ctx, {
        status: "not_supported",
        data: null,
        errors: [
          {
            code: "NOT_SUPPORTED",
            message: `Source '${input.source}' is not a recognized edge function.`,
            hint: `Supported: ${Array.from(SUPPORTED_FUNCTIONS).join(", ")}`,
          },
        ],
        meta: { execution: "preview" },
      }),
    );
  }

  const guard = await writeGuard(ctx, input as WriteInput, input as Record<string, unknown>, supabase, { estimatedRows: 1 });
  if (guard.action !== "execute") {
    return toMcpResult(guard.text!, guard.envelope!);
  }

  // Invoke the edge function
  const body: Record<string, unknown> = {};
  if (input.locationId) body.location_id = input.locationId;

  const { data, error } = await supabase.functions.invoke(input.source, {
    body,
  });

  if (error) {
    recordWriteError("josephine_etl_trigger_sync");
    return toMcpResult(
      `ETL trigger failed: ${error.message}`,
      buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: "UPSTREAM_ERROR", message: error.message }],
        meta: { execution: "preview" },
      }),
    );
  }

  await finalizeWrite(supabase, guard.guardCtx!, { source: input.source, response: data });

  return toMcpResult(
    `ETL sync '${input.source}' triggered successfully.`,
    buildEnvelope(ctx, {
      status: "ok",
      data: {
        source: input.source,
        locationId: input.locationId ?? null,
        response: data,
      },
      meta: { execution: "executed", rowsTouched: 0 },
    }),
  );
}
