/**
 * Square OAuth Start
 * Genera URL de autorización Square y guarda state para CSRF
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrationId, environment, appUrl } = await req.json();

    const clientId = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_ID')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_ID');

    if (!clientId) {
      throw new Error('Square client ID not configured for ' + environment);
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Save state + app URL to verify on callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('integrations')
      .update({
        metadata: { oauth_state: state, oauth_environment: environment, app_url: appUrl }
      })
      .eq('id', integrationId);

    // Build Square OAuth URL
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    // Redirect to the frontend callback page (not the Edge Function directly)
    // so the browser never hits the Supabase gateway without auth headers.
    const redirectUri = `${appUrl}/integrations/square/callback`;

    const scopes = [
      'MERCHANT_PROFILE_READ',
      'ITEMS_READ',
      'ORDERS_READ',
      'PAYMENTS_READ',
    ].join('+');

    const authUrl = `${baseUrl}?client_id=${clientId}&scope=${scopes}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
