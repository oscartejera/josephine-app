/**
 * Square OAuth Callback
 * Intercambia code por tokens y guarda credentials
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { encryptToken } from '../_shared/crypto.ts';

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
      .eq('metadata->>oauth_state', state)
      .single();

    if (!integration) {
      throw new Error('Invalid state - integration not found');
    }

    const environment = integration.metadata?.oauth_environment || 'sandbox';
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

    const redirectUri = `${supabaseUrl}/functions/v1/square-oauth-callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
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

    // Trigger first sync automatically (fire-and-forget via pg_net or direct call)
    // This runs the sync in the background so data is ready within ~30 seconds
    if (createdAccount) {
      fetch(`${supabaseUrl}/functions/v1/square-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ accountId: createdAccount.id }),
      }).catch(() => {
        // Fire-and-forget: don't block redirect if sync fails to start
      });
    }

    // Redirect to the app
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appUrl}/integrations/square?connected=true`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body>
        <h2>Error de conexión</h2>
        <p>${error.message}</p>
        <a href="javascript:window.close()">Cerrar</a>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});
