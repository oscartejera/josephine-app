import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { days = 30 } = await req.json().catch(() => ({ days: 30 }));

    console.log('🌱 Starting Josephine demo data seed...');

    // ========== PASO 1: Obtener o crear grupo ==========
    let groupId: string;
    const { data: groups } = await supabase.from('groups').select('id').limit(1);
    
    if (groups && groups.length > 0) {
      groupId = groups[0].id;
    } else {
      const { data: newGroup, error } = await supabase
        .from('groups')
        .insert({ name: 'Josephine Restaurant Group' })
        .select('id')
        .single();
      if (error) throw error;
      groupId = newGroup.id;
    }

    console.log('✅ Group ID:', groupId);

    // ========== PASO 2: Crear 3 locations ==========
    // Limpiar locations demo previas
    const { data: existingLocs } = await supabase
      .from('locations')
      .select('id')
      .in('name', ['La Taberna Centro', 'Chamberí', 'Malasaña']);

    if (existingLocs && existingLocs.length > 0) {
      const locIds = existingLocs.map(l => l.id);
      await supabase.from('daily_sales').delete().in('location_id', locIds);
      await supabase.from('facts_sales_15m').delete().in('location_id', locIds);
      await supabase.from('facts_labor_daily').delete().in('location_id', locIds);
      await supabase.from('employees').delete().in('location_id', locIds);
      await supabase.from('cdm_items').delete().eq('org_id', groupId);
      await supabase.from('locations').delete().in('id', locIds);
    }

    const { data: locations, error: locError } = await supabase
      .from('locations')
      .insert([
        { group_id: groupId, name: 'La Taberna Centro', city: 'Salamanca', timezone: 'Europe/Madrid', currency: 'EUR' },
        { group_id: groupId, name: 'Chamberí', city: 'Madrid', timezone: 'Europe/Madrid', currency: 'EUR' },
        { group_id: groupId, name: 'Malasaña', city: 'Madrid', timezone: 'Europe/Madrid', currency: 'EUR' },
      ])
      .select();

    if (locError) throw locError;
    console.log('✅ Locations created:', locations.length);

    const [locCentro, locChamberi, locMalasana] = locations;

    // ========== PASO 3: Crear empleados ==========
    const employees = [
      // La Taberna Centro - 30 employees
      ...Array.from({ length: 8 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Chef ${i + 1}`, role_name: 'Chef', hourly_cost: 18.00, active: true 
      })),
      ...Array.from({ length: 12 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Server ${i + 1}`, role_name: 'Server', hourly_cost: 12.00, active: true 
      })),
      ...Array.from({ length: 5 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Bartender ${i + 1}`, role_name: 'Bartender', hourly_cost: 14.00, active: true 
      })),
      ...Array.from({ length: 3 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Host ${i + 1}`, role_name: 'Host', hourly_cost: 11.00, active: true 
      })),
      ...Array.from({ length: 2 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Manager ${i + 1}`, role_name: 'Manager', hourly_cost: 25.00, active: true 
      })),
      // Chamberí - 20 employees
      ...Array.from({ length: 5 }, (_, i) => ({ 
        location_id: locChamberi.id, full_name: `Chef CH${i + 1}`, role_name: 'Chef', hourly_cost: 18.00, active: true 
      })),
      ...Array.from({ length: 10 }, (_, i) => ({ 
        location_id: locChamberi.id, full_name: `Server CH${i + 1}`, role_name: 'Server', hourly_cost: 12.00, active: true 
      })),
      ...Array.from({ length: 3 }, (_, i) => ({ 
        location_id: locChamberi.id, full_name: `Bartender CH${i + 1}`, role_name: 'Bartender', hourly_cost: 14.00, active: true 
      })),
      ...Array.from({ length: 2 }, (_, i) => ({ 
        location_id: locChamberi.id, full_name: `Manager CH${i + 1}`, role_name: 'Manager', hourly_cost: 25.00, active: true 
      })),
      // Malasaña - 20 employees
      ...Array.from({ length: 5 }, (_, i) => ({ 
        location_id: locMalasana.id, full_name: `Chef ML${i + 1}`, role_name: 'Chef', hourly_cost: 18.00, active: true 
      })),
      ...Array.from({ length: 10 }, (_, i) => ({ 
        location_id: locMalasana.id, full_name: `Server ML${i + 1}`, role_name: 'Server', hourly_cost: 12.00, active: true 
      })),
      ...Array.from({ length: 3 }, (_, i) => ({ 
        location_id: locMalasana.id, full_name: `Bartender ML${i + 1}`, role_name: 'Bartender', hourly_cost: 14.00, active: true 
      })),
      ...Array.from({ length: 2 }, (_, i) => ({ 
        location_id: locMalasana.id, full_name: `Manager ML${i + 1}`, role_name: 'Manager', hourly_cost: 25.00, active: true 
      })),
    ];

    const { error: empError } = await supabase.from('employees').insert(employees);
    if (empError) throw empError;
    console.log('✅ Employees created:', employees.length);

    // ========== PASO 4: Crear productos ==========
    const items = [
      { org_id: groupId, name: 'Paella Valenciana', category_name: 'Food', price: 24.50, is_active: true, external_provider: 'demo', external_id: 'demo-paella-valenciana' },
      { org_id: groupId, name: 'Jamón Ibérico', category_name: 'Food', price: 18.90, is_active: true, external_provider: 'demo', external_id: 'demo-jamon-iberico' },
      { org_id: groupId, name: 'Chuletón de Buey', category_name: 'Food', price: 38.50, is_active: true, external_provider: 'demo', external_id: 'demo-chuleton-buey' },
      { org_id: groupId, name: 'Pulpo a la Gallega', category_name: 'Food', price: 22.80, is_active: true, external_provider: 'demo', external_id: 'demo-pulpo-gallega' },
      { org_id: groupId, name: 'Rioja Reserva', category_name: 'Beverage', price: 28.00, is_active: true, external_provider: 'demo', external_id: 'demo-rioja-reserva' },
    ];

    const { error: itemsError } = await supabase.from('cdm_items').insert(items);
    if (itemsError) console.error('Items error:', itemsError);
    console.log('✅ Items created:', items.length);

    // ========== PASO 5: Generar facts_sales_15m + daily_sales ==========
    const salesRecords = [];
    const now = new Date();
    
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const currentDate = new Date(now);
      currentDate.setDate(currentDate.getDate() - dayOffset);
      const dayOfWeek = currentDate.getDay();

      // Base sales per day of week (realistic casual dining Madrid, per location)
      const baseSales = dayOfWeek === 5 || dayOfWeek === 6 ? 7000 :
                       dayOfWeek === 2 || dayOfWeek === 3 ? 4000 : 5000;

      // Generar slots cada 15min (10:00 - 23:00)
      for (let hour = 10; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const ts = new Date(currentDate);
          ts.setHours(hour, minute, 0, 0);

          // Peak hours weight
          const hourWeight = (hour >= 12 && hour <= 14) ? 1.5 :
                           (hour >= 19 && hour <= 21) ? 1.6 :
                           (hour === 10 || hour === 11 || hour === 22 || hour === 23) ? 0.4 : 0.8;

          const sales15m = (baseSales / 52) * hourWeight * (0.9 + Math.random() * 0.2);
          const tickets = Math.max(1, Math.floor(sales15m / 24));
          const covers = Math.max(1, Math.floor(tickets * 1.2));

          // 3 locations
          for (const loc of [locCentro, locChamberi, locMalasana]) {
            const locMultiplier = loc.name === 'La Taberna Centro' ? 1.1 :
                                 loc.name === 'Chamberí' ? 1.0 : 0.9;

            salesRecords.push({
              location_id: loc.id,
              ts_bucket: ts.toISOString(),
              sales_gross: Math.round(sales15m * locMultiplier * 100) / 100,
              sales_net: Math.round(sales15m * locMultiplier * 0.95 * 100) / 100,
              tickets: Math.floor(tickets * locMultiplier),
              covers: Math.floor(covers * locMultiplier),
            });
          }
        }
      }
    }

    // Insert en batches de 1000
    for (let i = 0; i < salesRecords.length; i += 1000) {
      const batch = salesRecords.slice(i, i + 1000);
      const { error } = await supabase.from('facts_sales_15m').insert(batch);
      if (error) {
        console.error('Error inserting sales batch', i, error);
        throw error;
      }
      console.log(`✅ Sales batch ${i / 1000 + 1} inserted (${batch.length} records)`);
    }

    console.log('✅ Total sales records:', salesRecords.length);

    // ========== PASO 5b: Agregar facts_sales_15m → daily_sales ==========
    // The dashboard reads from sales_daily_unified which uses daily_sales.
    // Aggregate the 15-min granular data into daily rows.
    const dailyMap = new Map<string, {
      org_id: string; location_id: string; day: string;
      net_sales: number; gross_sales: number; orders_count: number;
      payments_total: number;
    }>();

    for (const r of salesRecords) {
      const day = r.ts_bucket.split('T')[0];
      const key = `${r.location_id}|${day}`;
      const existing = dailyMap.get(key);
      if (existing) {
        existing.net_sales += r.sales_net;
        existing.gross_sales += r.sales_gross;
        existing.orders_count += r.tickets;
        existing.payments_total += r.sales_net;
      } else {
        dailyMap.set(key, {
          org_id: groupId,
          location_id: r.location_id,
          day,
          net_sales: r.sales_net,
          gross_sales: r.sales_gross,
          orders_count: r.tickets,
          payments_total: r.sales_net,
        });
      }
    }

    const dailyRows = Array.from(dailyMap.values()).map(d => ({
      org_id: d.org_id,
      location_id: d.location_id,
      day: d.day,
      net_sales: Math.round(d.net_sales * 100) / 100,
      gross_sales: Math.round(d.gross_sales * 100) / 100,
      orders_count: d.orders_count,
      payments_total: Math.round(d.payments_total * 100) / 100,
      payments_cash: Math.round(d.payments_total * 0.25 * 100) / 100,
      payments_card: Math.round(d.payments_total * 0.75 * 100) / 100,
      refunds: Math.round(d.net_sales * 0.005 * 100) / 100,
      discounts: Math.round(d.net_sales * 0.03 * 100) / 100,
      comps: Math.round(d.net_sales * 0.01 * 100) / 100,
      voids: Math.round(d.net_sales * 0.002 * 100) / 100,
    }));

    for (let i = 0; i < dailyRows.length; i += 200) {
      const batch = dailyRows.slice(i, i + 200);
      const { error } = await supabase.from('daily_sales').upsert(batch, {
        onConflict: 'location_id,day',
        ignoreDuplicates: false,
      });
      if (error) {
        console.error('Error inserting daily_sales batch', i, error);
      }
    }
    console.log('✅ daily_sales aggregated rows:', dailyRows.length);

    // ========== PASO 6: Generar facts_labor_daily ==========
    // Agregar sales por día y calcular labour coherente
    const { data: dailySales } = await supabase
      .rpc('generate_labour_from_sales', { p_days: days })
      .then(() => ({ data: 'ok' }))
      .catch(async () => {
        // Fallback: calcular labour directamente
        const labourRecords = [];
        
        for (let dayOffset = 0; dayOffset < days; dayOffset++) {
          const currentDate = new Date(now);
          currentDate.setDate(currentDate.getDate() - dayOffset);
          const dateStr = currentDate.toISOString().split('T')[0];

          for (const loc of [locCentro, locChamberi, locMalasana]) {
            // Sumar sales del día
            const { data: daySales } = await supabase
              .from('facts_sales_15m')
              .select('sales_net')
              .eq('location_id', loc.id)
              .gte('ts_bucket', `${dateStr}T00:00:00Z`)
              .lt('ts_bucket', `${dateStr}T23:59:59Z`);

            const totalSales = (daySales || []).reduce((sum, s) => sum + (s.sales_net || 0), 0);
            
            if (totalSales > 0) {
              const targetCOL = 0.28 + (Math.random() - 0.5) * 0.04; // 26-30%
              const laborCost = totalSales * targetCOL;
              const laborHours = laborCost / 14.5; // €14.5 avg wage
              const scheduledHours = laborHours * 0.95;

              labourRecords.push({
                location_id: loc.id,
                day: dateStr,
                scheduled_hours: Math.round(scheduledHours * 10) / 10,
                actual_hours: Math.round(laborHours * 10) / 10,
                labor_cost_est: Math.round(laborCost * 100) / 100,
                overtime_hours: Math.max(0, Math.round((laborHours - scheduledHours) * 10) / 10),
              });
            }
          }
        }

        // Insert labour records
        const { error: labourError } = await supabase.from('facts_labor_daily').insert(labourRecords);
        if (labourError) throw labourError;
        
        console.log('✅ Labour records created:', labourRecords.length);
        return { data: labourRecords.length };
      });

    // ========== RESUMEN ==========
    const { count: salesCount } = await supabase
      .from('facts_sales_15m')
      .select('*', { count: 'exact', head: true });

    const { count: labourCount } = await supabase
      .from('facts_labor_daily')
      .select('*', { count: 'exact', head: true });

    const { count: employeesCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    const summary = {
      success: true,
      locations: 3,
      employees: employeesCount || 0,
      items: items.length,
      salesRecords: salesCount || 0,
      labourRecords: labourCount || 0,
      daysGenerated: days,
      message: `✅ Demo data seeded: ${salesCount} sales records, ${labourCount} labour records, ${employeesCount} employees`
    };

    console.log('🎉 Seed completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Seed error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
