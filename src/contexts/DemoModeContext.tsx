import React, { createContext, useContext } from 'react';
import { usePOSConnection } from '@/hooks/usePOSConnection';

/**
 * Demo Mode Context
 *
 * Automatically switches based on POS connection status:
 * - POS connected (active integration with sync) → isDemoMode = false → real POS data
 * - No POS connection → isDemoMode = true → simulated demo data
 *
 * When isDemoMode is true:
 * - All users see the same data as the admin (Oscar)
 * - All locations are accessible
 * - All permissions are granted for viewing
 * - Actions may still be disabled based on real permissions
 */

// Default demo mode state (used when no POS is connected)
export const DEMO_MODE_DEFAULT = true;

// Oscar Admin's user ID - used to fetch permissions in demo mode
// This is the reference user whose data scope is used for all users
export const DEMO_ADMIN_USER_ID = 'oscar-admin-placeholder'; // Actual ID resolved at runtime

interface DemoModeContextType {
  isDemoMode: boolean;
  demoLabel: string;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: DEMO_MODE_DEFAULT,
  demoLabel: 'Demo Mode: mostrando datos del Admin'
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const { posConnected, loading: posLoading } = usePOSConnection();

  // While POS connection status is loading, keep demo mode on (avoids flicker)
  // Once loaded: POS connected → demo OFF, no POS → demo ON
  const isDemoMode = posLoading ? DEMO_MODE_DEFAULT : (posConnected ? false : DEMO_MODE_DEFAULT);

  const demoLabel = isDemoMode
    ? 'Demo Mode: mostrando datos del Admin'
    : '';

  return (
    <DemoModeContext.Provider value={{ isDemoMode, demoLabel }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
