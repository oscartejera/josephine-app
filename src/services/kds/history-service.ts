/**
 * KDS History Service
 * Gestiona histórico de órdenes cerradas (últimos 30 min)
 */

import { supabase } from '@/integrations/supabase/client';
import type { KDSMonitor, KDSTicketLine } from './types';
import { subMinutes } from 'date-fns';

export class KDSHistoryService {
  async getClosedOrders(
    locationId: string,
    monitor: KDSMonitor
  ): Promise<KDSTicketLine[]> {
    const cutoffTime = subMinutes(new Date(), monitor.history_window_minutes).toISOString();

    // Get lines that were served recently
    let query = supabase
      .from('ticket_lines')
      .select(`
        *,
        ticket:tickets!inner(
          id,
          table_name,
          opened_at,
          covers
        )
      `)
      .eq('prep_status', 'served')
      .in('destination', monitor.destinations);

    // Use ready_at as reference for history window
    query = query.gte('ready_at', cutoffTime);

    const { data, error } = await query.order('ready_at', { ascending: false });

    if (error) {
      console.error('[History] Error:', error);
      return [];
    }

    return (data || []).map((line: any) => ({
      id: line.id,
      ticket_id: line.ticket_id,
      product_id: line.product_id,
      item_name: line.item_name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      notes: line.notes,
      prep_status: line.prep_status,
      prep_started_at: line.prep_started_at,
      ready_at: line.ready_at,
      sent_at: line.sent_at,
      destination: line.destination,
      target_prep_time: line.target_prep_time,
      is_rush: line.is_rush || false,
      course: line.course || 1,
      modifiers: [],
    }));
  }

  /**
   * Get KDS events for audit trail
   */
  async getEvents(
    locationId: string,
    limit: number = 100
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('kds_events')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[History] Error loading events:', error);
      return [];
    }

    return data || [];
  }
}
