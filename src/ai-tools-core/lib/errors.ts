/**
 * Stable error codes for tool responses.
 */
export const ErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_CONFIRM: "MISSING_CONFIRM",
  MISSING_IDEMPOTENCY_KEY: "MISSING_IDEMPOTENCY_KEY",
  MISSING_REASON: "MISSING_REASON",
  MISSING_ACTOR: "MISSING_ACTOR",
  WRITES_DISABLED: "WRITES_DISABLED",
  RLS_DENIED: "RLS_DENIED",
  NOT_FOUND: "NOT_FOUND",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  CONFLICT: "CONFLICT",
  TOO_MANY_ROWS: "TOO_MANY_ROWS",
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class McpToolError extends Error {
  constructor(
    public readonly code: ErrorCodeValue,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

export function formatError(code: ErrorCodeValue, message: string, hint?: string) {
  return { code, message, hint: hint ?? null };
}
