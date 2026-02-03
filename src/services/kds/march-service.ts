/**
 * KDS March Service
 * Gestiona "marchar" órdenes por curso
 */

import { supabase } from '@/integrations/supabase/client';

export class KDSMarchService {
  async marchOrder(ticketId: string, course: number, userId?: string): Promise<void> {
    const { error } = await supabase.rpc('march_order', {
      p_ticket_id: ticketId,
      p_course: course,
      p_user_id: userId || null,
    });

    if (error) {
      console.error('[March] Error:', error);
      throw error;
    }

    console.log(`[March] Marched ticket ${ticketId}, course ${course}`);
  }

  async unmarchOrder(ticketId: string, course: number): Promise<void> {
    const { error } = await supabase.rpc('unmarch_order', {
      p_ticket_id: ticketId,
      p_course: course,
    });

    if (error) {
      console.error('[Unmarch] Error:', error);
      throw error;
    }

    console.log(`[Unmarch] Unmarched ticket ${ticketId}, course ${course}`);
  }

  async getMarchedOrders(ticketIds: string[]): Promise<Map<string, Set<number>>> {
    const { data, error } = await supabase
      .from('ticket_order_flags')
      .select('*')
      .in('ticket_id', ticketIds)
      .eq('is_marched', true);

    if (error) {
      console.error('[March] Error loading flags:', error);
      return new Map();
    }

    const result = new Map<string, Set<number>>();
    (data || []).forEach(flag => {
      if (!result.has(flag.ticket_id)) {
        result.set(flag.ticket_id, new Set());
      }
      result.get(flag.ticket_id)!.add(flag.course);
    });

    return result;
  }
}
