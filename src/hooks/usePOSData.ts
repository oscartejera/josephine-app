import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FloorMap {
  id: string;
  location_id: string;
  name: string;
  config_json: Record<string, unknown> & {
    width?: number;
    height?: number;
    background?: string | null;
  };
  is_active: boolean;
}

export interface POSTable {
  id: string;
  floor_map_id: string;
  table_number: string;
  seats: number;
  position_x: number;
  position_y: number;
  shape: 'square' | 'round' | 'rectangle';
  width: number;
  height: number;
  status: 'available' | 'occupied' | 'reserved' | 'blocked';
  current_ticket_id: string | null;
}

export interface POSProduct {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  kds_destination: 'kitchen' | 'bar' | 'prep';
}

export interface POSTicket {
  id: string;
  location_id: string;
  pos_table_id: string | null;
  server_id: string | null;
  status: string;
  gross_total: number;
  discount_total: number;
  net_total: number;
  service_type: string;
  notes: string | null;
  covers: number;
  opened_at: string;
  table_name: string | null;
}

export interface CashSession {
  id: string;
  location_id: string;
  opened_by: string;
  opening_cash: number;
  status: 'open' | 'closed';
  opened_at: string;
}

export function usePOSData(locationId: string) {
  const [floorMaps, setFloorMaps] = useState<FloorMap[]>([]);
  const [tables, setTables] = useState<POSTable[]>([]);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [openTickets, setOpenTickets] = useState<POSTicket[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    
    setLoading(true);
    try {
      // Fetch floor maps
      const { data: mapsData, error: mapsError } = await supabase
        .from('pos_floor_maps')
        .select('*')
        .eq('location_id', locationId)
        .eq('is_active', true);
      
      // Fallback to InMemory seed if no data
      if (mapsError || !mapsData || mapsData.length === 0) {
        console.log('[POS] Using InMemory floor maps seed');
        const { getFloorMaps, getTables } = await import('@/data/pos-floor-seed');
        const seedMaps = getFloorMaps(locationId);
        const seedTables = getTables(locationId);
        setFloorMaps(seedMaps as any);
        setTables(seedTables as any);
        setLoading(false);
        return;
      }
      
      setFloorMaps((mapsData || []) as unknown as FloorMap[]);

      // Fetch tables for this location's floor maps
      if (mapsData && mapsData.length > 0) {
        const mapIds = mapsData.map(m => m.id);
        const { data: tablesData } = await supabase
          .from('pos_tables')
          .select('*')
          .in('floor_map_id', mapIds);
        
        setTables((tablesData as POSTable[]) || []);
      } else {
        setTables([]);
      }

      // Fetch products for this location (including kds_destination, price, image_url)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, category, is_active, kds_destination, price, image_url')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .order('category')
        .order('name');

      setProducts((productsData || []).map(p => ({
        ...p,
        price: Number(p.price) || 10.00,
        image_url: p.image_url || null,
        kds_destination: (p.kds_destination || 'kitchen') as 'kitchen' | 'bar' | 'prep'
      })) as POSProduct[]);

      // Fetch open tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .eq('location_id', locationId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      setOpenTickets((ticketsData as POSTicket[]) || []);

      // Fetch current cash session
      const { data: sessionData } = await supabase
        .from('pos_cash_sessions')
        .select('*')
        .eq('location_id', locationId)
        .eq('status', 'open')
        .single();

      setCashSession(sessionData as CashSession | null);
    } catch (error) {
      console.error('Error fetching POS data:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`pos-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_tables' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `location_id=eq.${locationId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_cash_sessions', filter: `location_id=eq.${locationId}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchData]);

  return {
    floorMaps,
    tables,
    products,
    openTickets,
    cashSession,
    loading,
    refetch: fetchData
  };
}
