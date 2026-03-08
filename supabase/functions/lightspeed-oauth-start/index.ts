/**
 * Lightspeed OAuth Start
 * Generates Lightspeed authorization URL and saves state for CSRF
 * Pattern: Adapted from square-oauth-start
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { integrationId, appUrl } = await req.json();

        const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
        if (!clientId) {
            throw new Error('LIGHTSPEED_CLIENT_ID not configured');
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
                metadata: { oauth_state: state, app_url: appUrl }
            })
            .eq('id', integrationId);

        // Build Lightspeed OAuth URL
        const redirectUri = `${supabaseUrl}/functions/v1/lightspeed-oauth-callback`;
        const scopes = 'financialV2 items staff-api';

        const authUrl = `https://cloud.lightspeedapp.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

        return new Response(
            JSON.stringify({ authUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Lightspeed OAuth start error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
