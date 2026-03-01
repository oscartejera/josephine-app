/**
 * Square OAuth Exchange
 *
 * POST endpoint called by the frontend with { code, state }.
 * Exchanges the authorization code for tokens, then:
 * 1. Validates state against integrations.metadata->oauth_state (CSRF check)
 * 2. Persists the account in integration_accounts (schema-safe)
 * 3. Persists tokens in integration_secrets
 * 4. Marks the integration as active
 * 5. Fire-and-forget triggers first sync
 *
 * DB SCHEMA (current):
 *   integrations          (id, org_id, provider, is_enabled, status, metadata, created_at)
 *   integration_accounts  (id, integration_id, external_account_id, display_name, metadata, created_at, org_id, provider)
 *   integration_secrets   (integration_account_id PK, access_token, refresh_token, token_expires_at, rotated_at)
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
    const { code, state } = await req.json();

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 1. Verify state (CSRF) ──────────────────────────────────────────
    const { data: integration, error: stateErr } = await supabase
      .from('integrations')
      .select('*')
      .eq('metadata->>oauth_state', state)
      .single();

    if (stateErr || !integration) {
      return new Response(
        JSON.stringify({ error: 'Invalid state – integration not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const environment: string = integration.metadata?.oauth_environment || 'production';

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

    const orgId: string = integration.org_id;

    // ── 3. Upsert integration_accounts ──────────────────────────────────
    // Match on (integration_id + external_account_id) — safe columns only.
    const { data: existingAccount } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('external_account_id', merchantId)
      .limit(1)
      .maybeSingle();

    let accountId: string;

    if (existingAccount) {
      // Update existing account
      await supabase
        .from('integration_accounts')
        .update({
          display_name: `Square (${merchantId.slice(-6)})`,
          metadata: { merchant_id: merchantId, environment, connected_at: new Date().toISOString() },
        })
        .eq('id', existingAccount.id);
      accountId = existingAccount.id;
    } else {
      // Insert new account
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
    // PK = integration_account_id → upsert is safe
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
      throw new Error(`Failed to store tokens: ${secretErr.message}`);
    }

    // ── 5. Mark integration as active ───────────────────────────────────
    await supabase
      .from('integrations')
      .update({
        status: 'active',
        is_enabled: true,
        metadata: {
          ...integration.metadata,
          last_synced_at: null, // will be set after first successful sync
          oauth_state: null,   // consumed
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

    // ── 7. Return success ───────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        merchantId,
        accountId,
      }),
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

// ── Smoke test payloads (commented) ───────────────────────────────────────
//
// POST /functions/v1/square-oauth-exchange
// {
//   "code": "sq0cgb-XXXXXXXXXXXXXXXXXXXXXXXX",
//   "state": "26e6b76d-c878-4a43-9c39-98c1860c849a"
// }
//
// Expected DB writes:
//   integration_accounts: { integration_id, external_account_id: 'MLXXXXXXX', display_name: 'Square (XXXXXX)', org_id, provider: 'square' }
//   integration_secrets:  { integration_account_id: <UUID>, access_token: '...', refresh_token: '...', token_expires_at: '...' }
//   integrations:         { status: 'active', is_enabled: true, metadata.oauth_state: null }
//
// Expected response:
//   { "success": true, "merchantId": "MLXXXXXXX", "accountId": "<uuid>" }
