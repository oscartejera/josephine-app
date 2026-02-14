/**
 * Cursor-based pagination helpers.
 *
 * Cursor is a base64-encoded JSON object: { offset: number }.
 * Kept simple — can evolve to keyset pagination per tool later.
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
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
    return { offset: Math.max(0, Number(decoded.offset) || 0) };
  } catch {
    return { offset: 0 };
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url");
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
