import { randomUUID } from "node:crypto";
import { SERVER_VERSION, TOOL_VERSIONS, type ToolName } from "./version.js";
import type { PaginationMeta } from "./pagination.js";
import type { ErrorCodeValue } from "./errors.js";

/**
 * Stable envelope contract for all MCP tool responses.
 *
 * Every tool returns:
 *   { status, requestId, durationMs, serverVersion, toolVersion, data, ... }
 */
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
    requestId: randomUUID(),
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
    serverVersion: SERVER_VERSION,
    toolVersion: TOOL_VERSIONS[ctx.toolName],
    data: opts.data,
    ...(opts.pagination && { pagination: opts.pagination }),
    ...(opts.warnings?.length && { warnings: opts.warnings }),
    ...(opts.errors?.length && { errors: opts.errors }),
    ...(opts.meta && Object.keys(opts.meta).length > 0 && { meta: opts.meta }),
  };
}

/**
 * Format a tool envelope into the two-channel MCP response:
 *   - text: brief human-readable summary
 *   - structuredContent: full JSON envelope
 */
export function toMcpResult(
  textSummary: string,
  envelope: ToolEnvelope,
): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      { type: "text" as const, text: textSummary },
      {
        type: "text" as const,
        text: "```json\n" + JSON.stringify(envelope, null, 2) + "\n```",
      },
    ],
  };
}
