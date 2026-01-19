import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createErrorResponse } from '../_shared/error-handler.ts';

const FUNCTION_MAP: Record<string, string> = {
  revo: 'pos_sync_revo',
  glop: 'pos_sync_glop',
  square: 'pos_sync_square',
  lightspeed: 'pos_sync_lightspeed',
  csv: 'pos_import_csv',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { provider, location_id, connection_id, mode = 'incremental', csv_data, csv_mapping } = await req.json();
    
    if (!provider || !location_id) {
      return new Response(
        JSON.stringify({ error: 'Missing provider or location_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const functionName = FUNCTION_MAP[provider];
    if (!functionName) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build request body
    const requestBody: Record<string, any> = {
      connection_id,
      location_id,
      mode,
    };
    
    // For CSV, include data and mapping
    if (provider === 'csv' && csv_data && csv_mapping) {
      requestBody.data = csv_data;
      requestBody.mapping = csv_mapping;
    }
    
    // Call the provider-specific function
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: requestBody,
    });
    
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        dispatched_to: functionName,
        provider,
        location_id,
        mode,
        result: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    return createErrorResponse('dispatch', 'dispatch', error, { mode: 'dispatch' });
  }
});
