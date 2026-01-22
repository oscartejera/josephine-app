import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// =================================================================
// CONFIGURATION: Restaurant parameters
// =================================================================
const CONFIG = {
  // Restaurant setup
  tables: 30,
  partySize: 2.4, // fallback average party size
  
  // Operating hours (Madrid casual dining)
  openDays: [2, 3, 4, 5, 6, 0], // Tue-Sun (1=Monday is closed)
  
  // Service windows
  lunch: { start: '12:30', end: '15:00', minutes: 150 },
  dinner: { start: '19:00', end: '23:00', minutes: 240 },
  closeFinal: '23:30',
  
  // Shift templates (exactly 8h)
  shiftA: { start: '10:00', end: '18:00', label: 'Comida' }, // Lunch + prep + partial close
  shiftB: { start: '15:30', end: '23:30', label: 'Cena' },   // Dinner + prep + final close
  
  // Demand distribution (if no hourly data)
  lunchShare: 0.45,
  dinnerShare: 0.55,
  
  // Dwell time (fallback)
  dwellTimeFallback: 75, // minutes
  
  // Target COL
  targetColPercent: 22,
  
  // Labor constraints
  maxShiftsPerWeek: 5,
  minRestHours: 12,
  shiftDuration: 8,
  
  // Minimum staffing per service (casual dining 30 tables)
  minStaff: {
    lunch: {
      'Cocinero/a': 2,
      'Preparación': 1,
      'Lavaplatos': 0,
      'Camarero/a': 4,
      'Barra': 0,
      'Gerente': 0,
      'Limpieza': 0,
    },
    dinner: {
      'Cocinero/a': 3,
      'Preparación': 0,
      'Lavaplatos': 1,
      'Camarero/a': 5,
      'Barra': 1,
      'Gerente': 1,
      'Limpieza': 1,
    },
  },
};

// =================================================================
// TYPES
// =================================================================
interface GenerateScheduleRequest {
  location_id: string;
  week_start: string; // YYYY-MM-DD
}

interface Employee {
  id: string;
  full_name: string;
  role_name: string;
  hourly_cost: number;
  isOpenShift: boolean;
}

interface ForecastDay {
  date: string;
  forecast_sales: number;
  planned_labor_cost: number;
  planned_labor_hours: number;
}

interface ShiftAssignment {
  employee_id: string;
  role: string;
  shift_template: 'A' | 'B';
  cost: number;
}

interface DayPlan {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  forecastSales: number;
  expectedCovers: number;
  lunchCovers: number;
  dinnerCovers: number;
  turnsLunch: number;
  turnsDinner: number;
  capacityLunch: number;
  capacityDinner: number;
  isHighDemand: boolean;
  staffNeeded: Record<string, { shiftA: number; shiftB: number }>;
  assignments: ShiftAssignment[];
  totalCost: number;
  colPercent: number;
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

// =================================================================
// HELPER FUNCTIONS
// =================================================================

function getDayOfWeek(dateStr: string): number {
  // 0=Sunday, 1=Monday, ..., 6=Saturday
  return new Date(dateStr).getDay();
}

function isClosedDay(dayOfWeek: number): boolean {
  // Monday (1) is closed
  return dayOfWeek === 1;
}

// =================================================================
// MAIN HANDLER
// =================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const warnings: string[] = [];

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
    
    logs.push(`[SCHEDULE] Starting for location ${location_id}, week ${week_start}`);
    
    const weekStartDate = new Date(week_start);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // =========================================================
    // 1. FETCH BASE DATA
    // =========================================================
    
    // 1a. Fetch active employees (exclude OPEN placeholder for now)
    const { data: employeesRaw, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, role_name, hourly_cost')
      .eq('location_id', location_id)
      .eq('active', true);
    
    if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);
    
    // Separate real employees from OPEN placeholders
    const realEmployees: Employee[] = [];
    const openPlaceholders: Employee[] = [];
    
    (employeesRaw || []).forEach(e => {
      const emp: Employee = {
        id: e.id,
        full_name: e.full_name,
        role_name: e.role_name || 'Camarero/a',
        hourly_cost: e.hourly_cost ?? 15.00,
        isOpenShift: e.full_name.startsWith('OPEN -'),
      };
      if (emp.isOpenShift) {
        openPlaceholders.push(emp);
      } else {
        realEmployees.push(emp);
      }
    });
    
