/**
 * gdpr-export — Edge function that exports all user data as JSON.
 *
 * POST /functions/v1/gdpr-export
 * Auth: Bearer token (Supabase JWT)
 * Rate limit: 1 export per 24 hours per user
 *
 * Returns a JSON file with all PII and associated data for the authenticated user.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Rate limit: 1 export per 24h
    const { data: recentExport } = await supabase
      .from('consent_records')
      .select('granted_at')
      .eq('user_id', userId)
      .eq('consent_type', 'data_export')
      .gte('granted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (recentExport && recentExport.length > 0) {
      return new Response(JSON.stringify({
        error: 'Rate limited — you can request one export per 24 hours.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect all user data
    const [
      profileRes,
      locationsRes,
      recipesRes,
      productsRes,
      ordersRes,
      consentRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('locations').select('*').eq('group_id',
        (await supabase.from('profiles').select('group_id').eq('id', userId).single()).data?.group_id
      ),
      supabase.from('recipes').select('*').eq('created_by', userId),
      supabase.from('products').select('id, name, category, price, cost').eq('location_id',
        (await supabase.from('profiles').select('group_id').eq('id', userId).single()).data?.group_id
      ).limit(500),
      supabase.from('orders').select('id, order_date, total, items_count').eq('location_id',
        (await supabase.from('profiles').select('group_id').eq('id', userId).single()).data?.group_id
      ).limit(1000),
      supabase.from('consent_records').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profileRes.data,
      locations: locationsRes.data || [],
      recipes: recipesRes.data || [],
      products: productsRes.data || [],
      orders: ordersRes.data || [],
      consent_records: consentRes.data || [],
    };

    // Log the export as a consent record
    await supabase.from('consent_records').upsert({
      user_id: userId,
      consent_type: 'data_export',
      granted: true,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,consent_type' });

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="josephine-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('GDPR export error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
