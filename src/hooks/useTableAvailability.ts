import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { POSTable } from '@/hooks/usePOSData';

interface TableAvailability {
  table: POSTable;
  isAvailable: boolean;
  hasConflict: boolean;
  conflictTime?: string;
  capacityMatch: 'exact' | 'larger' | 'smaller';
}

interface UseTableAvailabilityResult {
  availableTables: TableAvailability[];
  loading: boolean;
  recommendedTable: POSTable | null;
}

export function useTableAvailability(
  locationId: string,
  tables: POSTable[],
  date: string,
  time: string,
  partySize: number
): UseTableAvailabilityResult {
  const [reservedTableIds, setReservedTableIds] = useState<Set<string>>(new Set());
  const [conflictMap, setConflictMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch existing reservations for the date/time window
  useEffect(() => {
    async function fetchReservations() {
      if (!locationId || !date || !time) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Calculate time window (±2 hours from selected time)
        const [hours, minutes] = time.split(':').map(Number);
        const startHour = Math.max(0, hours - 2);
        const endHour = Math.min(23, hours + 2);
        const startTime = `${startHour.toString().padStart(2, '0')}:00`;
        const endTime = `${endHour.toString().padStart(2, '0')}:59`;

        const { data, error } = await supabase
          .from('reservations')
          .select('pos_table_id, reservation_time')
          .eq('location_id', locationId)
          .eq('reservation_date', date)
          .in('status', ['pending', 'confirmed', 'seated'])
          .gte('reservation_time', startTime)
          .lte('reservation_time', endTime);

        if (error) throw error;

        const reserved = new Set<string>();
        const conflicts = new Map<string, string>();
        
        (data || []).forEach(r => {
          if (r.pos_table_id) {
            reserved.add(r.pos_table_id);
            conflicts.set(r.pos_table_id, r.reservation_time);
          }
        });

        setReservedTableIds(reserved);
        setConflictMap(conflicts);
      } catch (error) {
        console.error('Error fetching reservations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReservations();
  }, [locationId, date, time]);

  // Process tables with availability info
  const availableTables = useMemo(() => {
    return tables
      .filter(table => table.seats >= partySize) // Only tables that fit the party
      .map(table => {
        const hasConflict = reservedTableIds.has(table.id);
        const isCurrentlyOccupied = table.status === 'occupied';
        
        let capacityMatch: 'exact' | 'larger' | 'smaller' = 'larger';
        if (table.seats === partySize) capacityMatch = 'exact';
        else if (table.seats < partySize) capacityMatch = 'smaller';

        return {
          table,
          isAvailable: !hasConflict && !isCurrentlyOccupied,
          hasConflict,
          conflictTime: conflictMap.get(table.id),
          capacityMatch,
        };
      })
      .sort((a, b) => {
        // Priority: available first, then by capacity match
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        // Exact capacity match first
        if (a.capacityMatch === 'exact' && b.capacityMatch !== 'exact') return -1;
        if (b.capacityMatch === 'exact' && a.capacityMatch !== 'exact') return 1;
        // Then by smallest capacity difference
        return a.table.seats - b.table.seats;
      });
  }, [tables, partySize, reservedTableIds, conflictMap]);

  // Auto-recommend the best table
  const recommendedTable = useMemo(() => {
    const best = availableTables.find(t => t.isAvailable);
    return best?.table || null;
  }, [availableTables]);

  return {
    availableTables,
    loading,
    recommendedTable,
  };
}
