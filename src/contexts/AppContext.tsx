import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Location {
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
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  setSelectedLocationId: (id: string | null) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  customDateRange: { from: Date; to: Date } | null;
  setCustomDateRange: (range: { from: Date; to: Date } | null) => void;
  getDateRangeValues: () => { from: Date; to: Date };
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.group_id) {
      fetchGroupAndLocations(profile.group_id);
    } else {
      setLoading(false);
    }
  }, [profile?.group_id]);

  const fetchGroupAndLocations = async (groupId: string) => {
    setLoading(true);
    try {
      const [groupResult, locationsResult] = await Promise.all([
        supabase.from('groups').select('id, name').eq('id', groupId).single(),
        supabase.from('locations').select('id, name, city').eq('group_id', groupId)
      ]);

      if (groupResult.data) {
        setGroup(groupResult.data);
      }
      if (locationsResult.data) {
        setLocations(locationsResult.data);
        // Default to first location or "all"
        if (locationsResult.data.length > 0 && !selectedLocationId) {
          setSelectedLocationId(locationsResult.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching group/locations:', error);
    } finally {
      setLoading(false);
    }
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
      selectedLocationId,
      selectedLocation,
      setSelectedLocationId,
      dateRange,
      setDateRange,
      customDateRange,
      setCustomDateRange,
      getDateRangeValues,
      loading
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
