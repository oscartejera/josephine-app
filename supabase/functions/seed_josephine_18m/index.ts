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

    console.log('🌱 Starting 18-month Josephine demo data seed...');
    console.log('📅 Period: 2025-01-01 to 2026-06-30');

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

    // ========== PASO 2: Limpiar datos demo previos ==========
    const { data: existingLocs } = await supabase
      .from('locations')
      .select('id')
      .in('name', ['La Taberna Centro', 'Chamberí', 'Malasaña']);

    if (existingLocs && existingLocs.length > 0) {
      const locIds = existingLocs.map(l => l.id);
      console.log('🧹 Cleaning existing demo data...');
      await supabase.from('facts_item_mix_daily').delete().in('location_id', locIds);
      await supabase.from('facts_labor_daily').delete().in('location_id', locIds);
      await supabase.from('facts_sales_15m').delete().in('location_id', locIds);
      await supabase.from('employees').delete().in('location_id', locIds);
      await supabase.from('cdm_items').delete().in('location_id', locIds);
      await supabase.from('locations').delete().in('id', locIds);
    }

    // ========== PASO 3: Crear 3 locations ==========
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

    // ========== PASO 4: Crear empleados (70 totales) ==========
    const employees = [
      // La Taberna Centro - 30 employees
      ...Array.from({ length: 8 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Carlos García ${i > 0 ? i + 1 : ''}`.trim(), role_name: 'Chef', hourly_cost: 18.00, active: true 
      })),
      ...Array.from({ length: 12 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Sara Gómez ${i > 0 ? i + 1 : ''}`.trim(), role_name: 'Server', hourly_cost: 12.00, active: true 
      })),
      ...Array.from({ length: 5 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Manuel Rubio ${i > 0 ? i + 1 : ''}`.trim(), role_name: 'Bartender', hourly_cost: 14.00, active: true 
      })),
      ...Array.from({ length: 3 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Beatriz Cruz ${i > 0 ? i + 1 : ''}`.trim(), role_name: 'Host', hourly_cost: 11.00, active: true 
      })),
      ...Array.from({ length: 2 }, (_, i) => ({ 
        location_id: locCentro.id, full_name: `Fernando Iglesias ${i > 0 ? i + 1 : ''}`.trim(), role_name: 'Manager', hourly_cost: 25.00, active: true 
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

    // ========== PASO 5: Generar facts_sales_15m (18 meses) ==========
    console.log('📊 Generating sales data (18 months)...');
    
    const salesRecords = [];
    const startDate = new Date('2025-01-01T10:00:00Z');
    const today = new Date('2026-02-04T23:59:59Z');
    const forecastEnd = new Date('2026-06-30T23:59:59Z');

    // Helper: Calcular si es día con actual o solo forecast
    const hasActuals = (date: Date) => date <= today;

    // Helper: Growth rate mensual (2025 → 2026 +15% YoY)
    const getGrowthMultiplier = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (year === 2025) return 1.0; // Baseline
      if (year === 2026) return 1.15; // +15% YoY
      return 1.0;
    };

    // Helper: Estacionalidad por mes
    const getSeasonalMultiplier = (date: Date) => {
      const month = date.getMonth(); // 0=Jan, 11=Dec
      // Verano (Jun-Aug): +20%, Invierno (Dec-Feb): -10%, Resto: normal
      if (month >= 5 && month <= 7) return 1.2; // Verano alto
      if (month === 11 || month <= 1) return 0.9; // Invierno bajo
      if (month === 3 || month === 4) return 1.1; // Primavera medio-alto
      return 1.0; // Resto normal
    };

    let currentDate = new Date(startDate);
    let recordCount = 0;

    while (currentDate <= forecastEnd) {
      const dayOfWeek = currentDate.getDay();
      const isActualData = hasActuals(currentDate);
      const growthMult = getGrowthMultiplier(currentDate);
      const seasonalMult = getSeasonalMultiplier(currentDate);

      // Base sales por día de semana
      const baseDailySales = (dayOfWeek === 5 || dayOfWeek === 6 ? 18000 : 
                             dayOfWeek === 0 ? 16000 :
                             dayOfWeek === 2 || dayOfWeek === 3 ? 10000 : 13000);
      
      const adjustedDailySales = baseDailySales * growthMult * seasonalMult;

      // Generar slots cada 15min (10:00 - 23:00)
      for (let hour = 10; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const ts = new Date(currentDate);
          ts.setHours(hour, minute, 0, 0);

          if (ts > forecastEnd) break;

          // Peak hours weight
          const hourWeight = (hour >= 12 && hour <= 14) ? 1.5 :
                           (hour >= 19 && hour <= 21) ? 1.6 :
                           (hour === 10 || hour === 11 || hour === 22 || hour === 23) ? 0.4 : 0.8;

          const sales15m = (adjustedDailySales / 52) * hourWeight;
          
          // Si es actual data, agregar variación random
          const actualSales = isActualData ? sales15m * (0.9 + Math.random() * 0.2) : sales15m;
          const tickets = Math.max(1, Math.floor(actualSales / 24));
          const covers = Math.max(1, Math.floor(tickets * 1.2));

          // 3 locations con multipliers
          for (const [loc, locMult, locName] of [
            [locCentro, 1.1, 'Centro'],
            [locChamberi, 1.0, 'Chamberí'],
            [locMalasana, 0.9, 'Malasaña']
          ] as const) {
            salesRecords.push({
              location_id: loc.id,
              ts_bucket: ts.toISOString(),
              sales_gross: Math.round(actualSales * locMult * 100) / 100,
              sales_net: Math.round(actualSales * locMult * 0.95 * 100) / 100,
              tickets: Math.floor(tickets * locMult),
              covers: Math.floor(covers * locMult),
            });

            recordCount++;
            
            // Log progress cada 10k registros
            if (recordCount % 10000 === 0) {
              console.log(`📈 Generated ${recordCount} sales records...`);
            }
          }
        }
      }

      // Siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ Total sales records to insert: ${salesRecords.length}`);

    // Insert en batches de 1000 (para no sobrecargar)
    for (let i = 0; i < salesRecords.length; i += 1000) {
      const batch = salesRecords.slice(i, i + 1000);
      const { error } = await supabase.from('facts_sales_15m').insert(batch);
      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / 1000)}:`, error);
        throw error;
      }
      console.log(`✅ Batch ${Math.floor(i / 1000) + 1}/${Math.ceil(salesRecords.length / 1000)} inserted`);
    }

    // ========== PASO 6: Generar facts_labor_daily (18 meses) ==========
    console.log('👷 Generating labour data (18 months)...');
    
    const labourRecords = [];
    currentDate = new Date('2025-01-01');

    while (currentDate <= forecastEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isActualData = hasActuals(currentDate);

      for (const loc of [locCentro, locChamberi, locMalasana]) {
        // Sumar sales del día
        const startOfDay = `${dateStr}T00:00:00Z`;
        const endOfDay = `${dateStr}T23:59:59Z`;

        const { data: daySales } = await supabase
          .from('facts_sales_15m')
          .select('sales_net')
          .eq('location_id', loc.id)
          .gte('ts_bucket', startOfDay)
          .lte('ts_bucket', endOfDay);

        const totalSalesDay = (daySales || []).reduce((sum, s) => sum + (s.sales_net || 0), 0);
        
        if (totalSalesDay > 0) {
          // COL% target 28% con variación realista
          const targetCOL = 0.28;
          const actualCOL = isActualData ? (0.28 + (Math.random() - 0.5) * 0.06) : 0.28; // Actuals: 25-31%, Forecast: 28%
          
          const scheduledLaborCost = totalSalesDay * targetCOL;
          const actualLaborCost = isActualData ? totalSalesDay * actualCOL : scheduledLaborCost;
          
          const scheduledHours = scheduledLaborCost / 14.5;
          const actualHours = isActualData ? actualLaborCost / 14.5 : scheduledHours;

          labourRecords.push({
            location_id: loc.id,
            day: dateStr,
            scheduled_hours: Math.round(scheduledHours * 10) / 10,
            actual_hours: isActualData ? Math.round(actualHours * 10) / 10 : Math.round(scheduledHours * 10) / 10,
            labor_cost_est: Math.round(actualLaborCost * 100) / 100,
            overtime_hours: isActualData ? Math.max(0, Math.round((actualHours - scheduledHours) * 10) / 10) : 0,
          });
        }
      }

      // Log progress cada 90 días
      if (labourRecords.length % 270 === 0) {
        console.log(`👷 Generated ${labourRecords.length} labour records...`);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ Total labour records to insert: ${labourRecords.length}`);

    // Insert labour en batches
    for (let i = 0; i < labourRecords.length; i += 500) {
      const batch = labourRecords.slice(i, i + 500);
      const { error } = await supabase.from('facts_labor_daily').insert(batch);
      if (error) {
        console.error(`❌ Error inserting labour batch:`, error);
        throw error;
      }
      console.log(`✅ Labour batch ${Math.floor(i / 500) + 1}/${Math.ceil(labourRecords.length / 500)} inserted`);
    }

    // ========== PASO 7: Crear items ==========
    const items = [
      { org_id: groupId, location_id: locCentro.id, name: 'Paella Valenciana', category_name: 'Food', unit_price: 24.50, cost_price: 8.20, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Jamón Ibérico', category_name: 'Food', unit_price: 18.90, cost_price: 11.40, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Chuletón de Buey', category_name: 'Food', unit_price: 38.50, cost_price: 19.20, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Pulpo a la Gallega', category_name: 'Food', unit_price: 22.80, cost_price: 9.10, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Bacalao Pil-Pil', category_name: 'Food', unit_price: 26.50, cost_price: 10.60, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Cochinillo Asado', category_name: 'Food', unit_price: 35.00, cost_price: 14.00, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Tortilla Española', category_name: 'Food', unit_price: 8.50, cost_price: 2.80, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Croquetas Premium', category_name: 'Food', unit_price: 12.50, cost_price: 4.20, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Rioja Reserva', category_name: 'Beverage', unit_price: 28.00, cost_price: 9.50, active: true },
      { org_id: groupId, location_id: locCentro.id, name: 'Cerveza Alhambra', category_name: 'Beverage', unit_price: 4.50, cost_price: 1.20, active: true },
    ];

    const { error: itemsError } = await supabase.from('cdm_items').insert(items);
    if (itemsError) console.error('Items error:', itemsError);
    console.log('✅ Items created:', items.length);

    // ========== RESUMEN FINAL ==========
    const { count: salesCount } = await supabase
      .from('facts_sales_15m')
      .select('*', { count: 'exact', head: true })
      .in('location_id', [locCentro.id, locChamberi.id, locMalasana.id]);

    const { count: labourCount } = await supabase
      .from('facts_labor_daily')
      .select('*', { count: 'exact', head: true })
      .in('location_id', [locCentro.id, locChamberi.id, locMalasana.id]);

    const summary = {
      success: true,
      period: '2025-01-01 to 2026-06-30 (18 months)',
      locations: 3,
      employees: employees.length,
      items: items.length,
      salesRecords: salesCount || 0,
      labourRecords: labourCount || 0,
      breakdown: {
        historical_2025: '12 months with actuals',
        current_2026_jan_feb: '2 months with actuals',
        forecast_2026_mar_jun: '4 months planned/forecast only'
      },
      features: [
        'YoY comparisons enabled (2025 vs 2026)',
        'Seasonal patterns (summer high, winter low)',
        'Growth trend +15% YoY',
        'COL% realistic variance 25-31%',
        'Labour hours coherent with sales'
      ],
      message: `🎉 18-month demo data seeded successfully!`
    };

    console.log('🎉 Seed completed:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Seed error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
