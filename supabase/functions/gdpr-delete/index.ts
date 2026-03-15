/**
 * gdpr-delete — Edge function that initiates GDPR account deletion.
 *
 * POST /functions/v1/gdpr-delete
 * Auth: Bearer token (Supabase JWT)
 *
 * Creates a deletion request with a 30-day grace period.
 * During the grace period, user can cancel by logging in.
 * After 30 days, a scheduled cron job performs the hard delete.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GRACE_PERIOD_DAYS = 30;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({
        error: 'A deletion request is already pending.',
        scheduled_for: existing[0].scheduled_for,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate scheduled deletion date (30 days from now)
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + GRACE_PERIOD_DAYS);

    // Create deletion request
    const { error: insertError } = await supabase
      .from('deletion_requests')
      .insert({
        user_id: userId,
        requested_at: new Date().toISOString(),
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
      });

    if (insertError) {
      throw insertError;
    }

    // Send confirmation email via Resend (optional — depends on RESEND_API_KEY being configured)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && user.email) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Josephine <josephine@josephine-ai.com>',
            to: [user.email],
            subject: 'Solicitud de eliminación de cuenta — Josephine',
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1e293b;">Solicitud de eliminación recibida</h2>
                <p style="color: #475569; line-height: 1.6;">
                  Hemos recibido tu solicitud de eliminar tu cuenta de Josephine.
                  Tu cuenta y datos serán eliminados permanentemente el
                  <strong>${scheduledFor.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                </p>
                <p style="color: #475569; line-height: 1.6;">
                  Si cambias de opinión, simplemente inicia sesión antes de esa fecha
                  y tu solicitud será cancelada automáticamente.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
                  Josephine — Gestión inteligente para tu restaurante
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        // Non-critical — log and continue
        console.warn('Failed to send deletion confirmation email:', emailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Deletion request created. Your account will be permanently deleted after the grace period.',
      scheduled_for: scheduledFor.toISOString(),
      grace_period_days: GRACE_PERIOD_DAYS,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GDPR delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
