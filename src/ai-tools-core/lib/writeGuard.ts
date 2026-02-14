/**
 * Write guard with 9 gates. Deno-safe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorCode } from "./errors.ts";
import { checkIdempotency, computeRequestHash, storeIdempotency } from "./idempotency.ts";
import { buildEnvelope, type ResponseContext, type ToolEnvelope } from "./response.ts";
import type { ToolName } from "./version.ts";
import { checkBreaker, recordError, recordSuccess } from "./circuitBreaker.ts";
import { getEnv } from "./runtime.ts";
import type { GuardContext, Execution } from "../types.ts";

export interface WriteInput {
  confirm?: boolean;
  idempotencyKey?: string;
  reason?: string;
  actor?: { name?: string; role?: string } | null;
}

export interface WriteGuardResult {
  action: "execute" | "preview" | "replay" | "error";
  envelope?: ToolEnvelope;
  text?: string;
  execution?: Execution;
  requestHash?: string;
  guardCtx?: GuardContext;
}

function isWriteEnabled(): boolean {
  return (getEnv("JOSEPHINE_MCP_WRITE_ENABLED") ?? getEnv("JOSEPHINE_AI_WRITE_ENABLED") ?? "false").toLowerCase() === "true";
}

function getMaxRows(): number {
  return Math.max(1, parseInt(getEnv("JOSEPHINE_MCP_MAX_ROWS_PER_WRITE") ?? "20000", 10));
}

/**
 * 9-gate write guard.
 *
 * 1. reason → 2. idempotencyKey → 3. idempotency (replay/conflict)
 * 4. circuit breaker → 5. WRITES_ENABLED → 6. actor → 7. bulk-cap → 8. confirm
 * 9. ✅ execute → GuardContext
 */
export async function writeGuard(
  ctx: ResponseContext,
  input: WriteInput,
  fullInput: Record<string, unknown>,
  supabase: SupabaseClient,
  opts?: { estimatedRows?: number },
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
        errors: [{ code: ErrorCode.MISSING_REASON, message: "The 'reason' field is required for all write operations.", hint: 'Add reason: "Adjusting stock after physical count" to your request.' }],
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
        errors: [{ code: ErrorCode.MISSING_IDEMPOTENCY_KEY, message: "The 'idempotencyKey' field is required for all write operations.", hint: 'Add idempotencyKey: "loc-upsert-centro-20260214" (unique per logical operation).' }],
        meta: { execution: "preview" },
      }),
    };
  }

  // 3. Compute hash + check idempotency
  const requestHash = await computeRequestHash(toolName, fullInput);
  const idempResult = await checkIdempotency(supabase, toolName as ToolName, input.idempotencyKey, requestHash);

  if (idempResult.action === "replay") {
    return {
      action: "replay",
      execution: "replay",
      text: `[${toolName}] Replayed — this exact operation was already executed.`,
      envelope: buildEnvelope(ctx, {
        status: "ok",
        data: idempResult.record.result_json,
        meta: { execution: "replay", replay: true, originalCreatedAt: idempResult.record.created_at },
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
        errors: [{ code: ErrorCode.CONFLICT, message: `The idempotencyKey "${input.idempotencyKey}" was already used for a different request payload.`, hint: "Use a new unique idempotencyKey for this different operation." }],
        meta: { execution: "preview", existingHash: idempResult.record.request_hash, newHash: requestHash },
      }),
      requestHash,
    };
  }

  // 4. Circuit breaker
  const breakerStatus = checkBreaker(toolName as ToolName);
  if (breakerStatus) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Circuit breaker open — too many recent errors. Retry in ${breakerStatus.retryAfterSec}s.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        errors: [{ code: ErrorCode.CIRCUIT_OPEN, message: `Circuit breaker is open for ${toolName}.`, hint: `Retry after ${breakerStatus.retryAfterSec} seconds.` }],
        meta: { execution: "preview", retryAfterSec: breakerStatus.retryAfterSec },
      }),
      requestHash,
    };
  }

  // 5. WRITES_ENABLED
  if (!isWriteEnabled()) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Preview only — writes are disabled.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput },
        warnings: ["JOSEPHINE_MCP_WRITE_ENABLED / JOSEPHINE_AI_WRITE_ENABLED is not set to 'true'. No mutation was executed."],
        meta: { execution: "preview", rowsTouched: 0 },
      }),
      requestHash,
    };
  }

  // 6. Actor required
  if (!input.actor || (!input.actor.name && !input.actor.role)) {
    return {
      action: "error",
      text: `[${toolName}] Missing required 'actor' field when writes are enabled.`,
      envelope: buildEnvelope(ctx, {
        status: "error",
        data: null,
        errors: [{ code: ErrorCode.MISSING_ACTOR, message: "The 'actor' field with at least 'name' or 'role' is required when writes are enabled.", hint: 'Add actor: { name: "Oscar", role: "owner" } to your request.' }],
        meta: { execution: "preview" },
      }),
    };
  }

  // 7. Bulk-cap
  const estimated = opts?.estimatedRows ?? 0;
  const maxRows = getMaxRows();
  if (estimated > maxRows) {
    return {
      action: "preview",
      execution: "preview",
      text: `[${toolName}] Bulk-cap exceeded — estimated ${estimated} rows > max ${maxRows}.`,
      envelope: buildEnvelope(ctx, {
        status: "preview",
        data: { mutationPlan: fullInput, estimatedRows: estimated, maxAllowed: maxRows },
        errors: [{ code: ErrorCode.TOO_MANY_ROWS, message: `Estimated ${estimated} rows exceeds the per-request limit of ${maxRows}.`, hint: "Break the operation into smaller batches." }],
        meta: { execution: "preview", rowsTouched: 0, estimatedRows: estimated },
      }),
      requestHash,
    };
  }

  // 8. Confirm gate
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

  // 9. All gates passed
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

export function recordWriteError(toolName: ToolName): void {
  recordError(toolName);
}
