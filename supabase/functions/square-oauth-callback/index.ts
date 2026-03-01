/**
 * Square OAuth Callback
 *
 * GET endpoint — Square redirects here after the user authorizes.
 * Reads `code` + `state` from URL query params, then:
 * 1. Validates state against integrations.metadata->oauth_state
 * 2. Exchanges code for tokens at Square's token endpoint
 * 3. Persists the account in integration_accounts (schema-safe columns only)
 * 4. Persists tokens in integration_secrets
 * 5. Marks the integration as active
 * 6. Fire-and-forget triggers first sync
 * 7. Redirects browser to the app at /integrations/square?connected=true
 *
 * DB SCHEMA (current):
 *   integrations          (id, org_id, provider, is_enabled, status, metadata, created_at)
 *   integration_accounts  (id, integration_id, external_account_id, display_name, metadata, created_at, org_id, provider)
 *   integration_secrets   (integration_account_id PK, access_token, refresh_token, token_expires_at, rotated_at)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state from Square redirect');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Verify state (CSRF) ──────────────────────────────────────────
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('metadata->>oauth_state', state)
      .single();

    if (!integration) {
      throw Object.assign(new Error('expired_state'), { isExpiredState: true });
    }

    const environment: string = integration.metadata?.oauth_environment || 'production';
    const appUrl: string = integration.metadata?.app_url || Deno.env.get('APP_URL') || 'https://josephine-app.vercel.app';
    const orgId: string = integration.org_id;

    // ── 2. Exchange code for tokens ─────────────────────────────────────
    const clientId = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_ID')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_ID');

    const clientSecret = environment === 'production'
      ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_SECRET')
      : Deno.env.get('SQUARE_SANDBOX_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(`Square credentials not configured for ${environment}`);
    }

    const tokenUrl = environment === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    // Don't send redirect_uri — Square uses the Redirect URL from the Developer Dashboard.
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
      const errBody = await tokenResponse.text();
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${errBody}`);
    }

    const tokens = await tokenResponse.json();
    const merchantId: string = tokens.merchant_id;

    if (!merchantId) {
      throw new Error('Square did not return a merchant_id');
    }

    // ── 3. Upsert integration_accounts ──────────────────────────────────
    // Backed by UNIQUE INDEX integration_accounts_integration_external_account_key
    // on (integration_id, external_account_id). Select-first for clarity.
    const { data: existingAccount } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('external_account_id', merchantId)
      .limit(1)
      .maybeSingle();

    let accountId: string;

    if (existingAccount) {
      await supabase
        .from('integration_accounts')
        .update({
          display_name: `Square (${merchantId.slice(-6)})`,
          metadata: { merchant_id: merchantId, environment, connected_at: new Date().toISOString() },
        })
        .eq('id', existingAccount.id);
      accountId = existingAccount.id;
    } else {
      const { data: newAccount, error: insertErr } = await supabase
        .from('integration_accounts')
        .insert({
          integration_id: integration.id,
          external_account_id: merchantId,
          display_name: `Square (${merchantId.slice(-6)})`,
          org_id: orgId,
          provider: 'square',
          metadata: { merchant_id: merchantId, environment, connected_at: new Date().toISOString() },
        })
        .select('id')
        .single();

      if (insertErr || !newAccount) {
        throw new Error(`Failed to create integration_account: ${insertErr?.message}`);
      }
      accountId = newAccount.id;
    }

    // ── 4. Upsert integration_secrets ───────────────────────────────────
    const expiresAt = tokens.expires_at
      ? new Date(tokens.expires_at).toISOString()
      : null;

    const { error: secretErr } = await supabase
      .from('integration_secrets')
      .upsert({
        integration_account_id: accountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt,
        rotated_at: new Date().toISOString(),
      }, { onConflict: 'integration_account_id' });

    if (secretErr) {
      console.error('Failed to upsert integration_secrets:', secretErr);
      // Don't throw here — account is created, we can still redirect.
      // Tokens can be re-fetched via a re-authorization.
    }

    // ── 5. Mark integration as active ───────────────────────────────────
    await supabase
      .from('integrations')
      .update({
        status: 'active',
        is_enabled: true,
        metadata: {
          ...integration.metadata,
          last_synced_at: null,
          oauth_state: null, // consumed
        },
      })
      .eq('id', integration.id);

    // ── 6. Fire-and-forget: trigger first sync ──────────────────────────
    fetch(`${supabaseUrl}/functions/v1/square-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ org_id: orgId, lookback_days: 7 }),
    }).catch((e) => {
      console.warn('Auto-sync trigger failed (non-blocking):', e.message);
    });

    // ── 7. Redirect to the app ──────────────────────────────────────────
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/integrations/square?connected=true`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);

    const appUrl = Deno.env.get('APP_URL') || 'https://josephine-app.vercel.app';
    const retryUrl = `${appUrl}/integrations/square`;
    const isExpired = (error as any)?.isExpiredState === true;

    const title = isExpired
      ? 'Enlace expirado o ya utilizado'
      : 'Error de conexión con Square';
    const message = isExpired
      ? 'Este enlace de autorización ya fue utilizado o ha expirado. Vuelve a conectar desde la app.'
      : `Ha ocurrido un error al conectar con Square: ${error.message}`;
    const icon = isExpired ? '🔗' : '⚠️';

    return new Response(
      `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta http-equiv="refresh" content="5;url=${retryUrl}">
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;padding:2rem;max-width:500px;margin:4rem auto;text-align:center">
  <div style="font-size:3rem;margin-bottom:1rem">${icon}</div>
  <h2 style="margin:0 0 .5rem;color:#1a1a2e">${title}</h2>
  <p style="color:#64748b;line-height:1.5">${message}</p>
  <p style="color:#94a3b8;font-size:.875rem;margin-top:1.5rem">
    Redirigiendo en <span id="cd">5</span> segundos…
  </p>
  <a href="${retryUrl}" style="display:inline-block;margin-top:1rem;padding:.6rem 1.5rem;background:#2563eb;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:500">
    Volver a Integraciones
  </a>
  <script>let s=5;const el=document.getElementById('cd');setInterval(()=>{if(--s>=0)el.textContent=s;},1000);</script>
</body>
</html>`,
      { status: isExpired ? 410 : 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
});

// ── Smoke test payloads (commented) ───────────────────────────────────────
//
// Square redirects to:
//   GET /functions/v1/square-oauth-callback?code=sq0cgb-XXX&state=26e6b76d-...
//
// Expected DB writes:
//   integration_accounts: { integration_id, external_account_id: 'MLXXX', display_name: 'Square (XXXXXX)', org_id, provider: 'square' }
//   integration_secrets:  { integration_account_id: <UUID>, access_token, refresh_token, token_expires_at }
//   integrations:         { status: 'active', is_enabled: true, metadata.oauth_state: null }
//
// Expected result:
//   302 redirect → /integrations/square?connected=true
