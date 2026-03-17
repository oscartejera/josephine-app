/**
 * usePOSData Hook
 * Loads POS data for a location: floor maps, tables, products, tickets
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [floorMaps, setFloorMaps] = useState<FloorMap[]>{t('hooks.usePOSData.constTablesSettablesUsestate')}<POSTable[]>{t('hooks.usePOSData.constProductsSetproductsUsestate')}<POSProduct[]>{t('hooks.usePOSData.constOpenticketsSetopenticketsUsestate')}<POSTicket[]>{t('hooks.usePOSData.constCashsessionSetcashsessionUsestate')}<CashSession | null>(null);
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

      // Fetch floor maps from DB
      const { data: floorData } = await supabase
        .from('pos_floor_maps')
        .select('id, name, location_id, floor_number')
        .eq('location_id', locationId)
        .order('floor_number', { ascending: true });
      setFloorMaps(floorData || []);

      // Fetch tables from DB
      if (floorData && floorData.length > 0) {
        const floorIds = floorData.map(f => f.id);
        const { data: tableData } = await supabase
          .from('pos_tables')
          .select('id, floor_map_id, name, seats, pos_x, pos_y, shape, status')
          .in('floor_map_id', floorIds);
        setTables((tableData || []).map(t => ({
          ...t,
          shape: (t.shape as 'round' | 'square' | 'rectangle') || 'square',
          status: (t.status as 'available' | 'occupied' | 'reserved') || 'available',
        })));
      } else {
        setTables([]);
      }

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
