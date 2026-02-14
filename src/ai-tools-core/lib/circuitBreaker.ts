/**
 * In-memory circuit breaker per tool (Deno-safe).
 *
 * Note: In serverless (Edge Functions), this is per-isolate (not global).
 * For distributed breaker, use a shared store (Redis, DB).
 */

import { getEnv } from "./runtime.ts";
import type { ToolName } from "./version.ts";

const THRESHOLD = Math.max(1, parseInt(getEnv("JOSEPHINE_MCP_BREAKER_THRESHOLD") ?? "10", 10));
const WINDOW_MS = Math.max(1000, parseInt(getEnv("JOSEPHINE_MCP_BREAKER_WINDOW_SEC") ?? "60", 10) * 1000);
const COOLDOWN_MS = Math.max(1000, parseInt(getEnv("JOSEPHINE_MCP_BREAKER_COOLDOWN_SEC") ?? "60", 10) * 1000);

interface BreakerState {
  errorTimestamps: number[];
  openedAt: number | null;
}

const breakers = new Map<string, BreakerState>();

function getState(tool: string): BreakerState {
  let s = breakers.get(tool);
  if (!s) {
    s = { errorTimestamps: [], openedAt: null };
    breakers.set(tool, s);
  }
  return s;
}

function pruneWindow(state: BreakerState, now: number): void {
  const cutoff = now - WINDOW_MS;
  state.errorTimestamps = state.errorTimestamps.filter((t) => t > cutoff);
}

export function checkBreaker(tool: ToolName): { retryAfterSec: number } | null {
  const state = getState(tool);
  const now = Date.now();

  if (state.openedAt) {
    const elapsed = now - state.openedAt;
    if (elapsed < COOLDOWN_MS) {
      return { retryAfterSec: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
    }
    state.openedAt = null;
    state.errorTimestamps = [];
  }
  return null;
}

export function recordSuccess(tool: ToolName): void {
  const state = getState(tool);
  state.errorTimestamps = [];
  state.openedAt = null;
}

export function recordError(tool: ToolName): boolean {
  const state = getState(tool);
  const now = Date.now();
  pruneWindow(state, now);
  state.errorTimestamps.push(now);

  if (state.errorTimestamps.length >= THRESHOLD && !state.openedAt) {
    state.openedAt = now;
    return true;
  }
  return false;
}

export function resetAllBreakers(): void {
  breakers.clear();
}
