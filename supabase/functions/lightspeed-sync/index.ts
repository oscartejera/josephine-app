/**
 * Lightspeed Sync Edge Function
 * Pulls sales, products, and staff from Lightspeed REST API.
 * Normalizes to CDM (pos_transactions, staging tables).
 * Pattern: Adapted from square-sync.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { LightspeedClient } from '../_shared/lightspeed-client.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let runId: string | null = null;
    let integrationId: string | null = null;

    async function finalizeRun(status: 'success' | 'failed', stats: Record<string, number>, errorMsg?: string) {
        if (!runId) return;
        await supabase.from('integration_sync_runs').update({
            status,
            finished_at: new Date().toISOString(),
            error: errorMsg || null,
            cursor: JSON.stringify(stats),
        }).eq('id', runId);
    }

    try {
        const { integrationId: intId, org_id, lookback_days = 30 } = await req.json();
        integrationId = intId;

        // Find integration + account + tokens
        const { data: account } = await supabase
            .from('integration_accounts')
            .select('id, external_account_id, metadata')
            .eq('provider', 'lightspeed')
            .limit(1)
            .single();

        if (!account) throw new Error('No Lightspeed account found');

        const { data: secrets } = await supabase
            .from('integration_secrets')
            .select('access_token, refresh_token, token_expires_at')
            .eq('integration_account_id', account.id)
            .single();

        if (!secrets) throw new Error('No Lightspeed tokens found');

        // Check if token needs refresh
        let accessToken = secrets.access_token;
        if (secrets.token_expires_at && new Date(secrets.token_expires_at) < new Date()) {
            console.log('[Lightspeed Sync] Token expired, refreshing...');
            const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID')!;
            const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET')!;
            const newTokens = await LightspeedClient.refreshToken(clientId, clientSecret, secrets.refresh_token);
            accessToken = newTokens.access_token;

            await supabase.from('integration_secrets').update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                rotated_at: new Date().toISOString(),
            }).eq('integration_account_id', account.id);
        }

        // Create sync run
        const { data: run } = await supabase.from('integration_sync_runs').insert({
            integration_id: integrationId,
            status: 'running',
            started_at: new Date().toISOString(),
        }).select('id').single();
        runId = run?.id || null;

        const client = new LightspeedClient(accessToken);
        const businessId = account.external_account_id;
        const stats = { sales: 0, items: 0, staff: 0 };

        // ── Pull Sales ──────────────────────────────────────────────
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - lookback_days * 86400000).toISOString().split('T')[0];

        try {
            const salesData = await client.getSales(businessId, startDate, endDate);
            const salesArray = Array.isArray(salesData) ? salesData : salesData?.data || [];

            for (const sale of salesArray) {
                const saleDate = sale.timeClosed?.split('T')[0] || sale.date;
                if (!saleDate) continue;

                await supabase.from('pos_transactions' as any).upsert({
                    location_id: org_id, // Will need to map to actual location
                    date: saleDate,
                    source: 'lightspeed',
                    external_id: sale.id || `ls-${saleDate}`,
                    amount: sale.totalInclTax || sale.total || 0,
                    net_amount: sale.totalExclTax || sale.net || 0,
                    tax_amount: sale.totalTax || 0,
                    metadata: sale,
                }, { onConflict: 'location_id,date,source,external_id' });
                stats.sales++;
            }
        } catch (e) {
            console.warn('[Lightspeed Sync] Sales pull error:', e.message);
        }

        // ── Pull Catalog/Items ──────────────────────────────────────
        try {
            const itemsData = await client.getItems(businessId);
            const items = Array.isArray(itemsData) ? itemsData : itemsData?.data || [];

            for (const item of items.slice(0, 500)) {
                await supabase.from('raw_events').upsert({
                    provider: 'lightspeed',
                    integration_account_id: account.id,
                    event_type: 'catalog_item',
                    external_id: String(item.id || item.sku),
                    event_ts: new Date().toISOString(),
                    payload: item,
                    payload_hash: String(item.id),
                    processed_status: 'processed',
                }, { onConflict: 'provider,integration_account_id,external_id' });
                stats.items++;
            }
        } catch (e) {
            console.warn('[Lightspeed Sync] Items pull error:', e.message);
        }

        // ── Pull Staff ──────────────────────────────────────────────
        try {
            const staffData = await client.getStaff(businessId);
            const staff = Array.isArray(staffData) ? staffData : staffData?.data || [];

            for (const member of staff) {
                await supabase.from('raw_events').upsert({
                    provider: 'lightspeed',
                    integration_account_id: account.id,
                    event_type: 'staff_member',
                    external_id: String(member.id || member.email),
                    event_ts: new Date().toISOString(),
                    payload: member,
                    payload_hash: String(member.id),
                    processed_status: 'processed',
                }, { onConflict: 'provider,integration_account_id,external_id' });
                stats.staff++;
            }
        } catch (e) {
            console.warn('[Lightspeed Sync] Staff pull error:', e.message);
        }

        await finalizeRun('success', stats);

        console.log('[Lightspeed Sync] Done:', stats);

        return new Response(
            JSON.stringify({ success: true, stats }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('[Lightspeed Sync] Error:', error);
        await finalizeRun('failed', {}, error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
