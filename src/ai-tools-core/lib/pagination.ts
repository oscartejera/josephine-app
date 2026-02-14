/**
 * Cursor-based pagination helpers (Deno-safe: uses btoa/atob).
 */

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function decodeCursor(cursor?: string): { offset: number } {
  if (!cursor) return { offset: 0 };
  try {
    const padded = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded));
    return { offset: Math.max(0, Number(decoded.offset) || 0) };
  } catch {
    return { offset: 0 };
  }
}

export function encodeCursor(offset: number): string {
  const json = JSON.stringify({ offset });
  const b64 = btoa(json);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function resolvePagination(input: PaginationInput): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const { offset } = decodeCursor(input.cursor);
  return { limit, offset };
}

export function buildPaginationMeta(
  limit: number,
  offset: number,
  fetchedCount: number,
): PaginationMeta {
  const hasMore = fetchedCount > limit;
  return {
    limit,
    offset,
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    hasMore,
  };
}