    logs.push(`[SCHEDULE] Found ${realEmployees.length} real employees, ${openPlaceholders.length} open placeholders`);
    
    if (realEmployees.length === 0 && openPlaceholders.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active employees found for this location',
          shifts_created: 0,
          days_generated: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 1b. Fetch location settings
    const { data: locationSettings } = await supabase
      .from('location_settings')
      .select('default_hourly_cost, target_col_percent')
      .eq('location_id', location_id)
      .maybeSingle();
    
    const defaultHourlyCost = locationSettings?.default_hourly_cost ?? 15.00;
    const targetColPercent = locationSettings?.target_col_percent ?? CONFIG.targetColPercent;
    
    logs.push(`[SCHEDULE] Target COL%: ${targetColPercent}%, Default hourly cost: €${defaultHourlyCost}`);
    
    // 1c. Fetch forecast metrics for the week
    const { data: forecasts } = await supabase
      .from('forecast_daily_metrics')
      .select('date, forecast_sales, planned_labor_cost, planned_labor_hours')
      .eq('location_id', location_id)
      .gte('date', week_start)
      .lte('date', weekEnd)
      .order('date');
    
    const forecastByDate: Record<string, ForecastDay> = {};
    (forecasts || []).forEach(f => {
      forecastByDate[f.date] = {
        date: f.date,
        forecast_sales: Number(f.forecast_sales) || 0,
        planned_labor_cost: Number(f.planned_labor_cost) || 0,
        planned_labor_hours: Number(f.planned_labor_hours) || 0,
      };
    });
    
    logs.push(`[SCHEDULE] Forecast data for ${Object.keys(forecastByDate).length} days`);
    
    // 1d. Fetch Average Check Size (ACS) - last 28 days
    const today = new Date().toISOString().split('T')[0];
    const acs28Start = new Date();
    acs28Start.setDate(acs28Start.getDate() - 28);
    const acs28StartStr = acs28Start.toISOString().split('T')[0];
    
    const { data: acsData } = await supabase
      .from('tickets')
      .select('net_total, covers')
      .eq('location_id', location_id)
      .eq('status', 'closed')
      .gte('closed_at', acs28StartStr)
      .lt('closed_at', today);
    
    let acs28d = 25.0; // Fallback ACS
    if (acsData && acsData.length > 0) {
      const totalSales = acsData.reduce((s, t) => s + (Number(t.net_total) || 0), 0);
      const totalCovers = acsData.reduce((s, t) => s + (Number(t.covers) || 0), 0);
      if (totalCovers > 0) {
        acs28d = totalSales / totalCovers;
      }
    }
    logs.push(`[SCHEDULE] ACS (28d): €${acs28d.toFixed(2)}`);
    
    // 1e. Fetch Avg Dwell Time - last 7 days (dine-in only)
    const dwell7Start = new Date();
    dwell7Start.setDate(dwell7Start.getDate() - 7);
    const dwell7StartStr = dwell7Start.toISOString().split('T')[0];
    
    const { data: dwellData } = await supabase
      .from('tickets')
      .select('opened_at, closed_at, channel')
      .eq('location_id', location_id)
      .eq('status', 'closed')
      .eq('channel', 'dine-in')
      .gte('closed_at', dwell7StartStr)
      .lt('closed_at', today)
      .not('opened_at', 'is', null)
      .not('closed_at', 'is', null);
    
    let avgDwellTime = CONFIG.dwellTimeFallback;
    if (dwellData && dwellData.length > 0) {
      const validDwells: number[] = [];
      dwellData.forEach(t => {
        if (t.opened_at && t.closed_at) {
          const opened = new Date(t.opened_at).getTime();
          const closed = new Date(t.closed_at).getTime();
          const dwellMinutes = (closed - opened) / 60000;
          // Filter outliers: <10 min or >240 min
          if (dwellMinutes >= 10 && dwellMinutes <= 240) {
            validDwells.push(dwellMinutes);
          }
        }
      });
      if (validDwells.length > 0) {
        avgDwellTime = validDwells.reduce((a, b) => a + b, 0) / validDwells.length;
      }
    }
    logs.push(`[SCHEDULE] Avg Dwell Time (7d): ${avgDwellTime.toFixed(1)} min`);
    
    // 1f. Fetch average party size from tickets (last 28d dine-in)
    const { data: partyData } = await supabase
      .from('tickets')
      .select('covers')
      .eq('location_id', location_id)
      .eq('status', 'closed')
      .eq('channel', 'dine-in')
      .gte('closed_at', acs28StartStr)
      .lt('closed_at', today)
      .gt('covers', 0);
    
    let avgPartySize = CONFIG.partySize;
    if (partyData && partyData.length > 0) {
      const totalCovers = partyData.reduce((s, t) => s + (Number(t.covers) || 0), 0);
      avgPartySize = totalCovers / partyData.length;
    }
    logs.push(`[SCHEDULE] Avg Party Size: ${avgPartySize.toFixed(2)}`);
    
    // =========================================================
    // 2. DELETE EXISTING SHIFTS FOR THIS WEEK
    // =========================================================
    const { error: deleteError } = await supabase
      .from('planned_shifts')
      .delete()
      .eq('location_id', location_id)
      .gte('shift_date', week_start)
      .lte('shift_date', weekEnd)
      .in('status', ['draft', 'published']);
    
    if (deleteError) {
      warnings.push(`Delete existing shifts error: ${deleteError.message}`);
    }
    
    // =========================================================
    // 3. CALCULATE STAFFING NEEDS PER DAY
    // =========================================================
    const dayPlans: DayPlan[] = [];
    
    // Group employees by role
    const employeesByRole: Record<string, Employee[]> = {};
    realEmployees.forEach(emp => {
      if (!employeesByRole[emp.role_name]) {
        employeesByRole[emp.role_name] = [];
      }
      employeesByRole[emp.role_name].push(emp);
    });
    
    // Also track open placeholders by role
    const openByRole: Record<string, Employee> = {};
    openPlaceholders.forEach(emp => {
      // Extract role from "OPEN - Camarero/a"
      const role = emp.role_name;
      if (role) {
        openByRole[role] = emp;
      }
    });
    
    // Calculate table turns based on dwell time
    const turnsLunch = Math.max(1, Math.floor(CONFIG.lunch.minutes / avgDwellTime));
    const turnsDinner = Math.max(1, Math.floor(CONFIG.dinner.minutes / avgDwellTime));
    
    logs.push(`[SCHEDULE] Table turns: Lunch=${turnsLunch}, Dinner=${turnsDinner}`);
    
    // Capacity per service
    const capacityLunch = CONFIG.tables * avgPartySize * turnsLunch;
    const capacityDinner = CONFIG.tables * avgPartySize * turnsDinner;
    
    logs.push(`[SCHEDULE] Capacity: Lunch=${capacityLunch.toFixed(0)} covers, Dinner=${capacityDinner.toFixed(0)} covers`);
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = getDayOfWeek(dateStr);
      const isClosed = isClosedDay(dayOfWeek);
      
      const forecast = forecastByDate[dateStr];
      const forecastSales = forecast?.forecast_sales || 0;
      
      // Calculate expected covers
      const expectedCovers = forecastSales > 0 ? forecastSales / acs28d : 0;
      const lunchCovers = expectedCovers * CONFIG.lunchShare;
      const dinnerCovers = expectedCovers * CONFIG.dinnerShare;
      
      // Determine high demand
      const isHighDemand = lunchCovers > capacityLunch * 0.8 || dinnerCovers > capacityDinner * 0.8;
      
      const plan: DayPlan = {
        date: dateStr,
        dayOfWeek,
        isClosed,
        forecastSales,
        expectedCovers,
        lunchCovers,
        dinnerCovers,
        turnsLunch,
        turnsDinner,
        capacityLunch,
        capacityDinner,
        isHighDemand,
        staffNeeded: {},
        assignments: [],
        totalCost: 0,
        colPercent: 0,
      };
      
      if (!isClosed && forecastSales > 0) {
        // Calculate staff needed per role
        // FOH: Camarero/a based on tables and demand
        const serversLunch = Math.max(
          CONFIG.minStaff.lunch['Camarero/a'],
          Math.ceil(CONFIG.tables / 5) + (lunchCovers > capacityLunch * 0.8 ? 1 : 0)
        );
        const serversDinner = Math.max(
          CONFIG.minStaff.dinner['Camarero/a'],
          Math.ceil(CONFIG.tables / 5) + (dinnerCovers > capacityDinner * 0.8 ? 1 : 0)
        );
        
        // BOH: Cocinero/a based on covers
        const cooksLunch = Math.max(CONFIG.minStaff.lunch['Cocinero/a'], isHighDemand ? 3 : 2);
        const cooksDinner = Math.max(CONFIG.minStaff.dinner['Cocinero/a'], isHighDemand ? 4 : 3);
        
        // Calculate initial staff needs
        plan.staffNeeded = {
          'Cocinero/a': { shiftA: cooksLunch, shiftB: cooksDinner },
          'Preparación': { shiftA: CONFIG.minStaff.lunch['Preparación'], shiftB: isHighDemand ? 1 : 0 },
          'Lavaplatos': { shiftA: isHighDemand ? 1 : 0, shiftB: CONFIG.minStaff.dinner['Lavaplatos'] },
          'Camarero/a': { shiftA: serversLunch, shiftB: serversDinner },
          'Barra': { shiftA: isHighDemand ? 1 : 0, shiftB: CONFIG.minStaff.dinner['Barra'] },
          'Gerente': { shiftA: isHighDemand ? 1 : 0, shiftB: CONFIG.minStaff.dinner['Gerente'] },
          'Limpieza': { shiftA: 0, shiftB: CONFIG.minStaff.dinner['Limpieza'] },
        };
      }
      
      dayPlans.push(plan);
    }
    
