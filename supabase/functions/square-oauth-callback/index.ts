/**
 * Square OAuth Callback
 * Intercambia code por tokens y guarda credentials
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify state
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('metadata->oauth_state', state)
      .single();

    if (!integration) {
      throw new Error('Invalid state - integration not found');
    }

    const environment = integration.metadata?.oauth_environment || 'sandbox';
    const clientId = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_ID')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_ID');

    const clientSecret = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_SECRET')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Square credentials not configured');
    }

    // Exchange code for tokens
    const tokenUrl = environment === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Create integration_account (tokens should be encrypted in production)
    await supabase
      .from('integration_accounts')
      .insert({
        integration_id: integration.id,
        provider: 'square',
        environment,
        external_account_id: tokens.merchant_id,
        access_token_encrypted: tokens.access_token, // TODO: Encrypt
        refresh_token_encrypted: tokens.refresh_token || null,
        token_expires_at: tokens.expires_at || null,
        metadata: { merchant_id: tokens.merchant_id },
      });

    // Update integration status
    await supabase
      .from('integrations')
      .update({ status: 'active' })
      .eq('id', integration.id);

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${supabaseUrl.replace('/functions/v1', '')}/integrations/square?success=true`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});
