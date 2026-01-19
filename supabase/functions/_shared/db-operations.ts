// Database operations for POS sync
// Handles idempotent upserts to prevent duplicates

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NormalizedTicket, NormalizedTicketLine, NormalizedPayment } from './normalize.ts';

export async function upsertTickets(
  supabaseUrl: string,
  serviceRoleKey: string,
  tickets: NormalizedTicket[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  
  for (const ticket of tickets) {
    // Check if ticket already exists by external_id + location_id
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('external_id', ticket.external_id)
      .eq('location_id', ticket.location_id)
      .maybeSingle();
    
    if (existing) {
      // Update existing ticket
      const { error } = await supabase
        .from('tickets')
        .update({
          opened_at: ticket.opened_at,
          closed_at: ticket.closed_at,
          table_name: ticket.table_name,
          covers: ticket.covers,
          channel: ticket.channel,
          gross_total: ticket.gross_total,
          net_total: ticket.net_total,
          tax_total: ticket.tax_total,
          discount_total: ticket.discount_total,
          status: ticket.status,
        })
        .eq('id', existing.id);
      
      if (error) {
        errors.push(`Update ticket ${ticket.external_id}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      // Insert new ticket
      const { error } = await supabase
        .from('tickets')
        .insert(ticket);
      
      if (error) {
        errors.push(`Insert ticket ${ticket.external_id}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }
  
  return { inserted, updated, errors };
}

export async function upsertTicketLines(
  supabaseUrl: string,
  serviceRoleKey: string,
  lines: NormalizedTicketLine[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  
  for (const line of lines) {
    // Check if line exists by external_line_id + ticket_id
    const { data: existing } = await supabase
      .from('ticket_lines')
      .select('id')
      .eq('external_line_id', line.external_line_id)
      .eq('ticket_id', line.ticket_id)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase
        .from('ticket_lines')
        .update({
          item_external_id: line.item_external_id,
          item_name: line.item_name,
          category_name: line.category_name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          gross_line_total: line.gross_line_total,
          discount_line_total: line.discount_line_total,
          tax_rate: line.tax_rate,
          voided: line.voided,
          comped: line.comped,
        })
        .eq('id', existing.id);
      
      if (error) {
        errors.push(`Update line ${line.external_line_id}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase
        .from('ticket_lines')
        .insert(line);
      
      if (error) {
        errors.push(`Insert line ${line.external_line_id}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }
  
  return { inserted, updated, errors };
}

export async function upsertPayments(
  supabaseUrl: string,
  serviceRoleKey: string,
  payments: NormalizedPayment[]
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  let inserted = 0;
  const errors: string[] = [];
  
  for (const payment of payments) {
    // Payments are usually inserted once, but we check for duplicates
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('ticket_id', payment.ticket_id)
      .eq('amount', payment.amount)
      .eq('method', payment.method)
      .maybeSingle();
    
    if (!existing) {
      const { error } = await supabase
        .from('payments')
        .insert(payment);
      
      if (error) {
        errors.push(`Insert payment for ticket ${payment.ticket_id}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }
  
  return { inserted, errors };
}

export async function getTicketIdByExternalId(
  supabaseUrl: string,
  serviceRoleKey: string,
  externalId: string,
  locationId: string
): Promise<string | null> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const { data } = await supabase
    .from('tickets')
    .select('id')
    .eq('external_id', externalId)
    .eq('location_id', locationId)
    .maybeSingle();
  
  return data?.id || null;
}

export async function updateConnectionStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  status: 'connected' | 'disconnected' | 'error' | 'syncing',
  lastSyncAt?: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const updates: Record<string, any> = { status };
  if (lastSyncAt) {
    updates.last_sync_at = lastSyncAt;
  }
  
  await supabase
    .from('pos_connections')
    .update(updates)
    .eq('id', connectionId);
}
