/**
 * useKDSMonitor Hook
 * Hook principal para KDS Ágora - integra todos los servicios
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KDSMonitorsService } from '@/services/kds/monitors-service';
import { KDSQueryService } from '@/services/kds/query-service';
import { KDSGroupingService } from '@/services/kds/grouping-service';
import { KDSStateMachineService } from '@/services/kds/state-machine-service';
import { KDSMarchService } from '@/services/kds/march-service';
import { KDSHistoryService } from '@/services/kds/history-service';
import { KDSStylesService } from '@/services/kds/styles-service';
import type { KDSMonitor, KDSOrder, ProductAggregation } from '@/services/kds/types';

// Services singleton
const monitorsService = new KDSMonitorsService();
const queryService = new KDSQueryService();
const groupingService = new KDSGroupingService();
const stateMachine = new KDSStateMachineService();
const marchService = new KDSMarchService();
const historyService = new KDSHistoryService();
const stylesService = new KDSStylesService();

export interface UseKDSMonitorResult {
  // Monitor configuration
  monitors: KDSMonitor[];
  activeMonitor: KDSMonitor | null;
  setActiveMonitorId: (id: string) => void;
  
  // Data
  orders: KDSOrder[];
  closedOrders: KDSOrder[];
  productAggregations: ProductAggregation[];
  
  // State
  loading: boolean;
  isConnected: boolean;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  
  // Actions
  startLine: (lineId: string) => Promise<void>;
  finishLine: (lineId: string) => Promise<void>;
  serveLine: (lineId: string) => Promise<void>;
  startAllInCourse: (ticketId: string, course: number) => Promise<void>;
  finishAllInCourse: (ticketId: string, course: number) => Promise<void>;
  serveAllInCourse: (ticketId: string, course: number) => Promise<void>;
  marchCourse: (ticketId: string, course: number) => Promise<void>;
  unmarchCourse: (ticketId: string, course: number) => Promise<void>;
  
  // Refresh
  refetch: () => Promise<void>;
}

export function useKDSMonitor(locationId: string): UseKDSMonitorResult {
  const [monitors, setMonitors] = useState<KDSMonitor[]>([]);
  const [activeMonitorId, setActiveMonitorId] = useState<string | null>(null);
  const [activeMonitor, setActiveMonitor] = useState<KDSMonitor | null>(null);
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<KDSOrder[]>([]);
  const [productAggregations, setProductAggregations] = useState<ProductAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderCountRef = useRef(0);

  // Load monitors on mount
  useEffect(() => {
    loadMonitors();
  }, [locationId]);

  const loadMonitors = useCallback(async () => {
    try {
      const data = await monitorsService.getActiveMonitors(locationId);
      setMonitors(data);
      
      // Auto-select first monitor if none selected
      if (data.length > 0 && !activeMonitorId) {
        setActiveMonitorId(data[0].id);
      }
    } catch (error) {
      console.error('[KDS Monitor] Error loading monitors:', error);
    }
  }, [locationId, activeMonitorId]);

  // Update active monitor when ID changes
  useEffect(() => {
    if (activeMonitorId) {
      const monitor = monitors.find(m => m.id === activeMonitorId);
      setActiveMonitor(monitor || null);
    }
  }, [activeMonitorId, monitors]);

  // Fetch orders when monitor changes
  useEffect(() => {
    if (activeMonitor) {
      fetchOrders();
    }
  }, [activeMonitor]);

  const fetchOrders = useCallback(async () => {
    if (!activeMonitor) return;

    try {
      setLoading(true);

      // Query data
      const queryResult = await queryService.queryForMonitor(activeMonitor);
      
      // Group by ticket and course
      const groupedOrders = groupingService.groupByTicketAndCourse(
        queryResult,
        activeMonitor
      );
      
      // Product aggregations
      const aggregations = groupingService.aggregateProducts(queryResult.lines);
      
      setOrders(groupedOrders);
      setProductAggregations(aggregations);

      // Play notification if new orders
      if (groupedOrders.length > previousOrderCountRef.current && previousOrderCountRef.current > 0) {
        playNotificationSound();
      }
      previousOrderCountRef.current = groupedOrders.length;

    } catch (error) {
      console.error('[KDS Monitor] Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [activeMonitor]);

  const fetchClosedOrders = useCallback(async () => {
    if (!activeMonitor) return;

    try {
      const lines = await historyService.getClosedOrders(locationId, activeMonitor);
      
      // Group closed orders
      const queryResult = {
        lines,
        tickets: new Map(),
        orderFlags: new Map(),
      };
      
      const grouped = groupingService.groupByTicketAndCourse(queryResult, activeMonitor);
      setClosedOrders(grouped);
    } catch (error) {
      console.error('[KDS Monitor] Error fetching closed orders:', error);
    }
  }, [activeMonitor, locationId]);

  // Fetch closed orders when showing history
  useEffect(() => {
    if (showHistory) {
      fetchClosedOrders();
    }
  }, [showHistory, fetchClosedOrders]);

  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/notification.mp3');
    }
    audioRef.current.play().catch(console.error);
  }, []);

  // Actions
  const startLine = useCallback(async (lineId: string) => {
    if (!activeMonitor) return;
    await stateMachine.startLine(lineId, activeMonitor.id);
    await fetchOrders();
  }, [activeMonitor, fetchOrders]);

  const finishLine = useCallback(async (lineId: string) => {
    if (!activeMonitor) return;
    await stateMachine.finishLine(lineId, activeMonitor, activeMonitor.id);
    await fetchOrders();
  }, [activeMonitor, fetchOrders]);

  const serveLine = useCallback(async (lineId: string) => {
    if (!activeMonitor) return;
    await stateMachine.serveLine(lineId, activeMonitor.id);
    await fetchOrders();
  }, [activeMonitor, fetchOrders]);

  const startAllInCourse = useCallback(async (ticketId: string, course: number) => {
    if (!activeMonitor) return;
    
    const order = orders.find(o => o.ticket_id === ticketId);
    const courseOrder = order?.orders.find(co => co.course === course);
    
    if (courseOrder) {
      const lineIds = courseOrder.items
        .filter(item => item.prep_status === 'pending')
        .map(item => item.id);
      
      if (lineIds.length > 0) {
        await stateMachine.startAllLines(lineIds);
        await fetchOrders();
      }
    }
  }, [activeMonitor, orders, fetchOrders]);

  const finishAllInCourse = useCallback(async (ticketId: string, course: number) => {
    if (!activeMonitor) return;
    
    const order = orders.find(o => o.ticket_id === ticketId);
    const courseOrder = order?.orders.find(co => co.course === course);
    
    if (courseOrder) {
      const lineIds = courseOrder.items
        .filter(item => item.prep_status === 'preparing')
        .map(item => item.id);
      
      if (lineIds.length > 0) {
        await stateMachine.finishAllLines(lineIds, activeMonitor);
        await fetchOrders();
      }
    }
  }, [activeMonitor, orders, fetchOrders]);

  const serveAllInCourse = useCallback(async (ticketId: string, course: number) => {
    if (!activeMonitor) return;
    
    const order = orders.find(o => o.ticket_id === ticketId);
    const courseOrder = order?.orders.find(co => co.course === course);
    
    if (courseOrder) {
      const lineIds = courseOrder.items
        .filter(item => item.prep_status === 'ready')
        .map(item => item.id);
      
      if (lineIds.length > 0) {
        await stateMachine.serveAllLines(lineIds);
        await fetchOrders();
      }
    }
  }, [activeMonitor, orders, fetchOrders]);

  const marchCourse = useCallback(async (ticketId: string, course: number) => {
    await marchService.marchOrder(ticketId, course);
    await fetchOrders();
  }, [fetchOrders]);

  const unmarchCourse = useCallback(async (ticketId: string, course: number) => {
    await marchService.unmarchOrder(ticketId, course);
    await fetchOrders();
  }, [fetchOrders]);

  // Realtime subscriptions
  useEffect(() => {
    if (!locationId || !activeMonitor) return;

    const channel = supabase
      .channel(`kds-monitor-${activeMonitor.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_lines'
        },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_order_flags'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, activeMonitor, fetchOrders]);

  return {
    monitors,
    activeMonitor,
    setActiveMonitorId,
    orders,
    closedOrders,
    productAggregations,
    loading,
    isConnected,
    showHistory,
    setShowHistory,
    startLine,
    finishLine,
    serveLine,
    startAllInCourse,
    finishAllInCourse,
    serveAllInCourse,
    marchCourse,
    unmarchCourse,
    refetch: fetchOrders,
  };
}
