import React, { createContext, useContext } from 'react';
import { useDataSource, DataSourceValue } from '@/hooks/useDataSource';

/**
 * Demo Mode Context
 *
 * Now driven by the centralized resolve_data_source RPC via useDataSource.
 * - dataSource='pos' → isDemoMode = false → real POS data
 * - dataSource='demo' → isDemoMode = true → demo data
 *
 * When isDemoMode is true:
 * - All users see the same data as the admin (Oscar)
 * - All locations are accessible
 * - All permissions are granted for viewing
 * - Actions may still be disabled based on real permissions
 */

// Default demo mode state (used before resolution completes)
export const DEMO_MODE_DEFAULT = true;

// Oscar Admin's user ID - used to fetch permissions in demo mode
export const DEMO_ADMIN_USER_ID = 'oscar-admin-placeholder';

interface DemoModeContextType {
  isDemoMode: boolean;
  demoLabel: string;
  dataSource: DataSourceValue;
  dataSourceReason: string;
  dataSourceBlocked: boolean;
  lastSyncedAt: Date | null;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: DEMO_MODE_DEFAULT,
  demoLabel: 'Demo Mode: mostrando datos del Admin',
  dataSource: 'demo',
  dataSourceReason: 'loading',
  dataSourceBlocked: false,
  lastSyncedAt: null,
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const { dataSource, reason, blocked, loading, lastSyncedAt } = useDataSource();

  // While loading, keep demo mode on (avoids flicker)
  const isDemoMode = loading ? DEMO_MODE_DEFAULT : dataSource === 'demo';

  const demoLabel = isDemoMode
    ? 'Demo Mode: mostrando datos del Admin'
    : '';

  return (
    <DemoModeContext.Provider value={{
      isDemoMode,
      demoLabel,
      dataSource: loading ? 'demo' : dataSource,
      dataSourceReason: reason,
      dataSourceBlocked: blocked,
      lastSyncedAt,
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
