/**
 * Idempotency guard with hash-based conflict detection and replay.
 * Deno-safe: uses Web Crypto for hashing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "./runtime.ts";
import type { ToolName } from "./version.ts";

export interface IdempotencyRecord {
  tool_name: string;
  idempotency_key: string;
  request_hash: string;
  status: string;
  created_at: string;
  actor_json: Record<string, unknown> | null;
  reason: string;
  result_json: unknown;
}

/**
 * Compute a stable hash from the input, excluding volatile fields.
 */
export async function computeRequestHash(
  toolName: string,
  input: Record<string, any>,
): Promise<string> {
  const cleaned = { ...input };
  delete cleaned.confirm;
  delete cleaned.idempotencyKey;
  delete cleaned.requestId;

  const normalized = JSON.stringify(
    { tool: toolName, input: cleaned },
    Object.keys({ tool: toolName, input: cleaned }).sort(),
  );
  return sha256Hex(normalized);
}

export type IdempotencyResult =
  | { action: "proceed" }
  | { action: "replay"; record: IdempotencyRecord }
  | { action: "conflict"; record: IdempotencyRecord };

export async function checkIdempotency(
  supabase: SupabaseClient,
  toolName: ToolName,
  idempotencyKey: string,
  requestHash: string,
): Promise<IdempotencyResult> {
  const { data, error } = await supabase
    .from("mcp_idempotency_keys")
    .select("*")
    .eq("tool_name", toolName)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error("Idempotency check error (proceeding):", error.message);
    return { action: "proceed" };
  }

  if (!data) {
    return { action: "proceed" };
  }

  const record = data as unknown as IdempotencyRecord;

  if (record.request_hash === requestHash) {
    return { action: "replay", record };
  }

  return { action: "conflict", record };
}

export async function storeIdempotency(
  supabase: SupabaseClient,
  toolName: ToolName,
  idempotencyKey: string,
  requestHash: string,
  reason: string,
  actor: Record<string, unknown> | null,
  resultJson: unknown,
): Promise<void> {
  const { error } = await supabase.from("mcp_idempotency_keys").upsert(
    {
      tool_name: toolName,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "completed",
      actor_json: actor,
      reason,
      result_json: resultJson,
    },
    { onConflict: "tool_name,idempotency_key" },
  );

  if (error) {
    console.error("Idempotency store error:", error.message);
  }
}
