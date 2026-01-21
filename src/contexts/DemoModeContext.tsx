import React, { createContext, useContext } from 'react';

/**
 * Demo Mode Context
 * 
 * When DEMO_MODE is true:
 * - All users see the same data as the admin (Oscar)
 * - All locations are accessible
 * - All permissions are granted for viewing
 * - Actions may still be disabled based on real permissions
 */

// Demo mode is ON - all users see admin data
export const DEMO_MODE = true;

// Oscar Admin's user ID - used to fetch permissions in demo mode
// This is the reference user whose data scope is used for all users
export const DEMO_ADMIN_USER_ID = 'oscar-admin-placeholder'; // Actual ID resolved at runtime

interface DemoModeContextType {
  isDemoMode: boolean;
  demoLabel: string;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: DEMO_MODE,
  demoLabel: 'Demo Mode: mostrando datos del Admin'
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeContext.Provider value={{
      isDemoMode: DEMO_MODE,
      demoLabel: 'Demo Mode: mostrando datos del Admin'
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
