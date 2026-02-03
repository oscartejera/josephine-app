/**
 * useKDSDataV2 - KDS Hook usando servicios Ágora
 * Hook completo que usa los nuevos servicios
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KDSMonitorsService } from '@/services/kds/monitors-service';
import { KDSQueryService } from '@/services/kds/query-service';
import { KDSGroupingService } from '@/services/kds/grouping-service';
import { KDSStateMachineService } from '@/services/kds/state-machine-service';
import { KDSMarchService } from '@/services/kds/march-service';
import { KDSHistoryService } from '@/services/kds/history-service';
import { KDSStylesService } from '@/services/kds/styles-service';
import type { KDSMonitor, KDSOrder, ProductAggregation } from '@/services/kds/types';

const monitorsService = new KDSMonitorsService();
const queryService = new KDSQueryService();
const groupingService = new KDSGroupingService();
const stateMachine = new KDSStateMachineService();
const marchService = new KDSMarchService();
const historyService = new KDSHistoryService();
const stylesService = new KDSStylesService();

export function useKDSDataV2(locationId: string, selectedMonitorId?: string) {
  const [monitors, setMonitors] = useState<KDSMonitor[]>([]);
  const [currentMonitor, setCurrentMonitor] = useState<KDSMonitor | null>(null);
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<KDSOrder[]>([]);
  const [productAggregation, setProductAggregation] = useState<ProductAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Load monitors
  const loadMonitors = useCallback(async () => {
    if (!locationId) return;

    try {
      const data = await monitorsService.getActiveMonitors(locationId);
      setMonitors(data);

      // Auto-select monitor
      if (data.length > 0) {
        const monitor = selectedMonitorId
          ? data.find(m => m.id === selectedMonitorId) || data[0]
          : data[0];
        setCurrentMonitor(monitor);
      }
    } catch (error) {
      console.error('[KDS] Error loading monitors:', error);
    }
  }, [locationId, selectedMonitorId]);

  // Load orders for current monitor
  const loadOrders = useCallback(async () => {
    if (!currentMonitor) return;

    try {
      const queryResult = await queryService.queryForMonitor(currentMonitor);
      const groupedOrders = groupingService.groupByTicketAndCourse(queryResult, currentMonitor);
      setOrders(groupedOrders);

      // Product aggregation for sidebar
      const aggregation = groupingService.aggregateProducts(queryResult.lines);
      setProductAggregation(aggregation);

      console.log(`[KDS] Loaded ${groupedOrders.length} orders, ${queryResult.lines.length} items`);
    } catch (error) {
      console.error('[KDS] Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonitor]);

  // Load closed orders (history)
  const loadClosedOrders = useCallback(async () => {
    if (!currentMonitor) return;

    try {
      const lines = await historyService.getClosedOrders(locationId, currentMonitor);
      // Group by ticket (simplified)
      const ticketMap = new Map<string, any>();
      lines.forEach(line => {
        if (!ticketMap.has(line.ticket_id)) {
          ticketMap.set(line.ticket_id, {
            ticket_id: line.ticket_id,
            table_name: null,
            items: [],
          });
        }
        ticketMap.get(line.ticket_id)!.items.push(line);
      });

      setClosedOrders(Array.from(ticketMap.values()));
    } catch (error) {
      console.error('[KDS] Error loading history:', error);
    }
  }, [currentMonitor, locationId]);

  // Initial load
  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  useEffect(() => {
    if (currentMonitor) {
      loadOrders();
      if (showHistory) {
        loadClosedOrders();
      }
    }
  }, [currentMonitor, loadOrders, loadClosedOrders, showHistory]);

  // Realtime subscription
  useEffect(() => {
    if (!locationId || !currentMonitor) return;

    const channel = supabase
      .channel(`kds-v2-${locationId}-${currentMonitor.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_lines',
        },
        () => {
          console.log('[KDS] Realtime update received');
          loadOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_order_flags',
        },
        () => {
          console.log('[KDS] March flag update');
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, currentMonitor, loadOrders]);

  // Actions
  const startItem = useCallback(async (lineId: string) => {
    await stateMachine.startLine(lineId);
  }, []);

  const finishItem = useCallback(async (lineId: string) => {
    if (!currentMonitor) return;
    await stateMachine.finishLine(lineId, currentMonitor);
  }, [currentMonitor]);

  const serveItem = useCallback(async (lineId: string) => {
    await stateMachine.serveLine(lineId);
  }, []);

  const marchOrder = useCallback(async (ticketId: string, course: number) => {
    await marchService.marchOrder(ticketId, course);
  }, []);

  const unmarchOrder = useCallback(async (ticketId: string, course: number) => {
    await marchService.unmarchOrder(ticketId, course);
  }, []);

  const startAllInOrder = useCallback(async (order: KDSOrder, courseOrder: any) => {
    const lineIds = courseOrder.items.map((item: any) => item.id);
    await stateMachine.startAllLines(lineIds);
  }, []);

  const finishAllInOrder = useCallback(async (order: KDSOrder, courseOrder: any) => {
    if (!currentMonitor) return;
    const lineIds = courseOrder.items.map((item: any) => item.id);
    await stateMachine.finishAllLines(lineIds, currentMonitor);
  }, [currentMonitor]);

  return {
    // State
    monitors,
    currentMonitor,
    orders,
    closedOrders,
    productAggregation,
    loading,
    showHistory,
    setShowHistory,

    // Monitor selection
    selectMonitor: (monitorId: string) => {
      const monitor = monitors.find(m => m.id === monitorId);
      if (monitor) setCurrentMonitor(monitor);
    },

    // Actions
    startItem,
    finishItem,
    serveItem,
    marchOrder,
    unmarchOrder,
    startAllInOrder,
    finishAllInOrder,

    // Refresh
    refetch: loadOrders,
  };
}
