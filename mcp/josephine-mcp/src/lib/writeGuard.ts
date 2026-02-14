import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorCode } from "./errors.js";
import {
  checkIdempotency,
  computeRequestHash,
  storeIdempotency,
  type IdempotencyResult,
} from "./idempotency.js";
import { buildEnvelope, type ResponseContext, type ToolEnvelope } from "./response.js";
import type { ToolName } from "./version.js";
import { checkBreaker, recordError, recordSuccess } from "./circuitBreaker.js";

// ── Types ────────────────────────────────────────────────────────

export interface WriteInput {
  confirm?: boolean;
  idempotencyKey?: string;
  reason?: string;
  actor?: { name?: string; role?: string } | null;
}

export type Execution = "executed" | "replay" | "preview";

export interface WriteGuardResult {
  /** "execute" = proceed with the mutation */
  action: "execute" | "preview" | "replay" | "error";
  /** Pre-built envelope for non-execute cases */
  envelope?: ToolEnvelope;
  text?: string;
  /** The execution disposition — always present for non-error responses */
  execution?: Execution;
  requestHash?: string;
}

/**
 * Opaque context produced by writeGuard when action="execute".
 * Only this type is accepted by finalizeWrite — prevents bypass.
 */
export interface GuardContext {
  readonly __brand: "GuardContext";
  readonly toolName: ToolName;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly reason: string;
  readonly actor: Record<string, unknown> | null;
}

// ── Config ───────────────────────────────────────────────────────

const WRITES_ENABLED =
  (process.env.JOSEPHINE_MCP_WRITE_ENABLED ?? "false").toLowerCase() === "true";

const MAX_ROWS_PER_WRITE = Math.max(
  1,
  parseInt(process.env.JOSEPHINE_MCP_MAX_ROWS_PER_WRITE ?? "20000", 10),
);

export { MAX_ROWS_PER_WRITE };

// ── Write guard ──────────────────────────────────────────────────

/**
 * Validates all write preconditions. Returns { action: "execute", guardCtx }
 * only when ALL gates pass. Otherwise returns a ready-to-send envelope.
 *
 * Gate order:
 *   1. reason
 *   2. idempotencyKey
 *   3. idempotency check (replay / conflict)
 *   4. circuit breaker
 *   5. WRITES_ENABLED
 *   6. actor (required when writes enabled)
 *   7. bulk-cap (estimatedRows)
 *   8. confirm
 */
export async function writeGuard(
  ctx: ResponseContext,
  input: WriteInput,
  fullInput: Record<string, unknown>,
  supabase: SupabaseClient,
  opts?: { estimatedRows?: number },
): Promise<WriteGuardResult & { guardCtx?: GuardContext }> {
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
        meta: { execution: "preview" },
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
        meta: { execution: "preview" },
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
      execution: "replay",
      text: `[${toolName}] Replayed — this exact operation was already executed.`,
      envelope: buildEnvelope(ctx, {
        status: "ok",
        data: idempResult.record.result_json,
        meta: {
          execution: "replay",
          replay: true,
          originalCreatedAt: idempResult.record.created_at,
        },
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
          execution: "preview",
          existingHash: idempResult.record.request_hash,
          newHash: requestHash,
        },
      }),
      requestHash,
    };
  }

  // 5. Circuit breaker
  const breakerStatus = checkBreaker(toolName as ToolName);
  if (breakerStatus) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Circuit breaker open — too many recent errors. Retry in ${breakerStatus.retryAfterSec}s.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        errors: [
          {
            code: ErrorCode.CIRCUIT_OPEN,
            message: `Circuit breaker is open for ${toolName}. Too many consecutive errors.`,
            hint: `Retry after ${breakerStatus.retryAfterSec} seconds, or investigate upstream errors.`,
          },
        ],
        meta: { execution: "preview", retryAfterSec: breakerStatus.retryAfterSec },
      }),
      requestHash,
    };
  }

  // 6. WRITE ENABLE FLAG gate
  if (!WRITES_ENABLED) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Preview only — writes are disabled. Set JOSEPHINE_MCP_WRITE_ENABLED=true to enable.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        warnings: [
          "JOSEPHINE_MCP_WRITE_ENABLED is not set to 'true'. No mutation was executed.",
          "To enable writes, set the environment variable JOSEPHINE_MCP_WRITE_ENABLED=true and restart the MCP server.",
        ],
        meta: { execution: "preview", rowsTouched: 0 },
      }),
      requestHash,
    };
  }

  // 7. Actor required when writes are enabled
  if (!input.actor || (!input.actor.name && !input.actor.role)) {
    return {
      action: "error",
      text: `[${toolName}] Missing required 'actor' field when writes are enabled.`,
      envelope: buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [
          {
            code: ErrorCode.MISSING_ACTOR,
            message: "The 'actor' field with at least 'name' or 'role' is required when writes are enabled.",
            hint: 'Add actor: { name: "Oscar", role: "owner" } to your request.',
          },
        ],
        meta: { execution: "preview" },
      }),
    };
  }

  // 8. Bulk-cap per request
  const estimated = opts?.estimatedRows ?? 0;
  if (estimated > MAX_ROWS_PER_WRITE) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Bulk-cap exceeded — estimated ${estimated} rows > max ${MAX_ROWS_PER_WRITE}.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput, estimatedRows: estimated, maxAllowed: MAX_ROWS_PER_WRITE },
        errors: [
          {
            code: ErrorCode.TOO_MANY_ROWS,
            message: `Estimated ${estimated} rows exceeds the per-request limit of ${MAX_ROWS_PER_WRITE}.`,
            hint: "Break the operation into smaller batches or increase JOSEPHINE_MCP_MAX_ROWS_PER_WRITE.",
          },
        ],
        meta: { execution: "preview", rowsTouched: 0, estimatedRows: estimated },
      }),
      requestHash,
    };
  }

  // 9. Missing or false confirm
  if (input.confirm !== true) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Preview only — confirm must be true to execute.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        warnings: ["Set confirm: true to execute this write operation."],
        meta: { execution: "preview", rowsTouched: 0 },
      }),
      requestHash,
    };
  }

  // All gates passed — produce GuardContext
  const guardCtx: GuardContext = {
    __brand: "GuardContext" as const,
    toolName: toolName as ToolName,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    reason: input.reason,
    actor: (input.actor as Record<string, unknown>) ?? null,
  };

  return { action: "execute", execution: "executed", requestHash, guardCtx };
}

// ── Finalize write ───────────────────────────────────────────────

/**
 * After a successful write, store the idempotency record and reset the breaker.
 * Only accepts GuardContext to prevent bypass.
 */
export async function finalizeWrite(
  supabase: SupabaseClient,
  guardCtx: GuardContext,
  result: unknown,
): Promise<void> {
  await storeIdempotency(
    supabase,
    guardCtx.toolName,
    guardCtx.idempotencyKey,
    guardCtx.requestHash,
    guardCtx.reason,
    guardCtx.actor,
    result,
  );
  recordSuccess(guardCtx.toolName);
}

/**
 * Record a write error and trip the breaker if threshold is exceeded.
 */
export function recordWriteError(toolName: ToolName): void {
  recordError(toolName);
}
