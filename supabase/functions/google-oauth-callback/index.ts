/**
 * google-oauth-callback — Supabase Edge Function
 *
 * Handles the OAuth2 callback from Google after the restaurant owner
 * authorizes access to their Google Business Profile.
 *
 * Flow:
 *   1. Google redirects here with ?code=AUTH_CODE&state=ORG_ID
 *   2. We exchange the code for access_token + refresh_token
 *   3. Store tokens in `integration_tokens` table
 *   4. Redirect the user back to Josephine Settings
 *
 * Required secrets:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

serve(async (req) => {
    const url = new URL(req.url);

    // ── Step 0: If no code, START the OAuth flow ──────────────────────────
    if (!url.searchParams.get("code")) {
        const state = url.searchParams.get("state") || "default";
        const scopes = [
            "https://www.googleapis.com/auth/business.manage",
        ].join(" ");

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${GOOGLE_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(state)}`;

        return new Response(null, {
            status: 302,
            headers: { Location: authUrl },
        });
    }

    // ── Step 1: Exchange auth code for tokens ─────────────────────────────
    const code = url.searchParams.get("code")!;
    const state = url.searchParams.get("state") || "default";

    try {
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResp.ok) {
            const err = await tokenResp.text();
            console.error("[google-oauth] Token exchange failed:", err);
            return redirectWithError("Token exchange failed");
        }

        const tokens = await tokenResp.json();
        console.log("[google-oauth] Got tokens, access_token present:", !!tokens.access_token);

        // ── Step 2: Store tokens in Supabase ────────────────────────────────
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        const { error: upsertError } = await supabase
            .from("integration_tokens")
            .upsert({
                org_id: state,
                provider: "google_business",
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || null,
                token_type: tokens.token_type || "Bearer",
                expires_at: tokens.expires_in
                    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                    : null,
                scope: tokens.scope || "",
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "org_id,provider",
            });

        if (upsertError) {
            console.error("[google-oauth] Token storage failed:", upsertError);
            // Still redirect — tokens were obtained, just storage failed
        }

        // ── Step 3: Redirect back to Josephine ──────────────────────────────
        return new Response(null, {
            status: 302,
            headers: {
                Location: `https://www.josephine-ai.com/settings?google=connected`,
            },
        });
    } catch (error) {
        console.error("[google-oauth] Error:", error);
        return redirectWithError(error instanceof Error ? error.message : "Unknown error");
    }
});

function redirectWithError(msg: string): Response {
    return new Response(null, {
        status: 302,
        headers: {
            Location: `https://www.josephine-ai.com/settings?google=error&msg=${encodeURIComponent(msg)}`,
        },
    });
}
