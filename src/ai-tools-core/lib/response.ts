/**
 * Stable envelope contract for all tool responses.
 * Deno-safe: uses crypto.randomUUID() (Web standard).
 */

import { TOOL_VERSIONS, getServerVersion, type ToolName } from "./version.ts";
import type { PaginationMeta } from "./pagination.ts";
import type { ErrorCodeValue } from "./errors.ts";
import { generateUUID } from "./runtime.ts";

export interface ToolEnvelope<T = unknown> {
  status: "ok" | "preview" | "error" | "not_supported";
  requestId: string;
  durationMs: number;
  serverVersion: string;
  toolVersion: string;
  data: T;
  pagination?: PaginationMeta;
  warnings?: string[];
  errors?: Array<{ code: ErrorCodeValue; message: string; hint?: string | null }>;
  meta?: Record<string, unknown>;
}

export interface ResponseContext {
  requestId: string;
  startMs: number;
  toolName: ToolName;
}

export function startContext(toolName: ToolName): ResponseContext {
  return {
    requestId: generateUUID(),
    startMs: performance.now(),
    toolName,
  };
}

export function buildEnvelope<T>(
  ctx: ResponseContext,
  opts: {
    status: ToolEnvelope["status"];
    data: T;
    pagination?: PaginationMeta;
    warnings?: string[];
    errors?: ToolEnvelope["errors"];
    meta?: Record<string, unknown>;
  },
): ToolEnvelope<T> {
  return {
    status: opts.status,
    requestId: ctx.requestId,
    durationMs: Math.round(performance.now() - ctx.startMs),
    serverVersion: getServerVersion(),
    toolVersion: TOOL_VERSIONS[ctx.toolName],
    data: opts.data,
    ...(opts.pagination && { pagination: opts.pagination }),
    ...(opts.warnings?.length && { warnings: opts.warnings }),
    ...(opts.errors?.length && { errors: opts.errors }),
    ...(opts.meta && Object.keys(opts.meta).length > 0 && { meta: opts.meta }),
  };
}
