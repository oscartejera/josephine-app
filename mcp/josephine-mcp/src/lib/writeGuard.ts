import type { SupabaseClient } from "@supabase/supabase-js";
import { McpToolError, ErrorCode } from "./errors.js";
import {
  checkIdempotency,
  computeRequestHash,
  storeIdempotency,
  type IdempotencyResult,
} from "./idempotency.js";
import { buildEnvelope, type ResponseContext, type ToolEnvelope } from "./response.js";
import type { ToolName } from "./version.js";

export interface WriteInput {
  confirm?: boolean;
  idempotencyKey?: string;
  reason?: string;
  actor?: { name?: string; role?: string } | null;
}

export interface WriteGuardResult {
  /** "execute" = proceed with the mutation */
  action: "execute" | "preview" | "replay" | "error";
  /** Pre-built envelope for non-execute cases */
  envelope?: ToolEnvelope;
  text?: string;
  requestHash?: string;
}

const WRITES_ENABLED =
  (process.env.JOSEPHINE_MCP_WRITE_ENABLED ?? "false").toLowerCase() === "true";

/**
 * Validates all write preconditions. Returns { action: "execute" } only when
 * ALL gates pass. Otherwise returns a ready-to-send envelope.
 */
export async function writeGuard(
  ctx: ResponseContext,
  input: WriteInput,
  fullInput: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<WriteGuardResult> {
  const toolName = ctx.toolName;

  // 1. Missing reason
  if (!input.reason || input.reason.trim().length === 0) {
    return {
      action: "error",
      text: `[${toolName}] Missing required 'reason' field.`,
      envelope: buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [
          {
            code: ErrorCode.MISSING_REASON,
            message: "The 'reason' field is required for all write operations.",
            hint: 'Add reason: "Adjusting stock after physical count" to your request.',
          },
        ],
      }),
    };
  }

  // 2. Missing idempotencyKey
  if (!input.idempotencyKey || input.idempotencyKey.trim().length === 0) {
    return {
      action: "error",
      text: `[${toolName}] Missing required 'idempotencyKey' field.`,
      envelope: buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [
          {
            code: ErrorCode.MISSING_IDEMPOTENCY_KEY,
            message: "The 'idempotencyKey' field is required for all write operations.",
            hint: 'Add idempotencyKey: "loc-upsert-centro-20260214" (unique per logical operation).',
          },
        ],
      }),
    };
  }

  // 3. Compute request hash for idempotency
  const requestHash = computeRequestHash(toolName, fullInput);

  // 4. Check idempotency (replay/conflict)
  const idempResult: IdempotencyResult = await checkIdempotency(
    supabase,
    toolName as ToolName,
    input.idempotencyKey,
    requestHash,
  );

  if (idempResult.action === "replay") {
    return {
      action: "replay",
      text: `[${toolName}] Replayed — this exact operation was already executed.`,
      envelope: buildEnvelope(ctx, {
        status: "ok",
        data: idempResult.record.result_json,
        meta: { replay: true, originalCreatedAt: idempResult.record.created_at },
      }),
      requestHash,
    };
  }

  if (idempResult.action === "conflict") {
    return {
      action: "error",
      text: `[${toolName}] Conflict — idempotencyKey already used for a different payload.`,
      envelope: buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [
          {
            code: ErrorCode.CONFLICT,
            message: `The idempotencyKey "${input.idempotencyKey}" was already used for a different request payload.`,
            hint: "Use a new unique idempotencyKey for this different operation.",
          },
        ],
        meta: {
          existingHash: idempResult.record.request_hash,
          newHash: requestHash,
        },
      }),
      requestHash,
    };
  }

  // 5. WRITE ENABLE FLAG gate
  if (!WRITES_ENABLED) {
    return {
      action: "preview",
      text: `[${toolName}] Preview only — writes are disabled. Set JOSEPHINE_MCP_WRITE_ENABLED=true to enable.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        warnings: [
          "JOSEPHINE_MCP_WRITE_ENABLED is not set to 'true'. No mutation was executed.",
          "To enable writes, set the environment variable JOSEPHINE_MCP_WRITE_ENABLED=true and restart the MCP server.",
        ],
      }),
      requestHash,
    };
  }

  // 6. Missing or false confirm
  if (input.confirm !== true) {
    return {
      action: "preview",
      text: `[${toolName}] Preview only — confirm must be true to execute.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        warnings: ["Set confirm: true to execute this write operation."],
      }),
      requestHash,
    };
  }

  return { action: "execute", requestHash };
}

/**
 * After a successful write, store the idempotency record.
 */
export async function finalizeWrite(
  supabase: SupabaseClient,
  toolName: ToolName,
  input: WriteInput,
  requestHash: string,
  result: unknown,
): Promise<void> {
  await storeIdempotency(
    supabase,
    toolName,
    input.idempotencyKey!,
    requestHash,
    input.reason!,
    (input.actor as Record<string, unknown>) ?? null,
    result,
  );
}
