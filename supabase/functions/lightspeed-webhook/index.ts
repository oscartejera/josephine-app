/**
 * Lightspeed Webhook Receiver
 * Receives and processes Lightspeed webhook events.
 * Pattern: Adapted from square-webhook.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const body = await req.text();
        const event = JSON.parse(body);

        console.log('[Lightspeed Webhook] Received:', event.type || 'unknown');

        const eventType = event.type || event.event || 'unknown';
        const businessId = event.business_id || event.businessId || 'unknown';
        const eventId = event.id || event.event_id || crypto.randomUUID();
        const data = event.data || event;

        // Find integration account
        const { data: account } = await supabase
            .from('integration_accounts')
            .select('id')
            .eq('external_account_id', String(businessId))
            .eq('provider', 'lightspeed')
            .single();

        if (!account) {
            console.warn('[Lightspeed Webhook] No account found for business:', businessId);
            return new Response(JSON.stringify({ received: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Generate payload hash for deduplication
        const encoder = new TextEncoder();
        const payloadBytes = encoder.encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', payloadBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Insert raw_event (idempotent via UNIQUE constraint)
        const { error: insertError } = await supabase
            .from('raw_events')
            .insert({
                provider: 'lightspeed',
                integration_account_id: account.id,
                event_type: eventType,
                external_id: String(eventId),
                event_ts: new Date().toISOString(),
                payload: event,
                payload_hash: payloadHash,
                processed_status: 'pending',
            });

        if (insertError) {
            if (insertError.code === '23505') {
                console.log('[Lightspeed Webhook] Duplicate event, skipping:', eventId);
                return new Response(JSON.stringify({ received: true, duplicate: true }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            throw insertError;
        }

        console.log('[Lightspeed Webhook] Stored event:', eventType, eventId);

        // Trigger async processing
        fetch(`${supabaseUrl}/functions/v1/process-raw-events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({}),
        }).catch((err) => console.warn('[Lightspeed Webhook] Failed to trigger processing:', err));

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('[Lightspeed Webhook] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
