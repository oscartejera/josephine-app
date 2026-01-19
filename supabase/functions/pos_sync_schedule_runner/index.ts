import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// This function is a placeholder for scheduled sync execution
// It can be triggered by a cron job or external scheduler

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get all active connections with schedules
    const { data: connections, error: fetchError } = await supabase
      .from('pos_connections')
      .select('id, location_id, provider, config_json, last_sync_at')
      .in('status', ['connected', 'disconnected']);
    
    if (fetchError) {
      throw new Error(`Failed to fetch connections: ${fetchError.message}`);
    }
    
    const results = [];
    const now = new Date();
    
    for (const conn of connections || []) {
      const config = conn.config_json as Record<string, any> || {};
      const schedule = config.schedule as string;
      
      if (!schedule) continue;
      
      // Calculate if sync is due
      const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at) : new Date(0);
      let shouldSync = false;
      
      switch (schedule) {
        case '15min':
          shouldSync = (now.getTime() - lastSync.getTime()) >= 15 * 60 * 1000;
          break;
        case '1hour':
          shouldSync = (now.getTime() - lastSync.getTime()) >= 60 * 60 * 1000;
          break;
        case 'daily':
          shouldSync = (now.getTime() - lastSync.getTime()) >= 24 * 60 * 60 * 1000;
          break;
      }
      
      if (shouldSync) {
        // Dispatch sync
        const { data, error } = await supabase.functions.invoke('pos_sync_dispatch', {
          body: {
            provider: conn.provider,
            location_id: conn.location_id,
            connection_id: conn.id,
            mode: 'incremental',
          },
        });
        
        results.push({
          connection_id: conn.id,
          provider: conn.provider,
          location_id: conn.location_id,
          success: !error,
          error: error?.message,
          result: data,
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        executed_at: now.toISOString(),
        syncs_triggered: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Schedule runner error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
