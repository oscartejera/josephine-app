/**
 * Square Webhook Receiver
 * Receives and processes Square webhook events
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { verifySquareWebhookSignature } from '../_shared/crypto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const webhookSignature = req.headers.get('x-square-hmacsha256-signature');
    const body = await req.text();

    // Verify webhook signature (HMAC-SHA256)
    const signingKey = Deno.env.get('SQUARE_WEBHOOK_SIGNING_KEY');
    if (signingKey && webhookSignature) {
      const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook`;
      const valid = await verifySquareWebhookSignature(body, webhookSignature, signingKey, notificationUrl);
      if (!valid) {
        console.warn('[Square Webhook] Invalid signature — rejecting');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (signingKey && !webhookSignature) {
      console.warn('[Square Webhook] Missing signature header — rejecting');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    console.log('[Square Webhook] Received:', event.type);

    // Extract event details
    const eventType = event.type; // e.g., 'order.created', 'payment.updated'
    const merchantId = event.merchant_id;
    const eventId = event.event_id;
    const createdAt = event.created_at;
    const data = event.data?.object || {};

    // Find integration account
    const { data: account } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('external_account_id', merchantId)
      .eq('provider', 'square')
      .single();

    if (!account) {
      console.warn('[Square Webhook] No account found for merchant:', merchantId);
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
        provider: 'square',
        integration_account_id: account.id,
        event_type: eventType,
        external_id: data.id || eventId,
        event_ts: createdAt,
        payload: event,
        payload_hash: payloadHash,
        processed_status: 'pending',
      });

    if (insertError) {
      // If UNIQUE constraint violation, it's a duplicate - that's OK
      if (insertError.code === '23505') {
        console.log('[Square Webhook] Duplicate event, skipping:', eventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw insertError;
    }

    console.log('[Square Webhook] Stored event:', eventType, eventId);

    // Fire-and-forget: trigger async processing of pending events
    // This does NOT block the webhook response (Square expects fast 200)
    fetch(`${supabaseUrl}/functions/v1/process-raw-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    }).catch((err) => console.warn('[Square Webhook] Failed to trigger processing:', err));

    // Acknowledge receipt immediately
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Square Webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
