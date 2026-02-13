/**
 * DataSourceContext — Single source of truth for the effective data source.
 *
 * Wraps `useDataSource()` exactly once at the top of the provider tree so that
 * every consumer (DemoModeContext, AppContext, DataSourceBadge, Settings, …)
 * reads from the same resolved state without duplicating RPC calls or
 * Realtime subscriptions.
 *
 * Consumers should use `useEffectiveDataSource()` instead of importing this
 * context directly.
 */

import React, { createContext, useMemo } from 'react';
import { useDataSource, type DataSourceValue } from '@/hooks/useDataSource';

export interface EffectiveDataSourceState {
  /** Canonical resolved value: every feature reads this. */
  dsUnified: DataSourceValue;
  /** Resolution mode from org_settings. */
  mode: 'auto' | 'manual';
  /** Machine-readable reason (e.g. 'auto_pos_recent'). */
  reason: string;
  /** Last successful POS sync timestamp, if any. */
  lastSyncedAt: Date | null;
  /** True while the initial RPC call is in-flight. */
  isLoading: boolean;
  /** True when manual=pos but sync is stale (>24 h). */
  blocked: boolean;
  /** Re-trigger resolution (e.g. after settings change). */
  refetch: () => void;
}

export const DataSourceContext = createContext<EffectiveDataSourceState | null>(
  null,
);

export function DataSourceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dataSource, mode, reason, lastSyncedAt, loading, blocked, refetch } =
    useDataSource();

  const value = useMemo<EffectiveDataSourceState>(
    () => ({
      dsUnified: dataSource,
      mode,
      reason,
      lastSyncedAt,
      isLoading: loading,
      blocked,
      refetch,
    }),
    [dataSource, mode, reason, lastSyncedAt, loading, blocked, refetch],
  );

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}
