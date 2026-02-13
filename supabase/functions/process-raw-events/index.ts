/**
 * Process Raw Events
 * Reads pending webhook events from raw_events and processes them into CDM tables.
 * Designed to be called by a cron job or after webhook ingestion.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import {
  normalizeSquareOrder,
  normalizeSquarePayment,
} from '../_shared/cdm-normalizer.ts';

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const stats = { processed: 0, skipped: 0, errors: 0 };

  try {
    // Fetch pending events ordered by creation time
    const { data: events, error: fetchError } = await supabase
      .from('raw_events')
      .select('*')
      .eq('processed_status', 'pending')
      .order('event_ts', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending events', stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    for (const event of events) {
      try {
        const eventType: string = event.event_type || '';
        const payload = event.payload;
        const data = payload?.data?.object || {};
        const accountId = event.integration_account_id;

        // Get org_id from integration_account → integration
        const { data: account } = await supabase
          .from('integration_accounts')
          .select('*, integration:integrations(org_id)')
          .eq('id', accountId)
          .single();

        if (!account) {
          await markEvent(supabase, event.id, 'error', 'Account not found');
          stats.errors++;
          continue;
        }

        const orgId = account.integration?.org_id;

        // Build location map for this org
        const { data: cdmLocations } = await supabase
          .from('cdm_locations')
          .select('id, external_id')
          .eq('org_id', orgId);

        const locationMap = new Map<string, string>();
        for (const loc of cdmLocations || []) {
          locationMap.set(loc.external_id, loc.id);
        }

        // Process by event type
        if (eventType.startsWith('order.')) {
          await processOrder(supabase, data, orgId, locationMap);
        } else if (eventType.startsWith('payment.')) {
          await processPayment(supabase, data, orgId, locationMap);
        } else if (eventType.startsWith('catalog.')) {
          // Catalog changes are best handled by a full sync
          // Mark as processed — the next scheduled sync will pick up changes
        } else if (eventType.startsWith('inventory.')) {
          await processInventory(supabase, data, orgId);
        }
        // All other event types: store but don't process yet

        await markEvent(supabase, event.id, 'ok');
        stats.processed++;
      } catch (err) {
        console.error(`[process-raw-events] Error processing event ${event.id}:`, err);
        await markEvent(supabase, event.id, 'error', err.message);
        stats.errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[process-raw-events] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stats }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function markEvent(
  supabase: any,
  eventId: string,
  status: 'ok' | 'error',
  errorText?: string,
) {
  await supabase
    .from('raw_events')
    .update({
      processed_status: status,
      processed_at: new Date().toISOString(),
      ...(errorText ? { error_text: errorText } : {}),
    })
    .eq('id', eventId);
}

async function processOrder(
  supabase: any,
  data: any,
  orgId: string,
  locationMap: Map<string, string>,
) {
  // data is the Square order object (inside data.object from webhook)
  const order = data.order || data;
  if (!order.id) return;

  const normalized = normalizeSquareOrder(order, orgId, locationMap);

  const { data: cdmOrder } = await supabase
    .from('cdm_orders')
    .upsert(normalized.order, { onConflict: 'external_provider,external_id' })
    .select()
    .single();

  if (cdmOrder) {
    for (const line of normalized.lines) {
      await supabase
        .from('cdm_order_lines')
        .upsert({ ...line, order_id: cdmOrder.id });
    }
  }
}

async function processPayment(
  supabase: any,
  data: any,
  orgId: string,
  locationMap: Map<string, string>,
) {
  const payment = data.payment || data;
  if (!payment.id) return;

  const normalized = normalizeSquarePayment(payment, orgId, locationMap);
  await supabase
    .from('cdm_payments')
    .upsert(normalized, { onConflict: 'external_provider,external_id' });
}

async function processInventory(
  supabase: any,
  data: any,
  orgId: string,
) {
  // Inventory count updates from Square
  const counts = data.counts || [];
  for (const count of counts) {
    if (!count.catalog_object_id) continue;

    // Find matching inventory item via CDM item
    const { data: cdmItem } = await supabase
      .from('cdm_items')
      .select('name')
      .eq('external_id', count.catalog_object_id)
      .eq('org_id', orgId)
      .single();

    if (!cdmItem) continue;

    // Update inventory_items if exists
    const { data: invItem } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('name', cdmItem.name)
      .single();

    if (invItem) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: Number(count.quantity || 0) })
        .eq('id', invItem.id);
    }
  }
}