    // =========================================================
    // 4. ASSIGN EMPLOYEES TO SHIFTS (with legal constraints)
    // =========================================================
    
    // Track employee assignments across the week
    const employeeWeeklyShifts: Record<string, { count: number; lastEndDate?: string; lastEndTime?: string }> = {};
    realEmployees.forEach(emp => {
      employeeWeeklyShifts[emp.id] = { count: 0 };
    });
    
    // Process each day
    for (const plan of dayPlans) {
      if (plan.isClosed) continue;
      
      // For each role and shift template, assign employees
      for (const [role, needs] of Object.entries(plan.staffNeeded)) {
        for (const shiftTemplate of ['A', 'B'] as const) {
          const needed = shiftTemplate === 'A' ? needs.shiftA : needs.shiftB;
          const shiftConfig = shiftTemplate === 'A' ? CONFIG.shiftA : CONFIG.shiftB;
          
          // Get available employees for this role
          const roleEmployees = employeesByRole[role] || [];
          
          for (let i = 0; i < needed; i++) {
            let assignedEmployee: Employee | null = null;
            
            // Try to find an available real employee
            for (const emp of roleEmployees) {
              const weekData = employeeWeeklyShifts[emp.id];
              if (!weekData) continue;
              
              // Check max shifts per week
              if (weekData.count >= CONFIG.maxShiftsPerWeek) continue;
              
              // Check 12h rest between shifts
              if (weekData.lastEndDate === plan.date) {
                // Same day - already assigned, skip
                continue;
              }
              
              if (weekData.lastEndDate) {
                const lastEnd = new Date(`${weekData.lastEndDate}T${weekData.lastEndTime || '00:00'}`);
                const thisStart = new Date(`${plan.date}T${shiftConfig.start}`);
                const restHours = (thisStart.getTime() - lastEnd.getTime()) / 3600000;
                if (restHours < CONFIG.minRestHours) continue;
              }
              
              assignedEmployee = emp;
              break;
            }
            
            // If no real employee available, use OPEN placeholder
            if (!assignedEmployee) {
              assignedEmployee = openByRole[role] || null;
              if (assignedEmployee) {
                warnings.push(`OPEN SHIFT needed for ${role} on ${plan.date} (${shiftTemplate})`);
              }
            }
            
            if (assignedEmployee) {
              const cost = assignedEmployee.hourly_cost * CONFIG.shiftDuration;
              
              plan.assignments.push({
                employee_id: assignedEmployee.id,
                role,
                shift_template: shiftTemplate,
                cost,
              });
              
              plan.totalCost += cost;
              
              // Update tracking (only for real employees)
              if (!assignedEmployee.isOpenShift && employeeWeeklyShifts[assignedEmployee.id]) {
                employeeWeeklyShifts[assignedEmployee.id].count++;
                employeeWeeklyShifts[assignedEmployee.id].lastEndDate = plan.date;
                employeeWeeklyShifts[assignedEmployee.id].lastEndTime = shiftConfig.end;
                
                // Remove from available pool for this iteration
                const idx = roleEmployees.indexOf(assignedEmployee);
                if (idx > -1) roleEmployees.splice(idx, 1);
              }
            } else {
              warnings.push(`No employee available for ${role} on ${plan.date} (${shiftTemplate})`);
            }
          }
        }
      }
      
      // Calculate COL% for the day
      plan.colPercent = plan.forecastSales > 0 
        ? (plan.totalCost / plan.forecastSales) * 100 
        : 0;
      
      // Optimization: if COL% > target, try to reduce flex roles
      if (plan.colPercent > targetColPercent && plan.forecastSales > 0) {
        // Remove last added non-essential shifts (Preparación extra, second Barra, etc.)
        const flexRoles = ['Preparación', 'Barra'];
        let removed = false;
        
        for (let i = plan.assignments.length - 1; i >= 0 && !removed; i--) {
          const assignment = plan.assignments[i];
          if (flexRoles.includes(assignment.role)) {
            // Check if above minimum
            const roleCount = plan.assignments.filter(a => a.role === assignment.role).length;
            const minNeeded = 
              CONFIG.minStaff.dinner[assignment.role as keyof typeof CONFIG.minStaff.dinner] || 0;
            
            if (roleCount > minNeeded) {
              plan.totalCost -= assignment.cost;
              plan.assignments.splice(i, 1);
              plan.colPercent = (plan.totalCost / plan.forecastSales) * 100;
              removed = true;
              logs.push(`[SCHEDULE] Removed flex ${assignment.role} on ${plan.date} to optimize COL%`);
            }
          }
        }
      }
    }
    
