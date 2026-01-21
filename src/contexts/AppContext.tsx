import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, isOwner, hasGlobalScope, accessibleLocationIds } = useAuth();
  const { toast } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationIdInternal] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine if user can see "All locations" option
  const canShowAllLocations = isOwner || hasGlobalScope;

  // Filter locations based on user's access
  const accessibleLocations = React.useMemo(() => {
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

  // Validate and set location when accessible locations change
  useEffect(() => {
    if (accessibleLocations.length > 0 && selectedLocationId) {
      // Check if current selection is still valid
      const isValidSelection = 
        selectedLocationId === 'all' 
          ? canShowAllLocations 
          : accessibleLocations.some(l => l.id === selectedLocationId);

      if (!isValidSelection) {
        // Redirect to first accessible location
        const firstLocation = accessibleLocations[0];
        setSelectedLocationIdInternal(firstLocation.id);
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "No tienes acceso a esa ubicación."
        });
      }
    } else if (accessibleLocations.length > 0 && !selectedLocationId) {
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
      const [groupResult, locationsResult] = await Promise.all([
        supabase.from('groups').select('id, name').eq('id', groupId).single(),
        supabase.from('locations').select('id, name, city').eq('group_id', groupId)
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

  // Wrapped setter that validates access
  const setSelectedLocationId = (id: string | null) => {
    if (id === 'all' && !canShowAllLocations) {
      // User tried to select "all" but doesn't have permission
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "No tienes acceso a todas las ubicaciones."
      });
      return;
    }

    if (id && id !== 'all' && !isOwner && !hasGlobalScope) {
      const hasAccess = accessibleLocationIds.includes(id);
      if (!hasAccess) {
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "No tienes acceso a esa ubicación."
        });
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
      canShowAllLocations
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
