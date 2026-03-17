/**
 * Performance Monitor — measures route change time, RPC call duration,
 * and component mount time in development mode.
 *
 * Console-only; can be connected to analytics later.
 */

const IS_DEV = import.meta.env.DEV;

interface PerfEntry {
  type: 'route-change' | 'rpc-call' | 'component-mount';
  name: string;
  durationMs: number;
  timestamp: number;
}

const entries: PerfEntry[] = [];
const MAX_ENTRIES = 200;

function logEntry(entry: PerfEntry) {
  const { t } = useTranslation();
  if (!IS_DEV) return;

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  const color =
    entry.type === 'route-change'
      ? 'color: #4CAF50'
      : entry.type === 'rpc-call'
        ? 'color: #2196F3'
        : 'color: #FF9800';

  console.log(
    `%c[perf:${entry.type}] ${entry.name} — ${entry.durationMs.toFixed(1)}ms`,
    color
  );
}

// ─── Route Change Timer ──────────────────────────────────────────────
let routeStart = 0;

export function markRouteStart() {
  if (!IS_DEV) return;
  routeStart = performance.now();
}

export function markRouteEnd(routeName: string) {
  if (!IS_DEV || routeStart === 0) return;
  const durationMs = performance.now() - routeStart;
  logEntry({ type: 'route-change', name: routeName, durationMs, timestamp: Date.now() });
  routeStart = 0;
}

// ─── RPC Call Timer ──────────────────────────────────────────────────
export function measureRpc<T>(name: string, fn: () => {t('utils.performanceMonitor.promise')}<T>{t('utils.performanceMonitor.promise1')}<T> {
  if (!IS_DEV) return fn();

  const start = performance.now();
  return fn().finally(() => {
    const durationMs = performance.now() - start;
    logEntry({ type: 'rpc-call', name, durationMs, timestamp: Date.now() });
  });
}

// ─── Component Mount Timer ───────────────────────────────────────────
export function measureMount(componentName: string): () => void {
  if (!IS_DEV) return () => {};

  const start = performance.now();
  return () => {
    const durationMs = performance.now() - start;
    logEntry({ type: 'component-mount', name: componentName, durationMs, timestamp: Date.now() });
  };
}

// ─── Dump all entries (for browser console) ──────────────────────────
export function dumpPerfEntries() {
  if (!IS_DEV) return [];
  console.table(entries.map(e => ({
    type: e.type,
    name: e.name,
    duration: `${e.durationMs.toFixed(1)}ms`,
    time: new Date(e.timestamp).toLocaleTimeString(),
  })));
  return entries;
}

// Expose to window for debugging
if (IS_DEV && typeof window !== 'undefined') {
  (window as any).__josephine_perf = { dumpPerfEntries, entries };
}