    // =========================================================
    // 5. INSERT SHIFTS INTO DATABASE
    // =========================================================
    const shiftsToInsert: ShiftToInsert[] = [];
    
    for (const plan of dayPlans) {
      for (const assignment of plan.assignments) {
        const shiftConfig = assignment.shift_template === 'A' ? CONFIG.shiftA : CONFIG.shiftB;
        
        shiftsToInsert.push({
          employee_id: assignment.employee_id,
          location_id,
          shift_date: plan.date,
          start_time: shiftConfig.start + ':00',
          end_time: shiftConfig.end + ':00',
          planned_hours: CONFIG.shiftDuration,
          planned_cost: Math.round(assignment.cost * 100) / 100,
          role: assignment.role,
          status: 'draft',
        });
      }
    }
    
    logs.push(`[SCHEDULE] Prepared ${shiftsToInsert.length} shifts to insert`);
    
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
    
    // =========================================================
    // 6. CALCULATE SUMMARY STATISTICS
    // =========================================================
    const totalCost = dayPlans.reduce((s, p) => s + p.totalCost, 0);
    const totalSales = dayPlans.reduce((s, p) => s + p.forecastSales, 0);
    const overallColPercent = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;
    
    // Count shifts by role
    const shiftsByRole: Record<string, number> = {};
    shiftsToInsert.forEach(s => {
      shiftsByRole[s.role] = (shiftsByRole[s.role] || 0) + 1;
    });
    
