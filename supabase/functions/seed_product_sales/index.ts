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

    // Parse request body for optional parameters
    const body = await req.json().catch(() => ({}));
    const startYear = body.startYear || 2022;
    const endYear = body.endYear || 2026;
    const batchMonths = body.batchMonths || 3; // Process 3 months at a time

    console.log(`Seeding product_sales_daily from ${startYear} to ${endYear}`);

    // Get all products with their locations
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, category, location_id, group_id');

    if (prodError) throw prodError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ error: 'No products found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`Found ${products.length} products`);

    // Get all locations
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('id, group_id');

    if (locError) throw locError;

    // Create location-group map
    const locationGroupMap = new Map(locations?.map(l => [l.id, l.group_id]) || []);

    // Price and cost configuration by category
    const categoryConfig: Record<string, { price: number; costRatio: number; baseUnits: number }> = {
      'Bebidas': { price: 4.50, costRatio: 0.28, baseUnits: 25 },
      'Entrantes': { price: 9.00, costRatio: 0.33, baseUnits: 18 },
      'Principales': { price: 16.00, costRatio: 0.36, baseUnits: 12 },
      'Postres': { price: 7.00, costRatio: 0.30, baseUnits: 8 },
    };

    const defaultConfig = { price: 10.00, costRatio: 0.32, baseUnits: 15 };

    // Simple hash function for deterministic randomness
    const hashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    let totalInserted = 0;
    const batchSize = 500; // Insert 500 rows at a time

    // Process month by month
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip future months
        const now = new Date();
        if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
          continue;
        }

        const daysInMonth = new Date(year, month, 0).getDate();
        const rows: any[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayOfWeek = new Date(year, month - 1, day).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

          for (const product of products) {
            // Skip ~20% of product-days randomly for variation
            const skipHash = hashCode(`${product.id}-${date}-skip`);
            if (skipHash % 5 === 0) continue;

            const config = categoryConfig[product.category] || defaultConfig;
            
            // Calculate units with deterministic variation
            const unitHash = hashCode(`${product.id}-${product.location_id}-${date}`);
            const variation = (unitHash % 40) - 20; // -20 to +20
            let units = config.baseUnits + variation;
            
            // Weekend boost
            if (isWeekend) {
              units = Math.round(units * 1.25);
            }
            
            units = Math.max(1, units);

            // Calculate financials
            const priceVariation = 1 + ((unitHash % 20) - 10) / 100; // ±10%
            const price = config.price * priceVariation;
            const netSales = Math.round(units * price * 0.95 * 100) / 100;
            const cogs = Math.round(units * price * config.costRatio * 100) / 100;

            rows.push({
              product_id: product.id,
              location_id: product.location_id,
              date,
              units_sold: units,
              net_sales: netSales,
              cogs: cogs
            });

            // Insert in batches
            if (rows.length >= batchSize) {
              const { error: insertError } = await supabase
                .from('product_sales_daily')
                .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

              if (insertError) {
                console.error(`Insert error for ${year}-${month}:`, insertError);
              } else {
                totalInserted += rows.length;
              }
              rows.length = 0;
            }
          }
        }

        // Insert remaining rows for this month
        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from('product_sales_daily')
            .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

          if (insertError) {
            console.error(`Insert error for ${year}-${month}:`, insertError);
          } else {
            totalInserted += rows.length;
          }
        }

        console.log(`Completed ${year}-${String(month).padStart(2, '0')}: ${totalInserted} total rows`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      products: products.length,
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
