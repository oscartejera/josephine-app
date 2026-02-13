/**
 * Vercel Serverless Function — Square OAuth Callback
 *
 * Handles the OAuth redirect from Square, exchanges the authorization code
 * for tokens, stores encrypted credentials in Supabase, and redirects to
 * the integration page.
 *
 * This bypasses the Supabase Edge Function gateway issue (which blocks
 * browser GET redirects that lack an Authorization header).
 *
 * Required Vercel env vars:
 *   SQUARE_PRODUCTION_CLIENT_ID
 *   SQUARE_PRODUCTION_CLIENT_SECRET
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL  (already set)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SALT = Buffer.from('josephine-square-token-v1');

function encryptToken(plaintext: string, secret: string): string {
  const derivedKey = crypto.pbkdf2Sync(secret, SALT, 100_000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const oauthError = req.query.error as string | undefined;

  if (oauthError) {
    const desc = (req.query.error_description as string) || oauthError;
    return res.redirect(`/integrations/square?error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return res.redirect('/integrations/square?error=Missing+code+or+state');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE env vars');
    return res.redirect('/integrations/square?error=Server+configuration+error');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Verify state (CSRF protection)
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('metadata->>oauth_state', state)
      .single();

    if (!integration) {
      return res.redirect('/integrations/square?error=Invalid+state+-+integration+not+found');
    }

    const environment = integration.metadata?.oauth_environment || 'production';
    const clientId = process.env.SQUARE_PRODUCTION_CLIENT_ID;
    const clientSecret = process.env.SQUARE_PRODUCTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing SQUARE credentials env vars');
      return res.redirect('/integrations/square?error=Square+credentials+not+configured');
    }

    const tokenUrl = environment === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    // redirect_uri must match what was sent in the authorize request
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${proto}://${host}/api/square-callback`;

    // Exchange code for tokens
    const tokenResp = await fetch(tokenUrl, {
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

    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      console.error('Square token exchange failed:', errorText);
      return res.redirect('/integrations/square?error=Token+exchange+failed');
    }

    const tokens = await tokenResp.json();

    // Encrypt tokens before storing
    const encryptionSecret = process.env.SQUARE_TOKEN_ENCRYPTION_KEY || supabaseKey;
    const encryptedAccessToken = encryptToken(tokens.access_token, encryptionSecret);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token, encryptionSecret)
      : null;

    // Store in integration_accounts
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

    // Trigger first sync (fire-and-forget)
    const { data: account } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('environment', environment)
      .single();

    if (account) {
      fetch(`${supabaseUrl}/functions/v1/square-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ accountId: account.id }),
      }).catch(() => {});
    }

    return res.redirect('/integrations/square?connected=true');
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return res.redirect(`/integrations/square?error=${encodeURIComponent(err.message)}`);
  }
}
