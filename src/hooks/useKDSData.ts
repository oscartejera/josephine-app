/**
 * useKDSData Hook
 * Kitchen Display System data management
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KDSOrder {
  id: string;
  ticketId: string;
  tableName?: string;
  orderNumber: number;
  createdAt: string;
  items: KDSOrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'completed';
}

export interface KDSOrderItem {
  id: string;
  productName: string;
  quantity: number;
  modifiers?: string[];
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

export function useKDSData(locationId: string) {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    try {
      // Mock KDS orders for demo
      // In production, would load from ticket_lines with KDS status
      setOrders([
        {
          id: 'kds-1',
          ticketId: 'ticket-1',
          tableName: 'Mesa 2',
          orderNumber: 101,
          createdAt: new Date().toISOString(),
          status: 'preparing',
          items: [
            { id: 'item-1', productName: 'Paella Valenciana', quantity: 2, status: 'preparing' },
            { id: 'item-2', productName: 'Gazpacho', quantity: 2, status: 'ready' },
          ],
        },
        {
          id: 'kds-2',
          ticketId: 'ticket-2',
          tableName: 'Mesa 5',
          orderNumber: 102,
          createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
          status: 'pending',
          items: [
            { id: 'item-3', productName: 'Chuletón de Buey', quantity: 1, status: 'pending' },
            { id: 'item-4', productName: 'Ensalada César', quantity: 1, status: 'pending' },
          ],
        },
      ]);
    } catch (error) {
      console.error('Error loading KDS orders:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateItemStatus = useCallback(async (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => {
    setOrders(prev => prev.map(order => ({
      ...order,
      items: order.items.map(item =>
        item.id === lineId ? { ...item, status: newStatus } : item
      ),
    })));
  }, []);

  const completeOrder = useCallback(async (ticketId: string) => {
    setOrders(prev => prev.filter(o => o.ticketId !== ticketId));
  }, []);

  return {
    orders,
    loading,
    updateItemStatus,
    completeOrder,
    refetch: loadOrders,
  };
}
