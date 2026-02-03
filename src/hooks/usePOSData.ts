/**
 * usePOSData Hook
 * Loads POS data for a location: floor maps, tables, products, tickets
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FloorMap {
  id: string;
  name: string;
  location_id: string;
  floor_number: number;
}

export interface POSTable {
  id: string;
  floor_map_id: string;
  name: string;
  seats: number;
  pos_x: number;
  pos_y: number;
  shape: 'round' | 'square' | 'rectangle';
  status: 'available' | 'occupied' | 'reserved';
}

export interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
}

export interface POSTicket {
  id: string;
  pos_table_id?: string;
  status: string;
  total_amount: number;
  created_at: string;
  lines: POSTicketLine[];
}

export interface POSTicketLine {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

export interface CashSession {
  id: string;
  location_id: string;
  status: string;
  opening_cash: number;
  closing_cash?: number;
  opened_at: string;
  closed_at?: string;
}

export function usePOSData(locationId: string) {
  const [floorMaps, setFloorMaps] = useState<FloorMap[]>([]);
  const [tables, setTables] = useState<POSTable[]>([]);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [openTickets, setOpenTickets] = useState<POSTicket[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    try {
      // Load products from database
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, category')
        .limit(50);

      if (productsData) {
        setProducts(productsData.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category || 'General',
        })));
      }

      // Load cash session
      const { data: sessionData } = await supabase
        .from('pos_cash_sessions')
        .select('*')
        .eq('location_id', locationId)
        .eq('status', 'open')
        .single();

      if (sessionData) {
        setCashSession({
          id: sessionData.id,
          location_id: sessionData.location_id,
          status: sessionData.status,
          opening_cash: sessionData.opening_cash,
          closing_cash: sessionData.closing_cash || undefined,
          opened_at: sessionData.opened_at || new Date().toISOString(),
          closed_at: sessionData.closed_at || undefined,
        });
      }

      // Mock floor maps and tables for now
      setFloorMaps([
        { id: 'floor-1', name: 'Sala Principal', location_id: locationId, floor_number: 1 }
      ]);

      setTables([
        { id: 'table-1', floor_map_id: 'floor-1', name: 'Mesa 1', seats: 4, pos_x: 100, pos_y: 100, shape: 'square', status: 'available' },
        { id: 'table-2', floor_map_id: 'floor-1', name: 'Mesa 2', seats: 2, pos_x: 250, pos_y: 100, shape: 'round', status: 'occupied' },
        { id: 'table-3', floor_map_id: 'floor-1', name: 'Mesa 3', seats: 6, pos_x: 100, pos_y: 250, shape: 'rectangle', status: 'available' },
        { id: 'table-4', floor_map_id: 'floor-1', name: 'Mesa 4', seats: 4, pos_x: 250, pos_y: 250, shape: 'square', status: 'reserved' },
      ]);

      setOpenTickets([]);
    } catch (error) {
      console.error('Error loading POS data:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    floorMaps,
    tables,
    products,
    openTickets,
    cashSession,
    loading,
    refetch: loadData,
  };
}
