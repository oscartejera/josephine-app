/**
 * Generate Demo Data - Frontend Implementation
 * Genera datos directamente desde el cliente de Supabase
 * Sin necesidad de Edge Functions
 */

import { supabase } from '@/integrations/supabase/client';

interface SeedProgress {
  step: string;
  progress: number;
  total: number;
  message: string;
}

export async function generateDemoData18Months(
  onProgress?: (progress: SeedProgress) => void
): Promise<{
  success: boolean;
  locations: number;
  employees: number;
  salesRecords: number;
  labourRecords: number;
  message: string;
}> {
  try {
    // ========== PASO 1: Obtener o crear grupo ==========
    onProgress?.({ step: 'group', progress: 1, total: 10, message: 'Verificando grupo...' });
    
    const { data: groups } = await supabase.from('groups').select('id').limit(1);
    let groupId: string;

    if (!groups || groups.length === 0) {
      const { data: newGroup, error } = await supabase
        .from('groups')
        .insert({ name: 'Josephine Restaurant Group' })
        .select('id')
        .single();
      if (error) throw error;
      groupId = newGroup.id;
    } else {
      groupId = groups[0].id;
    }

    // ========== PASO 2: Limpiar datos demo previos ==========
    onProgress?.({ step: 'cleanup', progress: 2, total: 10, message: 'Limpiando datos anteriores...' });

    const { data: existingLocs } = await supabase
      .from('locations')
      .select('id')
      .in('name', ['La Taberna Centro', 'Chamberí', 'Malasaña']);

    if (existingLocs && existingLocs.length > 0) {
      const locIds = existingLocs.map(l => l.id);
      await supabase.from('facts_sales_15m').delete().in('location_id', locIds);
      await supabase.from('facts_labor_daily').delete().in('location_id', locIds);
      await supabase.from('employees').delete().in('location_id', locIds);
      await supabase.from('locations').delete().in('id', locIds);
    }

    // ========== PASO 3: Crear 3 locations ==========
    onProgress?.({ step: 'locations', progress: 3, total: 10, message: 'Creando locations...' });

    const { data: locations, error: locError } = await supabase
      .from('locations')
      .insert([
        { group_id: groupId, name: 'La Taberna Centro', city: 'Salamanca', timezone: 'Europe/Madrid', currency: 'EUR' },
        { group_id: groupId, name: 'Chamberí', city: 'Madrid', timezone: 'Europe/Madrid', currency: 'EUR' },
        { group_id: groupId, name: 'Malasaña', city: 'Madrid', timezone: 'Europe/Madrid', currency: 'EUR' },
      ])
      .select();

    if (locError) throw locError;
    const [locCentro, locChamberi, locMalasana] = locations;

    // ========== PASO 4: Crear empleados ==========
    onProgress?.({ step: 'employees', progress: 4, total: 10, message: 'Creando empleados...' });

    const employees = [
      // La Taberna Centro - 30
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
      // Chamberí - 20
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
      // Malasaña - 20
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

    await supabase.from('employees').insert(employees);

    // ========== PASO 5: Generar sales (30 días optimizado) ==========
    onProgress?.({ step: 'sales', progress: 5, total: 10, message: 'Generando sales data (30 días)...' });

    const salesRecords = [];
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dayOfWeek = currentDate.getDay();

      const baseSales = dayOfWeek === 5 || dayOfWeek === 6 ? 18000 : 
                       dayOfWeek === 2 || dayOfWeek === 3 ? 10000 : 13000;

      // Generar slots cada hora (simplificado para velocidad)
      for (let hour = 10; hour <= 23; hour++) {
        const ts = new Date(currentDate);
        ts.setHours(hour, 0, 0, 0);

        const hourWeight = (hour >= 12 && hour <= 14) ? 1.5 :
                         (hour >= 19 && hour <= 21) ? 1.6 : 0.8;

        const sales = (baseSales / 14) * hourWeight * (0.9 + Math.random() * 0.2);
        const tickets = Math.max(1, Math.floor(sales / 24));

        // 3 locations
        for (const [loc, mult] of [[locCentro, 0.35], [locChamberi, 0.33], [locMalasana, 0.32]] as const) {
          salesRecords.push({
            location_id: loc.id,
            ts_bucket: ts.toISOString(),
            sales_gross: Math.round(sales * mult * 100) / 100,
            sales_net: Math.round(sales * mult * 0.95 * 100) / 100,
            tickets: Math.floor(tickets * mult),
            covers: Math.floor(tickets * mult * 1.2),
          });
        }
      }

      // Progress cada 10 días
      if (dayOffset % 10 === 0) {
        onProgress?.({ 
          step: 'sales', 
          progress: 5 + Math.floor((dayOffset / 30) * 3), 
          total: 10, 
          message: `Generando sales: día ${dayOffset + 1}/30...` 
        });
      }
    }

    // Insert en batches de 500
    for (let i = 0; i < salesRecords.length; i += 500) {
      const batch = salesRecords.slice(i, i + 500);
      const { error } = await supabase.from('facts_sales_15m').insert(batch);
      if (error) throw error;
      
      onProgress?.({ 
        step: 'sales', 
        progress: 6 + Math.floor((i / salesRecords.length) * 2), 
        total: 10, 
        message: `Insertando sales: ${i + batch.length}/${salesRecords.length}...` 
      });
    }

    // ========== PASO 6: Generar labour ==========
    onProgress?.({ step: 'labour', progress: 8, total: 10, message: 'Generando labour data...' });

    const labourRecords = [];
    
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const loc of [locCentro, locChamberi, locMalasana]) {
        // Calcular sales del día
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: daySales } = await supabase
          .from('facts_sales_15m')
          .select('sales_net')
          .eq('location_id', loc.id)
          .gte('ts_bucket', startOfDay.toISOString())
          .lte('ts_bucket', endOfDay.toISOString());

        const totalSales = (daySales || []).reduce((sum, s) => sum + (s.sales_net || 0), 0);

        if (totalSales > 0) {
          const targetCOL = 0.28 + (Math.random() - 0.5) * 0.04;
          const laborCost = totalSales * targetCOL;
          const laborHours = laborCost / 14.5;
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

    const { error: labourError } = await supabase.from('facts_labor_daily').insert(labourRecords);
    if (labourError) throw labourError;

    onProgress?.({ step: 'complete', progress: 10, total: 10, message: '✅ Completado!' });

    return {
      success: true,
      locations: 3,
      employees: employees.length,
      salesRecords: salesRecords.length,
      labourRecords: labourRecords.length,
      message: `✅ ${salesRecords.length} sales records y ${labourRecords.length} labour records generados`
    };

  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}
