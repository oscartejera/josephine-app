import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { DEMO_MODE } from './DemoModeContext';

function isTransientDataError(err: unknown): boolean {
  const anyErr = err as any;
  const code = anyErr?.code;
  const status = anyErr?.status;
  const msg = String(anyErr?.message ?? '');
  return (
    code === 'PGRST002' ||
    status === 503 ||
    status === 504 ||
    msg.toLowerCase().includes('schema cache')
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 5, initialDelayMs = 350): Promise<T> {
  let lastErr: unknown;
  let delay = initialDelayMs;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransientDataError(e) || i === retries) break;
      await sleep(delay);
      delay = Math.min(2500, delay * 2);
    }
  }
  throw lastErr;
}

export interface Location {
  id: string;
  name: string;
  city: string | null;
}

interface Group {
  id: string;
  name: string;
}

type DateRange = 'today' | '7d' | '30d' | 'custom';

interface AppContextType {
  group: Group | null;
  locations: Location[];
  accessibleLocations: Location[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  setSelectedLocationId: (id: string | null) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  customDateRange: { from: Date; to: Date } | null;
  setCustomDateRange: (range: { from: Date; to: Date } | null) => void;
  getDateRangeValues: () => { from: Date; to: Date };
  loading: boolean;
  canShowAllLocations: boolean;
  needsOnboarding: boolean;
  setOnboardingComplete: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, isOwner, hasGlobalScope, accessibleLocationIds, refreshProfile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationIdInternal] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Detect if user needs onboarding (no group_id)
  const needsOnboarding = !DEMO_MODE && !loading && profile !== null && profile.group_id === null && !onboardingCompleted;

  const setOnboardingComplete = async () => {
    setOnboardingCompleted(true);
    // Refresh profile to get new group_id
    await refreshProfile();
  };

  // In DEMO_MODE, everyone can see all locations
  const canShowAllLocations = DEMO_MODE ? true : (isOwner || hasGlobalScope);

  // In DEMO_MODE, all locations are accessible
  const accessibleLocations = React.useMemo(() => {
    if (DEMO_MODE) {
      return locations;
    }
    if (isOwner || hasGlobalScope) {
      return locations;
    }
    return locations.filter(l => accessibleLocationIds.includes(l.id));
  }, [locations, isOwner, hasGlobalScope, accessibleLocationIds]);

  useEffect(() => {
    if (profile?.group_id) {
      fetchGroupAndLocations(profile.group_id);
    } else {
      setLoading(false);
    }
  }, [profile?.group_id]);

  // Set default location when accessible locations change
  useEffect(() => {
    if (accessibleLocations.length > 0 && !selectedLocationId) {
      // Set default location
      if (canShowAllLocations) {
        setSelectedLocationIdInternal('all');
      } else {
        setSelectedLocationIdInternal(accessibleLocations[0].id);
      }
    }
  }, [accessibleLocations, selectedLocationId, canShowAllLocations]);

  const fetchGroupAndLocations = async (groupId: string) => {
    setLoading(true);
    try {
      const [groupResult, locationsResult] = await withRetry(async () => {
        const res = await Promise.all([
          // Use maybeSingle to avoid throwing when group not found.
          supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
          supabase.from('locations').select('id, name, city').eq('group_id', groupId).eq('active', true)
        ]);

        // surface transient errors for retry
        if ((res[0] as any)?.error) throw (res[0] as any).error;
        if ((res[1] as any)?.error) throw (res[1] as any).error;
        return res;
      });

      if (groupResult.data) {
        setGroup(groupResult.data);
      }
      if (locationsResult.data) {
        setLocations(locationsResult.data);
      }
    } catch (e) {
      // Keep previous state instead of blanking the UI during transient outages
      console.warn('[AppContext] fetchGroupAndLocations failed', e);
    } finally {
      setLoading(false);
    }
  };

  // Wrapped setter - in DEMO_MODE, all locations are valid
  const setSelectedLocationId = (id: string | null) => {
    // In DEMO_MODE, all selections are valid
    if (DEMO_MODE) {
      setSelectedLocationIdInternal(id);
      return;
    }

    // Production mode - validate access
    if (id === 'all' && !canShowAllLocations) {
      return;
    }

    if (id && id !== 'all' && !isOwner && !hasGlobalScope) {
      const hasAccess = accessibleLocationIds.includes(id);
      if (!hasAccess) {
        return;
      }
    }

    setSelectedLocationIdInternal(id);
  };

  const selectedLocation = locations.find(l => l.id === selectedLocationId) || null;

  const getDateRangeValues = (): { from: Date; to: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        return { from: today, to: now };
      case '7d':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { from: sevenDaysAgo, to: now };
      case '30d':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { from: thirtyDaysAgo, to: now };
      case 'custom':
        return customDateRange || { from: today, to: now };
      default:
        return { from: today, to: now };
    }
  };

  return (
    <AppContext.Provider value={{
      group,
      locations,
      accessibleLocations,
      selectedLocationId,
      selectedLocation,
      setSelectedLocationId,
      dateRange,
      setDateRange,
      customDateRange,
      setCustomDateRange,
      getDateRangeValues,
      loading,
      canShowAllLocations,
      needsOnboarding,
      setOnboardingComplete,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
