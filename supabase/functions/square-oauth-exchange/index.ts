/**
 * Square OAuth Exchange
 * Called by the frontend callback page via POST with code + state.
 * Exchanges the authorization code for tokens and stores credentials.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { encryptToken } from '../_shared/crypto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { code, state } = await req.json();

    if (!code || !state) {
      throw new Error('Missing code or state');
    }

    // Verify state (CSRF protection)
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('metadata->>oauth_state', state)
      .single();

    if (!integration) {
      throw new Error('Invalid state - integration not found');
    }

    const environment = integration.metadata?.oauth_environment || 'production';
    const appUrl = integration.metadata?.app_url || 'https://josephine-app.vercel.app';
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

    // Don't send redirect_uri — it was omitted from the authorize request,
    // so Square uses the Redirect URL from the Developer Dashboard for both steps.
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

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token)
      : null;

    // Create integration_account
    await supabase
      .from('integration_accounts')
      .upsert({
        integration_id: integration.id,
        provider: 'square',
        environment,
        external_account_id: tokens.merchant_id,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: tokens.expires_at || null,
        metadata: { merchant_id: tokens.merchant_id },
      }, { onConflict: 'integration_id,environment' });

    // Update integration status
    await supabase
      .from('integrations')
      .update({ status: 'active' })
      .eq('id', integration.id);

    // Get the created account ID for auto-sync
    const { data: createdAccount } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('environment', environment)
      .single();

    // Trigger first sync automatically (fire-and-forget)
    if (createdAccount) {
      fetch(`${supabaseUrl}/functions/v1/square-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ accountId: createdAccount.id }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, merchantId: tokens.merchant_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('OAuth exchange error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
