/**
 * Square OAuth Start
 * Genera URL de autorización Square
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrationId, environment } = await req.json();

    // Get Square credentials from Supabase Secrets
    const clientId = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_ID')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_ID');

    if (!clientId) {
      throw new Error('Square client ID not configured');
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    
    // Save state to verify on callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('integrations')
      .update({ 
        metadata: { oauth_state: state, oauth_environment: environment } 
      })
      .eq('id', integrationId);

    // Build Square OAuth URL
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const redirectUri = `${supabaseUrl}/functions/v1/square-oauth-callback`;
    
    const authUrl = `${baseUrl}?client_id=${clientId}&scope=MERCHANT_PROFILE_READ+ITEMS_READ+ORDERS_READ+PAYMENTS_READ&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

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
