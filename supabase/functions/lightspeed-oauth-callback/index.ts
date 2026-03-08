/**
 * Lightspeed OAuth Callback
 * GET endpoint — Lightspeed redirects here after user authorizes.
 * 1. Validates state against integrations.metadata->oauth_state
 * 2. Exchanges authorization code for access/refresh tokens
 * 3. Upserts integration_accounts + integration_secrets
 * 4. Marks integration as active
 * 5. Auto-triggers lightspeed-sync
 * 6. Redirects to app
 *
 * Pattern: Adapted from square-oauth-callback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || !state) {
            throw new Error('Missing code or state from Lightspeed redirect');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ── 1. Validate state ──────────────────────────────────────────
        const { data: integration, error: intErr } = await supabase
            .from('integrations')
            .select('id, org_id, metadata')
            .eq('provider', 'lightspeed')
            .single();

        if (intErr || !integration) {
            throw new Error('Lightspeed integration not found');
        }

        if (integration.metadata?.oauth_state !== state) {
            throw new Error('Invalid state — possible CSRF attack');
        }

        const appUrl: string = integration.metadata?.app_url || Deno.env.get('APP_URL') || 'https://josephine-app.vercel.app';
        const orgId: string = integration.org_id;

        // ── 2. Exchange code for tokens ────────────────────────────────
        const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID')!;
        const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET')!;
        const redirectUri = `${supabaseUrl}/functions/v1/lightspeed-oauth-callback`;

        const tokenResponse = await fetch('https://cloud.lightspeedapp.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            throw new Error(`Token exchange failed (${tokenResponse.status}): ${errBody}`);
        }

        const tokens = await tokenResponse.json();
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token;
        const expiresIn = tokens.expires_in || 3600;

        // Get business info to use as account identifier
        const bizResponse = await fetch('https://api.lightspeedrestaurant.com/businesses', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const businesses = await bizResponse.json();
        const businessId = businesses?.[0]?.id || 'unknown';
        const businessName = businesses?.[0]?.name || 'Lightspeed Business';

        // ── 3. Upsert integration_accounts ─────────────────────────────
        const { data: existingAccount } = await supabase
            .from('integration_accounts')
            .select('id')
            .eq('external_account_id', String(businessId))
            .eq('provider', 'lightspeed')
            .single();

        let accountId: string;

        if (existingAccount) {
            await supabase
                .from('integration_accounts')
                .update({
                    display_name: businessName,
                    metadata: { business_id: businessId, connected_at: new Date().toISOString() },
                })
                .eq('id', existingAccount.id);
            accountId = existingAccount.id;
        } else {
            const { data: newAccount, error: insertErr } = await supabase
                .from('integration_accounts')
                .insert({
                    integration_id: integration.id,
                    external_account_id: String(businessId),
                    display_name: businessName,
                    org_id: orgId,
                    provider: 'lightspeed',
                    metadata: { business_id: businessId, connected_at: new Date().toISOString() },
                })
                .select('id')
                .single();

            if (insertErr || !newAccount) throw new Error('Failed to create integration account');
            accountId = newAccount.id;
        }

        // ── 4. Upsert integration_secrets ──────────────────────────────
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        await supabase.from('integration_secrets').upsert({
            integration_account_id: accountId,
            access_token: accessToken,
            refresh_token: refreshToken || null,
            token_expires_at: expiresAt,
            rotated_at: new Date().toISOString(),
        }, { onConflict: 'integration_account_id' });

        // ── 5. Mark integration as active ──────────────────────────────
        await supabase
            .from('integrations')
            .update({
                status: 'active',
                is_enabled: true,
                metadata: { ...integration.metadata, oauth_state: null },
            })
            .eq('id', integration.id);

        // ── 6. Trigger initial sync (fire-and-forget) ──────────────────
        fetch(`${supabaseUrl}/functions/v1/lightspeed-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ integrationId: integration.id, org_id: orgId, lookback_days: 30 }),
        }).catch((e) => {
            console.warn('Auto-sync trigger failed (non-blocking):', e.message);
        });

        // ── 7. Redirect to the app ─────────────────────────────────────
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${appUrl}/integrations/lightspeed?connected=true`,
            },
        });

    } catch (error) {
        console.error('Lightspeed OAuth callback error:', error);

        const appUrl = Deno.env.get('APP_URL') || 'https://josephine-app.vercel.app';

        return new Response(
            `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error de Conexión</title>
  <meta http-equiv="refresh" content="5;url=${appUrl}/integrations/lightspeed">
</head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;text-align:center">
  <div>
    <p style="font-size:3rem">⚠️</p>
    <h1>Error al conectar con Lightspeed</h1>
    <p style="color:#94a3b8">${error.message}</p>
    <p style="color:#64748b;font-size:0.8rem">Redirigiendo en 5 segundos...</p>
  </div>
</body>
</html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
});
