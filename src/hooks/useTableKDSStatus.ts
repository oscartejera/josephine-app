import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type KDSTableStatus = 'idle' | 'pending' | 'preparing' | 'ready' | 'served';

export interface TableKDSInfo {
  status: KDSTableStatus;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  servedCount: number;
  totalItems: number;
  oldestSentAt: string | null;
  elapsedMinutes: number;
  hasRushItems: boolean;
}

interface TicketLineStatus {
  id: string;
  ticket_id: string;
  prep_status: 'pending' | 'preparing' | 'ready' | 'served';
  sent_at: string | null;
  is_rush: boolean;
}

interface TicketTableMapping {
  ticketId: string;
  tableId: string | null;
}

const DEFAULT_TABLE_INFO: TableKDSInfo = {
  status: 'idle',
  pendingCount: 0,
  preparingCount: 0,
  readyCount: 0,
  servedCount: 0,
  totalItems: 0,
  oldestSentAt: null,
  elapsedMinutes: 0,
  hasRushItems: false,
};

export function useTableKDSStatus(
  locationId: string,
  ticketTableMappings: TicketTableMapping[]
) {
  const [tableStatusMap, setTableStatusMap] = useState<Map<string, TableKDSInfo>>(new Map());
  const [previousReadyTables, setPreviousReadyTables] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const ticketIds = useMemo(() => 
    ticketTableMappings.map(m => m.ticketId).filter(Boolean),
    [ticketTableMappings]
  );

  const ticketToTableMap = useMemo(() => {
    const map = new Map<string, string>();
    ticketTableMappings.forEach(m => {
      if (m.ticketId && m.tableId) {
        map.set(m.ticketId, m.tableId);
      }
    });
    return map;
  }, [ticketTableMappings]);

  const calculateStatus = useCallback((
    pending: number,
    preparing: number,
    ready: number,
    total: number
  ): KDSTableStatus => {
    if (total === 0) return 'idle';
    if (ready === total) return 'ready';
    if (preparing > 0) return 'preparing';
    if (pending > 0) return 'pending';
    return 'served';
  }, []);

  const getElapsedMinutes = useCallback((dateString: string | null): number => {
    if (!dateString) return 0;
    const sent = new Date(dateString);
    const now = new Date();
    return Math.floor((now.getTime() - sent.getTime()) / 60000);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (ticketIds.length === 0) {
      setTableStatusMap(new Map());
      return;
    }

    try {
      const { data: lines, error } = await supabase
        .from('ticket_lines')
        .select('id, ticket_id, prep_status, sent_at, is_rush')
        .in('ticket_id', ticketIds)
        .not('sent_at', 'is', null);

      if (error) throw error;

      // Group by table
      const tableData = new Map<string, TicketLineStatus[]>();
      
      (lines || []).forEach((line) => {
        const tableId = ticketToTableMap.get(line.ticket_id);
        if (tableId) {
          const existing = tableData.get(tableId) || [];
          existing.push(line as TicketLineStatus);
          tableData.set(tableId, existing);
        }
      });

      // Calculate status for each table
      const newMap = new Map<string, TableKDSInfo>();
      const newReadyTables = new Set<string>();

      tableData.forEach((tableLines, tableId) => {
        const pendingCount = tableLines.filter(l => l.prep_status === 'pending').length;
        const preparingCount = tableLines.filter(l => l.prep_status === 'preparing').length;
        const readyCount = tableLines.filter(l => l.prep_status === 'ready').length;
        const servedCount = tableLines.filter(l => l.prep_status === 'served').length;
        const totalItems = tableLines.length;
        const hasRushItems = tableLines.some(l => l.is_rush);

        // Find oldest sent_at
        const sentDates = tableLines
          .map(l => l.sent_at)
          .filter(Boolean)
          .sort();
        const oldestSentAt = sentDates[0] || null;

        const status = calculateStatus(pendingCount, preparingCount, readyCount, totalItems);

        if (status === 'ready') {
          newReadyTables.add(tableId);
        }

        newMap.set(tableId, {
          status,
          pendingCount,
          preparingCount,
          readyCount,
          servedCount,
          totalItems,
          oldestSentAt,
          elapsedMinutes: getElapsedMinutes(oldestSentAt),
          hasRushItems,
        });
      });

      // Check for newly ready tables and notify
      newReadyTables.forEach(tableId => {
        if (!previousReadyTables.has(tableId)) {
          // Play sound
          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}

          // Show toast
          toast({
            title: "🍽️ ¡Pedido listo!",
            description: `Mesa lista para servir`,
            duration: 5000,
          });
        }
      });

      setPreviousReadyTables(newReadyTables);
      setTableStatusMap(newMap);
    } catch (error) {
      console.error('Error fetching table KDS status:', error);
    }
  }, [ticketIds, ticketToTableMap, calculateStatus, getElapsedMinutes, previousReadyTables, toast]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Update elapsed time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTableStatusMap(prev => {
        const newMap = new Map(prev);
        newMap.forEach((info, tableId) => {
          if (info.oldestSentAt) {
            newMap.set(tableId, {
              ...info,
              elapsedMinutes: getElapsedMinutes(info.oldestSentAt),
            });
          }
        });
        return newMap;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [getElapsedMinutes]);

  // Realtime subscription
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`table-kds-status-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_lines',
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchStatus]);

  const getTableStatus = useCallback((tableId: string): TableKDSInfo => {
    return tableStatusMap.get(tableId) || DEFAULT_TABLE_INFO;
  }, [tableStatusMap]);

  const markTableAsServed = useCallback(async (tableId: string) => {
    const ticketId = Array.from(ticketToTableMap.entries())
      .find(([, tId]) => tId === tableId)?.[0];

    if (!ticketId) return;

    try {
      const { error } = await supabase
        .from('ticket_lines')
        .update({ prep_status: 'served' })
        .eq('ticket_id', ticketId)
        .eq('prep_status', 'ready');

      if (error) throw error;

      toast({
        title: "✅ Mesa servida",
        description: "Items marcados como servidos",
      });

      fetchStatus();
    } catch (error) {
      console.error('Error marking table as served:', error);
    }
  }, [ticketToTableMap, fetchStatus, toast]);

  return {
    getTableStatus,
    markTableAsServed,
    refetch: fetchStatus,
  };
}
