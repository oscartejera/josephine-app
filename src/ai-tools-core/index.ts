/**
 * ai-tools-core barrel export.
 * Portable: .ts extensions + bare specifiers (use import map for Deno).
 */

// Lib
export { ErrorCode, McpToolError, formatError } from "./lib/errors.ts";
export type { ErrorCodeValue } from "./lib/errors.ts";
export { TOOL_VERSIONS, setServerVersion, getServerVersion } from "./lib/version.ts";
export type { ToolName } from "./lib/version.ts";
export { generateUUID, getEnv, sha256Hex } from "./lib/runtime.ts";
export { resolvePagination, buildPaginationMeta, decodeCursor, encodeCursor } from "./lib/pagination.ts";
export type { PaginationInput, PaginationMeta } from "./lib/pagination.ts";
export { startContext, buildEnvelope } from "./lib/response.ts";
export type { ToolEnvelope, ResponseContext } from "./lib/response.ts";
export { computeRequestHash, checkIdempotency, storeIdempotency } from "./lib/idempotency.ts";
export { writeGuard, finalizeWrite, recordWriteError } from "./lib/writeGuard.ts";
export type { WriteInput, WriteGuardResult } from "./lib/writeGuard.ts";
export { checkBreaker, recordSuccess, recordError, resetAllBreakers } from "./lib/circuitBreaker.ts";

// Types
export type { TenantContext, ToolClients, ToolExecutionContext, GuardContext, Execution, ToolMeta } from "./types.ts";

// Registry
export { registerToolHandler, getToolEntry, listTools, listToolNames, TOOL_METADATA, buildToolMeta } from "./registry.ts";
export type { ToolHandler } from "./registry.ts";
