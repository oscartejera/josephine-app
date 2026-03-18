import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useDemoMode } from './DemoModeContext';

export interface Location {
  id: string;
  name: string;
  city: string | null;
}

export interface Group {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
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
  posConnected: boolean;
  dataSource: 'pos' | 'demo';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, isOwner, hasGlobalScope, accessibleLocationIds, refreshProfile } = useAuth();
  const { isDemoMode, dataSource: resolvedDataSource } = useDemoMode();

  // Derive posConnected and dataSource from the centralized data source resolution
  const posConnected = resolvedDataSource === 'pos';
  const dataSource: 'pos' | 'demo' = posConnected ? 'pos' : 'demo';

  const [group, setGroup] = useState<Group | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationIdInternal] = useState<string | null>(() => {
    try {
      return localStorage.getItem('josephine_selected_location') || null;
    } catch {
      return null;
    }
  });
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Detect if user needs onboarding (no group_id)
  // Note: NOT gated by isDemoMode — new users are always in demo mode (no POS)
  // so the old !isDemoMode check prevented onboarding from ever triggering
  const needsOnboarding = !loading && profile !== null && profile.group_id === null && !onboardingCompleted;

  const setOnboardingComplete = async () => {
    setOnboardingCompleted(true);
    // Refresh profile to get new group_id
    await refreshProfile();
  };

  // In DEMO_MODE, everyone can see all locations
  const canShowAllLocations = isDemoMode ? true : (isOwner || hasGlobalScope);

  // In DEMO_MODE, all locations are accessible
  const accessibleLocations = React.useMemo(() => {
    if (isDemoMode) {
      return locations;
    }
    if (isOwner || hasGlobalScope) {
      return locations;
    }
    return locations.filter(l => accessibleLocationIds.includes(l.id));
  }, [locations, isOwner, hasGlobalScope, accessibleLocationIds, isDemoMode]);

  useEffect(() => {
    if (profile?.group_id) {
      fetchGroupAndLocations(profile.group_id);
    } else {
      setLoading(false);
    }
  }, [profile?.group_id]);

  // Set default location when accessible locations change, and validate persisted selection
  useEffect(() => {
    if (accessibleLocations.length === 0) return;

    // Validate persisted selection against current accessible locations
    if (selectedLocationId && selectedLocationId !== 'all') {
      const isValid = accessibleLocations.some(l => l.id === selectedLocationId);
      if (!isValid) {
        // Persisted location no longer accessible — reset
        const fallback = canShowAllLocations ? 'all' : accessibleLocations[0].id;
        setSelectedLocationIdInternal(fallback);
        try { localStorage.setItem('josephine_selected_location', fallback); } catch {}
        return;
      }
    }

    // No selection yet — set default
    if (!selectedLocationId) {
      const defaultId = canShowAllLocations ? 'all' : accessibleLocations[0].id;
      setSelectedLocationIdInternal(defaultId);
      try { localStorage.setItem('josephine_selected_location', defaultId); } catch {}
    }
  }, [accessibleLocations, selectedLocationId, canShowAllLocations]);

  const fetchGroupAndLocations = async (groupId: string) => {
    setLoading(true);
    try {
      const [groupResult, locationsResult] = await Promise.all([
        supabase.from('groups').select('id, name, plan, stripe_customer_id, stripe_subscription_id, subscription_status').eq('id', groupId).single(),
        supabase.from('locations').select('id, name, city').eq('group_id', groupId).eq('active', true)
      ]);

      if (groupResult.data) {
        setGroup(groupResult.data);
      }
      if (locationsResult.data) {
        setLocations(locationsResult.data);
      }
    } catch (error) {
      console.error('Error fetching group/locations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Wrapped setter - in DEMO_MODE, all locations are valid
  const setSelectedLocationId = useCallback((id: string | null) => {
    // In demo mode, all selections are valid
    if (isDemoMode) {
      setSelectedLocationIdInternal(id);
      try { if (id) localStorage.setItem('josephine_selected_location', id); } catch {}
      return;
    }

    // Production mode - validate access
    if (id === 'all' && !canShowAllLocations) {
      console.warn('User tried to select all locations without permission');
      return;
    }

    if (id && id !== 'all' && !isOwner && !hasGlobalScope) {
      const hasAccess = accessibleLocationIds.includes(id);
      if (!hasAccess) {
        console.warn('User tried to access unauthorized location');
        return;
      }
    }

    setSelectedLocationIdInternal(id);
    try { if (id) localStorage.setItem('josephine_selected_location', id); } catch {}
  }, [isDemoMode, canShowAllLocations, isOwner, hasGlobalScope, accessibleLocationIds]);

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
      posConnected,
      dataSource,
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
