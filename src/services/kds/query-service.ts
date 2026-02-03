/**
 * KDS Query Service
 * Query principal optimizado para cargar datos del monitor
 */

import { supabase } from '@/integrations/supabase/client';
import type { KDSMonitor, KDSTicketLine } from './types';

export interface KDSQueryResult {
  lines: KDSTicketLine[];
  tickets: Map<string, {
    table_name: string | null;
    server_name: string | null;
    opened_at: string;
    covers: number;
  }>;
  orderFlags: Map<string, boolean>; // "ticket_id:course" → is_marched
}

export class KDSQueryService {
  async queryForMonitor(monitor: KDSMonitor): Promise<KDSQueryResult> {
    // Build query for ticket_lines
    let query = supabase
      .from('ticket_lines')
      .select(`
        *,
        ticket:tickets!inner(
          id,
          table_name,
          server_id,
          opened_at,
          covers
        )
      `);

    // Filter by destinations
    if (monitor.destinations.length > 0) {
      query = query.in('destination', monitor.destinations);
    }

    // Filter by prep_status (primary + secondary)
    const allStatuses = [...monitor.primary_statuses, ...monitor.secondary_statuses];
    query = query.in('prep_status', allStatuses);

    // Filter by courses if specified
    if (monitor.courses && monitor.courses.length > 0) {
      query = query.in('course', monitor.courses);
    }

    // Order by sent_at
    query = query.order('sent_at', { ascending: true });

    const { data: linesData, error } = await query;

    if (error) {
      console.error('[KDS Query] Error:', error);
      return { lines: [], tickets: new Map(), orderFlags: new Map() };
    }

    // Extract ticket info
    const tickets = new Map();
    const ticketIds = new Set<string>();

    (linesData || []).forEach((line: any) => {
      const ticket = line.ticket;
      if (ticket && !tickets.has(ticket.id)) {
        tickets.set(ticket.id, {
          table_name: ticket.table_name,
          server_name: ticket.server_id, // TODO: Join with users
          opened_at: ticket.opened_at,
          covers: ticket.covers,
        });
        ticketIds.add(ticket.id);
      }
    });

    // Load modifiers
    const lineIds = (linesData || []).map((l: any) => l.id);
    const { data: modifiersData } = await supabase
      .from('ticket_line_modifiers')
      .select('*')
      .in('ticket_line_id', lineIds);

    const modifiersMap = new Map<string, any[]>();
    (modifiersData || []).forEach(mod => {
      if (!modifiersMap.has(mod.ticket_line_id)) {
        modifiersMap.set(mod.ticket_line_id, []);
      }
      modifiersMap.get(mod.ticket_line_id)!.push({
        id: mod.id,
        modifier_name: mod.modifier_name,
        option_name: mod.option_name,
        price_delta: mod.price_delta,
        type: this.inferModifierType(mod.modifier_name, mod.option_name),
      });
    });

    // Load order flags (marchar status)
    const { data: flagsData } = await supabase
      .from('ticket_order_flags')
      .select('*')
      .in('ticket_id', Array.from(ticketIds));

    const orderFlags = new Map<string, boolean>();
    (flagsData || []).forEach(flag => {
      const key = `${flag.ticket_id}:${flag.course}`;
      orderFlags.set(key, flag.is_marched);
    });

    // Map lines to KDSTicketLine
    const lines: KDSTicketLine[] = (linesData || []).map((line: any) => ({
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
      modifiers: modifiersMap.get(line.id) || [],
    }));

    return { lines, tickets, orderFlags };
  }

  private inferModifierType(modifierName: string, optionName: string): 'add' | 'remove' | 'substitute' {
    const combined = (modifierName + optionName).toLowerCase();
    if (combined.includes('sin') || combined.includes('without') || combined.includes('quitar')) {
      return 'remove';
    }
    if (combined.includes('cambiar') || combined.includes('sustituir') || combined.includes('replace')) {
      return 'substitute';
    }
    return 'add';
  }
}
