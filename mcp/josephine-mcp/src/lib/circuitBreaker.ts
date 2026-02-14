/**
 * In-memory circuit breaker per tool.
 *
 * If a write tool produces N consecutive errors within a time window,
 * the breaker opens and the tool returns preview-only for a cooldown period.
 *
 * Config via env vars (all integers):
 *   JOSEPHINE_MCP_BREAKER_THRESHOLD    — errors to trip (default 10)
 *   JOSEPHINE_MCP_BREAKER_WINDOW_SEC   — rolling window (default 60)
 *   JOSEPHINE_MCP_BREAKER_COOLDOWN_SEC — preview-only duration (default 60)
 */

import type { ToolName } from "./version.js";

const THRESHOLD = Math.max(1, parseInt(process.env.JOSEPHINE_MCP_BREAKER_THRESHOLD ?? "10", 10));
const WINDOW_MS = Math.max(1000, parseInt(process.env.JOSEPHINE_MCP_BREAKER_WINDOW_SEC ?? "60", 10) * 1000);
const COOLDOWN_MS = Math.max(1000, parseInt(process.env.JOSEPHINE_MCP_BREAKER_COOLDOWN_SEC ?? "60", 10) * 1000);

interface BreakerState {
  /** Timestamps (ms) of recent errors within the rolling window */
  errorTimestamps: number[];
  /** When the breaker opened (null if closed) */
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

/**
 * Check if the breaker is open for a tool.
 * Returns null if closed, or { retryAfterSec } if open.
 */
export function checkBreaker(tool: ToolName): { retryAfterSec: number } | null {
  const state = getState(tool);
  const now = Date.now();

  if (state.openedAt) {
    const elapsed = now - state.openedAt;
    if (elapsed < COOLDOWN_MS) {
      return { retryAfterSec: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
    }
    // Cooldown expired — reset breaker
    state.openedAt = null;
    state.errorTimestamps = [];
  }
  return null;
}

/**
 * Record a successful execution — resets the error counter for the tool.
 */
export function recordSuccess(tool: ToolName): void {
  const state = getState(tool);
  state.errorTimestamps = [];
  state.openedAt = null;
}

/**
 * Record an error. If threshold is exceeded within window, the breaker trips.
 * Returns true if the breaker just tripped.
 */
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

/** Visible for testing — reset all breakers. */
export function resetAllBreakers(): void {
  breakers.clear();
}

export { THRESHOLD as BREAKER_THRESHOLD, WINDOW_MS as BREAKER_WINDOW_MS, COOLDOWN_MS as BREAKER_COOLDOWN_MS };
