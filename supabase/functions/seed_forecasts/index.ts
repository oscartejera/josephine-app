import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const startYear = body.startYear || 2022;
    const endYear = body.endYear || 2026;

    console.log(`Seeding forecasts from ${startYear} to ${endYear}`);

    // Get all locations
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('id, name');

    if (locError) throw locError;
    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ error: 'No locations found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`Found ${locations.length} locations`);

    // Hash function for deterministic randomness
    const hashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    // Base hourly patterns (typical restaurant pattern)
    const hourlyPattern: Record<number, number> = {
      10: 0.02, 11: 0.04, 12: 0.12, 13: 0.14, 14: 0.10,
      15: 0.03, 16: 0.02, 17: 0.04, 18: 0.08, 19: 0.12,
      20: 0.14, 21: 0.10, 22: 0.04, 23: 0.01
    };

    // Day of week multipliers
    const dowMultipliers: Record<number, number> = {
      0: 1.15, // Sunday
      1: 0.75, // Monday
      2: 0.85, // Tuesday
      3: 0.90, // Wednesday
      4: 0.95, // Thursday
      5: 1.30, // Friday
      6: 1.40  // Saturday
    };

    let totalInserted = 0;
    const batchSize = 1000;

    // Process each location
    for (const location of locations) {
      // Base daily sales varies by location
      const locationHash = hashCode(location.id);
      const baseDailySales = 3000 + (locationHash % 5000); // €3000-€8000 base
      const baseCovers = Math.round(baseDailySales / 28); // ~€28 avg check

      console.log(`Processing ${location.name}: base €${baseDailySales}/day`);

      // Process year by year
      for (let year = startYear; year <= endYear; year++) {
        const rows: any[] = [];

        // Process each month
        for (let month = 1; month <= 12; month++) {
          const now = new Date();
          // Skip future months beyond current
          if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
            continue;
          }

          const daysInMonth = new Date(year, month, 0).getDate();

          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const date = new Date(year, month - 1, day);
            const dow = date.getDay();

            // Daily variation based on date
            const dateHash = hashCode(`${location.id}-${dateStr}`);
            const dailyVariation = 0.85 + (dateHash % 30) / 100; // 0.85-1.15

            // Calculate daily totals
            const dailySales = baseDailySales * dowMultipliers[dow] * dailyVariation;
            const dailyCovers = Math.round(baseCovers * dowMultipliers[dow] * dailyVariation);

            // Generate hourly forecasts
            for (let hour = 10; hour <= 23; hour++) {
              const hourPct = hourlyPattern[hour] || 0;
              if (hourPct === 0) continue;

              // Add hourly variation
              const hourHash = hashCode(`${location.id}-${dateStr}-${hour}`);
              const hourVariation = 0.90 + (hourHash % 20) / 100; // 0.90-1.10

              const forecastSales = Math.round(dailySales * hourPct * hourVariation * 100) / 100;
              const forecastCovers = Math.max(1, Math.round(dailyCovers * hourPct * hourVariation));

              rows.push({
                location_id: location.id,
                forecast_date: dateStr,
                hour,
                forecast_sales: forecastSales,
                forecast_covers: forecastCovers
              });

              // Insert in batches
              if (rows.length >= batchSize) {
                const { error: insertError } = await supabase
                  .from('forecasts')
                  .upsert(rows, { onConflict: 'location_id,forecast_date,hour', ignoreDuplicates: false });

                if (insertError) {
                  console.error(`Insert error:`, insertError.message);
                } else {
                  totalInserted += rows.length;
                }
                rows.length = 0;
              }
            }
          }
        }

        // Insert remaining rows for this year
        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from('forecasts')
            .upsert(rows, { onConflict: 'location_id,forecast_date,hour', ignoreDuplicates: false });

          if (insertError) {
            console.error(`Insert error:`, insertError.message);
          } else {
            totalInserted += rows.length;
          }
        }

        console.log(`${location.name} ${year}: ${totalInserted} total rows`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      locations: locations.length,
      dateRange: `${startYear}-01-01 to ${endYear}-12-31`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