    logs.push(`[SCHEDULE] Created ${shiftsCreated} shifts successfully`);
    logs.push(`[SCHEDULE] Total Cost: €${totalCost.toFixed(2)}, Forecast Sales: €${totalSales.toFixed(2)}, COL%: ${overallColPercent.toFixed(1)}%`);
    logs.push(`[SCHEDULE] Shifts by role: ${JSON.stringify(shiftsByRole)}`);
    
    // Log all to console
    logs.forEach(l => console.log(l));
    warnings.forEach(w => console.warn(w));
    
    return new Response(
      JSON.stringify({
        success: true,
        shifts_created: shiftsCreated,
        days_generated: dayPlans.filter(p => !p.isClosed).length,
        employees_count: realEmployees.length,
        summary: {
          totalCost: Math.round(totalCost * 100) / 100,
          totalForecastSales: Math.round(totalSales * 100) / 100,
          colPercent: Math.round(overallColPercent * 10) / 10,
          targetColPercent,
          shiftsByRole,
          acs28d: Math.round(acs28d * 100) / 100,
          avgDwellTime: Math.round(avgDwellTime),
          avgPartySize: Math.round(avgPartySize * 100) / 100,
        },
        warnings: warnings.length > 0 ? warnings.slice(0, 20) : undefined,
        logs: logs.slice(0, 30),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[SCHEDULE] Error:', error);
    logs.forEach(l => console.log(l));
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        shifts_created: 0,
        logs,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
