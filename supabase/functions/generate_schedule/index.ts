import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GenerateScheduleRequest {
  location_id: string;
  week_start: string; // YYYY-MM-DD
}

interface Employee {
  id: string;
  full_name: string;
  role_name: string | null;
  hourly_cost: number | null;
}

interface ForecastDay {
  date: string;
  forecast_sales: number;
  planned_labor_cost: number;
  planned_labor_hours: number;
}

interface ShiftToInsert {
  employee_id: string;
  location_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  planned_cost: number;
  role: string;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: GenerateScheduleRequest = await req.json();
    const { location_id, week_start } = body;
    
    if (!location_id || !week_start) {
      return new Response(
        JSON.stringify({ error: 'Missing location_id or week_start' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[GENERATE_SCHEDULE] Starting for location ${location_id}, week ${week_start}`);
    
    // Calculate week end (7 days)
    const weekStartDate = new Date(week_start);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // 1. Fetch active employees for this location
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, role_name, hourly_cost')
      .eq('location_id', location_id)
      .eq('active', true);
    
    if (empError) {
      throw new Error(`Failed to fetch employees: ${empError.message}`);
    }
    
    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active employees found for this location',
          shifts_created: 0,
          days_generated: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[GENERATE_SCHEDULE] Found ${employees.length} active employees`);
    
    // 2. Fetch default hourly cost from location_settings
    const { data: locationSettings } = await supabase
      .from('location_settings')
      .select('default_hourly_cost')
      .eq('location_id', location_id)
      .maybeSingle();
    
    const defaultHourlyCost = locationSettings?.default_hourly_cost ?? 12.00;
    
    // 3. Fetch forecast metrics for the week
    const { data: forecasts, error: forecastError } = await supabase
      .from('forecast_daily_metrics')
      .select('date, forecast_sales, planned_labor_cost, planned_labor_hours')
      .eq('location_id', location_id)
      .gte('date', week_start)
      .lte('date', weekEnd)
      .order('date');
    
    if (forecastError) {
      console.warn(`[GENERATE_SCHEDULE] Forecast error: ${forecastError.message}`);
    }
    
    // Build forecast by date map
    const forecastByDate: Record<string, ForecastDay> = {};
    (forecasts || []).forEach(f => {
      forecastByDate[f.date] = f;
    });
    
    console.log(`[GENERATE_SCHEDULE] Forecast data for ${Object.keys(forecastByDate).length} days`);
    
    // 4. Delete existing draft/published shifts for this week/location
    const { error: deleteError } = await supabase
      .from('planned_shifts')
      .delete()
      .eq('location_id', location_id)
      .gte('shift_date', week_start)
      .lte('shift_date', weekEnd)
      .in('status', ['draft', 'published']);
    
    if (deleteError) {
      console.warn(`[GENERATE_SCHEDULE] Delete existing shifts error: ${deleteError.message}`);
    }
    
    // 5. Generate shifts for each day
    const shiftsToInsert: ShiftToInsert[] = [];
    const warnings: string[] = [];
    let employeeIndex = 0; // Round-robin index
    
    // Calculate blended hourly cost
    const employeesWithCost = employees.filter(e => e.hourly_cost !== null);
    const blendedHourlyCost = employeesWithCost.length > 0
      ? employeesWithCost.reduce((sum, e) => sum + (e.hourly_cost || 0), 0) / employeesWithCost.length
      : defaultHourlyCost;
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const forecast = forecastByDate[dateStr];
      let requiredHours = 0;
      
      if (forecast) {
        // Use planned_labor_hours if available, otherwise derive from cost
        if (forecast.planned_labor_hours && forecast.planned_labor_hours > 0) {
          requiredHours = forecast.planned_labor_hours;
        } else if (forecast.planned_labor_cost && forecast.planned_labor_cost > 0) {
          requiredHours = forecast.planned_labor_cost / blendedHourlyCost;
        }
      }
      
      // If no forecast, default to some baseline (e.g., 4 employees * 8h = 32h)
      if (requiredHours === 0) {
        requiredHours = Math.min(employees.length * 8, 32);
        warnings.push(`No forecast for ${dateStr}, using default ${requiredHours}h`);
      }
      
      // Calculate number of 8-hour shifts needed
      const numShifts = Math.ceil(requiredHours / 8);
      
      // Assign shifts round-robin
      for (let s = 0; s < numShifts && s < employees.length; s++) {
        const employee = employees[employeeIndex % employees.length];
        employeeIndex++;
        
        const hourlyCost = employee.hourly_cost ?? defaultHourlyCost;
        const plannedCost = 8 * hourlyCost;
        
        if (employee.hourly_cost === null) {
          warnings.push(`Employee ${employee.full_name} has no hourly_cost, using default ${defaultHourlyCost}`);
        }
        
        shiftsToInsert.push({
          employee_id: employee.id,
          location_id,
          shift_date: dateStr,
          start_time: '09:00:00',
          end_time: '17:00:00',
          planned_hours: 8,
          planned_cost: Math.round(plannedCost * 100) / 100,
          role: employee.role_name || 'Team Member',
          status: 'draft',
        });
      }
    }
    
    console.log(`[GENERATE_SCHEDULE] Prepared ${shiftsToInsert.length} shifts to insert`);
    
    // 6. Insert all shifts
    let shiftsCreated = 0;
    if (shiftsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('planned_shifts')
        .insert(shiftsToInsert)
        .select('id');
      
      if (insertError) {
        throw new Error(`Failed to insert shifts: ${insertError.message}`);
      }
      
      shiftsCreated = inserted?.length || 0;
    }
    
    console.log(`[GENERATE_SCHEDULE] Created ${shiftsCreated} shifts successfully`);
    
    return new Response(
      JSON.stringify({
        success: true,
        shifts_created: shiftsCreated,
        days_generated: 7,
        employees_count: employees.length,
        warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined, // Limit warnings
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[GENERATE_SCHEDULE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        shifts_created: 0 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
