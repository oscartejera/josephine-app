import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// =================================================================
// NORY-STYLE SCHEDULING v3
// - Uses employee contracts (weekly_hours) for max shift limits
// - Hourly demand curve for dynamic staffing
// - OPLH-based staff calculation (not hardcoded templates)
// - Budget optimization with redistribution
// - Availability/time-off awareness
// =================================================================

// Shift windows — determined dynamically but these are the possible types
const SHIFT_WINDOWS: Record<string, { start: string; end: string; hours: number }> = {
  APERTURA:  { start: '09:00', end: '14:00', hours: 5 },
  COMIDA:    { start: '11:00', end: '16:00', hours: 5 },
  JORNADA:   { start: '10:00', end: '18:00', hours: 8 },
  TARDE:     { start: '16:00', end: '23:00', hours: 7 },
  CENA:      { start: '18:00', end: '23:00', hours: 5 },
  CIERRE:    { start: '20:00', end: '00:30', hours: 4.5 },
};

// Hourly demand curve for a Madrid casual dining restaurant (% of daily sales per hour)
const HOURLY_DEMAND_CURVE: Record<number, number> = {
  9: 0.01, 10: 0.02, 11: 0.04, 12: 0.07,
  13: 0.14, 14: 0.15, 15: 0.08, 16: 0.03,
  17: 0.03, 18: 0.04, 19: 0.05, 20: 0.10,
  21: 0.12, 22: 0.09, 23: 0.03,
};

// OPLH targets by role (orders one person can handle per hour)
const OPLH_TARGETS: Record<string, number> = {
  Chef: 12,        // 1 chef per 12 covers/hour
  Server: 16,      // 1 server per 16 covers/hour
  Bartender: 25,   // 1 bartender per 25 covers/hour
  Host: 40,        // 1 host per 40 covers/hour (greeting/seating)
  Manager: 999,    // Managers scheduled based on shift coverage, not OPLH
};

// Which shift windows each role can work
const ROLE_SHIFT_MAP: Record<string, string[]> = {
  Chef:      ['APERTURA', 'JORNADA', 'COMIDA', 'CENA', 'TARDE'],
  Server:    ['COMIDA', 'CENA', 'JORNADA', 'TARDE'],
  Bartender: ['COMIDA', 'TARDE', 'CENA'],
  Host:      ['COMIDA', 'CENA'],
  Manager:   ['JORNADA', 'CENA'],
};

const CONFIG = {
  defaultTargetColPercent: 32,
  defaultHourlyCost: 14.5,
  defaultACS: 25,          // Average Check Size €
  minRestHours: 10,        // Spain hospitality collective agreement allows 10h
  maxHoursPerDay: 10,
};

// =================================================================
// TYPES
// =================================================================
interface Employee {
  id: string;
  full_name: string;
  role_name: string;
  hourly_cost: number;
  weekly_hours: number;    // From employee_payroll
  contract_type: string;   // indefinido, temporal
  max_shifts: number;      // Derived: weekly_hours / avg_shift_duration
}

interface Slot {
  date: string;
  shiftType: string;
  role: string;
  startTime: string;
  endTime: string;
  hours: number;
}

interface EmpState {
  shiftsCount: number;
  totalHours: number;
  workingDays: Set<string>;
  lastShiftDate: string;
  lastShiftEnd: string;
  shiftVariety: Record<string, number>;
}

// =================================================================
// HELPERS
// =================================================================
function shuffleArray<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function shiftsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let aS = toMin(aStart), aE = toMin(aEnd), bS = toMin(bStart), bE = toMin(bEnd);
  if (aE <= aS) aE += 24 * 60;
  if (bE <= bS) bE += 24 * 60;
  return aS < bE && bS < aE;
}

/** Calculate staff needed per role from hourly demand curve (OPLH-based) */
function calculateStaffNeeds(
  dailySales: number,
  acs: number,
): Record<string, Record<string, number>> {
  const dailyCovers = dailySales / acs;

  // Calculate peak covers for lunch (12-15) and dinner (19-23)
  const lunchPct = [12, 13, 14, 15].reduce((s, h) => s + (HOURLY_DEMAND_CURVE[h] || 0), 0);
  const dinnerPct = [19, 20, 21, 22, 23].reduce((s, h) => s + (HOURLY_DEMAND_CURVE[h] || 0), 0);
  const lunchPeakCoversPerHour = dailyCovers * Math.max(...[13, 14].map(h => HOURLY_DEMAND_CURVE[h] || 0));
  const dinnerPeakCoversPerHour = dailyCovers * Math.max(...[21, 22].map(h => HOURLY_DEMAND_CURVE[h] || 0));

  const needs: Record<string, Record<string, number>> = {};

  for (const [role, oplh] of Object.entries(OPLH_TARGETS)) {
    needs[role] = {};

    if (role === 'Manager') {
      // 1 Manager full day always, +1 CENA on busy days
      needs[role]['JORNADA'] = 1;
      if (dinnerPeakCoversPerHour > 15) needs[role]['CENA'] = 1;
      continue;
    }

    // Calculate staff for each service period
    const lunchStaff = Math.max(1, Math.ceil(lunchPeakCoversPerHour / oplh));
    const dinnerStaff = Math.max(1, Math.ceil(dinnerPeakCoversPerHour / oplh));

    if (role === 'Chef') {
      // 1 APERTURA (prep), lunch COMIDA, dinner CENA
      needs[role]['APERTURA'] = 1;
      needs[role]['COMIDA'] = Math.max(1, lunchStaff - 1); // -1 because apertura covers into lunch
      needs[role]['CENA'] = dinnerStaff;
    } else if (role === 'Host') {
      // Hosts only during service
      if (lunchStaff >= 2) needs[role]['COMIDA'] = 1;
      needs[role]['CENA'] = 1;
    } else if (role === 'Bartender') {
      // Bar opens for lunch on busy days, always for dinner
      if (lunchStaff >= 2) needs[role]['COMIDA'] = 1;
      needs[role]['TARDE'] = 1;
    } else {
      // Server: COMIDA shifts + CENA shifts (+ JORNADA for 1 senior on busy days)
      needs[role]['COMIDA'] = lunchStaff;
      needs[role]['CENA'] = dinnerStaff;
      // On busy days, add 1 JORNADA server for full coverage
      if (lunchStaff >= 3 && dinnerStaff >= 3) {
        needs[role]['JORNADA'] = 1;
        // Reduce COMIDA by 1 since JORNADA covers lunch
        needs[role]['COMIDA'] = Math.max(1, lunchStaff - 1);
      }
    }
  }

  return needs;
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
    const { location_id, week_start } = await req.json();

    if (!location_id || !week_start) {
      return new Response(
        JSON.stringify({ error: 'Missing location_id or week_start' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logs.push(`[SCHEDULE] v3 — Starting for location ${location_id}, week ${week_start}`);

    const weekStartDate = new Date(week_start + 'T00:00:00Z');
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    // =========================================================
    // 1. FETCH ALL DATA (employees + payroll + contracts + forecast + settings)
    // =========================================================

    // 1a. Employees with payroll data (LEFT JOIN via separate query)
    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, full_name, role_name, hourly_cost')
      .eq('location_id', location_id)
      .eq('active', true);

    const { data: payrollRaw } = await supabase
      .from('employee_payroll')
      .select('employee_id, weekly_hours, contract_type')
      .eq('location_id', location_id);

    const payrollMap: Record<string, { weekly_hours: number; contract_type: string }> = {};
    (payrollRaw || []).forEach((p: any) => {
      payrollMap[p.employee_id] = { weekly_hours: p.weekly_hours, contract_type: p.contract_type };
    });

    const employees: Employee[] = (employeesRaw || [])
      .filter((e: any) => !e.full_name.startsWith('OPEN -'))
      .map((e: any) => {
        const payroll = payrollMap[e.id];
        const weeklyHours = payroll?.weekly_hours ?? 40;
        const avgShiftHours = 6.5; // average across shift types
        return {
          id: e.id,
          full_name: e.full_name,
          role_name: e.role_name || 'Server',
          hourly_cost: e.hourly_cost ?? CONFIG.defaultHourlyCost,
          weekly_hours: weeklyHours,
          contract_type: payroll?.contract_type ?? 'indefinido',
          max_shifts: Math.min(6, Math.ceil(weeklyHours / avgShiftHours)),
        };
      });

    if (employees.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No employees found', shifts_created: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const employeesByRole: Record<string, Employee[]> = {};
    employees.forEach(emp => {
      if (!employeesByRole[emp.role_name]) employeesByRole[emp.role_name] = [];
      employeesByRole[emp.role_name].push(emp);
    });

    const avgHourlyCost = employees.reduce((s, e) => s + e.hourly_cost, 0) / employees.length;

    logs.push(`[SCHEDULE] ${employees.length} employees. Roles: ${Object.entries(employeesByRole).map(([r, e]) => `${r}(${e.length})`).join(', ')}`);

    // Log contract distribution
    const hourDist: Record<string, number> = {};
    employees.forEach(e => { hourDist[e.weekly_hours + 'h'] = (hourDist[e.weekly_hours + 'h'] || 0) + 1; });
    logs.push(`[SCHEDULE] Contract hours: ${JSON.stringify(hourDist)}`);

    // 1b. Location settings — fetch ALL scheduling config from DB
    const { data: locSettings } = await supabase
      .from('location_settings')
      .select('target_col_percent, default_hourly_cost, average_check_size, min_rest_hours, max_hours_per_day, staffing_ratios, hourly_demand_curve, closed_days, tables_count, splh_goal')
      .eq('location_id', location_id)
      .maybeSingle();

    const targetColPercent = locSettings?.target_col_percent ?? CONFIG.defaultTargetColPercent;
    const acs = Number(locSettings?.average_check_size) || CONFIG.defaultACS;
    const minRestHours = Number(locSettings?.min_rest_hours) || CONFIG.minRestHours;
    const maxHoursPerDay = Number(locSettings?.max_hours_per_day) || CONFIG.maxHoursPerDay;
    const closedDays: number[] = locSettings?.closed_days ?? [];

    // Override OPLH targets from DB if available
    const dbStaffingRatios = locSettings?.staffing_ratios as Record<string, number> | null;
    if (dbStaffingRatios) {
      for (const [role, val] of Object.entries(dbStaffingRatios)) {
        if (typeof val === 'number' && val > 0) {
          OPLH_TARGETS[role] = val;
        }
      }
      logs.push(`[SCHEDULE] OPLH targets from DB: ${JSON.stringify(OPLH_TARGETS)}`);
    }

    // Override hourly demand curve from DB if available
    const dbDemandCurve = locSettings?.hourly_demand_curve as Record<string, number> | null;
    if (dbDemandCurve && Object.keys(dbDemandCurve).length > 5) {
      for (const [hour, pct] of Object.entries(dbDemandCurve)) {
        HOURLY_DEMAND_CURVE[Number(hour)] = Number(pct);
      }
      logs.push(`[SCHEDULE] Demand curve from DB (${Object.keys(dbDemandCurve).length} hours)`);
    }

    // 1c. Forecast
    const { data: forecasts } = await supabase
      .from('forecast_daily_metrics')
      .select('date, forecast_sales, planned_labor_cost, planned_labor_hours')
      .eq('location_id', location_id)
      .gte('date', week_start)
      .lte('date', weekEnd)
      .order('date');

    const forecastByDate: Record<string, any> = {};
    (forecasts || []).forEach((f: any) => {
      forecastByDate[f.date] = {
        forecast_sales: Number(f.forecast_sales) || 0,
        planned_labor_cost: Number(f.planned_labor_cost) || 0,
        planned_labor_hours: Number(f.planned_labor_hours) || 0,
      };
    });

    // 1d. Check for time-off / availability (from planned_shifts with status='time_off' or future table)
    // For now, we don't block any days since no availability table exists yet
    const blockedDays: Record<string, Set<string>> = {}; // employeeId -> Set of blocked dates

    // =========================================================
    // 2. DELETE EXISTING SHIFTS
    // =========================================================
    await supabase
      .from('planned_shifts')
      .delete()
      .eq('location_id', location_id)
      .gte('shift_date', week_start)
      .lte('shift_date', weekEnd);

    // =========================================================
    // 3. CALCULATE DYNAMIC STAFFING PER DAY (OPLH-based)
    // =========================================================
    const salesValues = Object.values(forecastByDate).map((f: any) => f.forecast_sales).filter((s: number) => s > 0);
    const medianSales = median(salesValues);
    logs.push(`[SCHEDULE] Target COL%: ${targetColPercent}%, Median daily sales: €${medianSales.toFixed(0)}`);

    const allSlots: Slot[] = [];

    for (let d = 0; d < 7; d++) {
      const current = new Date(weekStartDate);
      current.setUTCDate(current.getUTCDate() + d);
      const dateStr = current.toISOString().split('T')[0];
      const forecast = forecastByDate[dateStr];
      const sales = forecast?.forecast_sales || 0;

      if (sales <= 0) {
        logs.push(`[SCHEDULE] ${dateStr}: CLOSED`);
        continue;
      }

      // Check if this day of week is a closed day
      const dayOfWeek = current.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      if (closedDays.includes(dayOfWeek)) {
        logs.push(`[SCHEDULE] ${dateStr}: CLOSED (closed day setting)`);
        continue;
      }

      // Dynamic staffing calculation based on OPLH hourly demand curve
      const staffNeeds = calculateStaffNeeds(sales, acs);

      let daySlots: Slot[] = [];
      let dayHours = 0;

      for (const [role, shiftNeeds] of Object.entries(staffNeeds)) {
        if (!employeesByRole[role] || employeesByRole[role].length === 0) continue;

        for (const [shiftType, count] of Object.entries(shiftNeeds)) {
          const sw = SHIFT_WINDOWS[shiftType];
          if (!sw || count <= 0) continue;

          for (let i = 0; i < count; i++) {
            daySlots.push({
              date: dateStr,
              shiftType,
              role,
              startTime: sw.start,
              endTime: sw.end,
              hours: sw.hours,
            });
            dayHours += sw.hours;
          }
        }
      }

      // =========================================================
      // BUDGET OPTIMIZATION — trim if over, add if under
      // =========================================================
      const laborBudget = sales * (targetColPercent / 100);
      let dayCost = dayHours * avgHourlyCost;

      // If over budget by >10%, trim non-essential roles iteratively
      if (dayCost > laborBudget * 1.10) {
        const trimPriority = ['Host', 'Bartender', 'Server', 'Chef']; // trim least essential first
        for (const trimRole of trimPriority) {
          if (dayCost <= laborBudget * 1.10) break;
          // Find shortest shifts of this role to trim
          const roleSlots = daySlots
            .filter(s => s.role === trimRole)
            .sort((a, b) => a.hours - b.hours);
          // Keep at least 1 of each role
          if (roleSlots.length > 1) {
            const toRemove = roleSlots[0];
            const idx = daySlots.indexOf(toRemove);
            if (idx >= 0) {
              dayHours -= toRemove.hours;
              dayCost = dayHours * avgHourlyCost;
              daySlots.splice(idx, 1);
              logs.push(`[SCHEDULE] ${dateStr}: Trimmed ${toRemove.role} ${toRemove.shiftType} (budget opt)`);
            }
          }
        }
      }

      // If under budget by >25%, consider adding a Server shift
      if (dayCost < laborBudget * 0.75 && employeesByRole['Server']?.length > 0) {
        const addShift = sales > medianSales ? 'CENA' : 'COMIDA';
        const sw = SHIFT_WINDOWS[addShift];
        daySlots.push({
          date: dateStr, shiftType: addShift, role: 'Server',
          startTime: sw.start, endTime: sw.end, hours: sw.hours,
        });
        dayHours += sw.hours;
        dayCost = dayHours * avgHourlyCost;
      }

      allSlots.push(...daySlots);
      const dayColPct = sales > 0 ? ((dayCost / sales) * 100).toFixed(1) : '0';
      logs.push(`[SCHEDULE] ${dateStr}: €${sales.toFixed(0)} → ${daySlots.length} shifts, ${dayHours.toFixed(1)}h, est.COL ${dayColPct}%`);
    }

    // =========================================================
    // 4. ASSIGN EMPLOYEES (contract-aware, load-balanced)
    // =========================================================
    const empState = new Map<string, EmpState>();
    employees.forEach(e => {
      empState.set(e.id, {
        shiftsCount: 0,
        totalHours: 0,
        workingDays: new Set(),
        lastShiftDate: '',
        lastShiftEnd: '',
        shiftVariety: {},
      });
    });

    const seedValue = week_start.split('-').reduce((a: number, b: string) => a + parseInt(b), 0);
    const assignments: Array<{ employee: Employee; slot: Slot }> = [];

    // Group and sort slots
    const slotsByRole: Record<string, Slot[]> = {};
    allSlots.forEach(slot => {
      if (!slotsByRole[slot.role]) slotsByRole[slot.role] = [];
      slotsByRole[slot.role].push(slot);
    });

    for (const [role, slots] of Object.entries(slotsByRole)) {
      const roleEmps = employeesByRole[role];
      if (!roleEmps || roleEmps.length === 0) {
        warnings.push(`No ${role} employees — ${slots.length} slots unfilled`);
        continue;
      }

      // Sort: busiest days first
      const dayDemand: Record<string, number> = {};
      for (const [date, f] of Object.entries(forecastByDate)) {
        dayDemand[date] = (f as any).forecast_sales || 0;
      }
      slots.sort((a, b) => (dayDemand[b.date] || 0) - (dayDemand[a.date] || 0));

      for (const slot of slots) {
        const shuffled = shuffleArray(roleEmps, seedValue + slot.date.charCodeAt(9) + Math.round(slot.hours * 7));

        const candidates = shuffled
          .filter(emp => {
            const state = empState.get(emp.id)!;

            // CONTRACT-AWARE: max shifts based on weekly_hours
            if (state.shiftsCount >= emp.max_shifts) return false;

            // CONTRACT-AWARE: don't exceed weekly_hours
            if (state.totalHours + slot.hours > emp.weekly_hours + 2) return false; // +2h tolerance

            // AVAILABILITY: check blocked days
            const blocked = blockedDays[emp.id];
            if (blocked && blocked.has(slot.date)) return false;

            // Same-day overlap check
            const existingToday = assignments.filter(a => a.employee.id === emp.id && a.slot.date === slot.date);
            if (existingToday.length >= 2) return false;
            if (existingToday.length === 1) {
              const existing = existingToday[0].slot;
              if (shiftsOverlap(existing.startTime, existing.endTime, slot.startTime, slot.endTime)) return false;
              if (existing.hours + slot.hours > maxHoursPerDay) return false;
            }

            // Rest between days (uses DB setting, not hardcoded)
            if (state.lastShiftDate && state.lastShiftDate !== slot.date && state.lastShiftEnd) {
              const lastEnd = new Date(`${state.lastShiftDate}T${state.lastShiftEnd}:00Z`);
              const thisStart = new Date(`${slot.date}T${slot.startTime}:00Z`);
              const restMs = thisStart.getTime() - lastEnd.getTime();
              if (restMs > 0 && restMs < minRestHours * 3600000) return false;
            }

            return true;
          })
          .sort((a, b) => {
            const sa = empState.get(a.id)!;
            const sb = empState.get(b.id)!;
            // Primary: utilization ratio (hours worked / weekly_hours contract)
            const ratioA = sa.totalHours / a.weekly_hours;
            const ratioB = sb.totalHours / b.weekly_hours;
            if (Math.abs(ratioA - ratioB) > 0.1) return ratioA - ratioB;
            // Secondary: fewer total shifts
            if (sa.shiftsCount !== sb.shiftsCount) return sa.shiftsCount - sb.shiftsCount;
            // Tertiary: variety
            return (sa.shiftVariety[slot.shiftType] || 0) - (sb.shiftVariety[slot.shiftType] || 0);
          });

        if (candidates.length === 0) {
          warnings.push(`No available ${role} for ${slot.date} ${slot.shiftType}`);
          continue;
        }

        const chosen = candidates[0];
        const state = empState.get(chosen.id)!;
        state.shiftsCount++;
        state.totalHours += slot.hours;
        state.workingDays.add(slot.date);
        state.lastShiftDate = slot.date;
        state.lastShiftEnd = slot.endTime;
        state.shiftVariety[slot.shiftType] = (state.shiftVariety[slot.shiftType] || 0) + 1;

        assignments.push({ employee: chosen, slot });
      }
    }

    // =========================================================
    // 5. INSERT SHIFTS
    // =========================================================
    const shiftsToInsert = assignments.map(({ employee, slot }) => ({
      employee_id: employee.id,
      location_id,
      shift_date: slot.date,
      start_time: slot.startTime + ':00',
      end_time: slot.endTime + ':00',
      planned_hours: slot.hours,
      planned_cost: Math.round(employee.hourly_cost * slot.hours * 100) / 100,
      role: slot.role,
      status: 'draft',
    }));

    let shiftsCreated = 0;
    for (let i = 0; i < shiftsToInsert.length; i += 100) {
      const batch = shiftsToInsert.slice(i, i + 100);
      const { data: inserted, error: insertError } = await supabase
        .from('planned_shifts')
        .insert(batch)
        .select('id');
      if (insertError) throw new Error(`Insert batch ${i}: ${insertError.message}`);
      shiftsCreated += inserted?.length || 0;
    }

    // =========================================================
    // 6. SUMMARY
    // =========================================================
    const totalCost = shiftsToInsert.reduce((s, sh) => s + sh.planned_cost, 0);
    const totalHours = shiftsToInsert.reduce((s, sh) => s + sh.planned_hours, 0);
    const totalSales = Object.values(forecastByDate).reduce((s: number, f: any) => s + (f.forecast_sales || 0), 0);
    const colPercent = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;

    const shiftsByRole: Record<string, number> = {};
    const shiftsByType: Record<string, number> = {};
    assignments.forEach(a => {
      shiftsByRole[a.slot.role] = (shiftsByRole[a.slot.role] || 0) + 1;
      shiftsByType[a.slot.shiftType] = (shiftsByType[a.slot.shiftType] || 0) + 1;
    });

    // Employee utilization
    const utilization: Record<string, string> = {};
    employees.forEach(e => {
      const state = empState.get(e.id)!;
      utilization[e.full_name] = `${state.totalHours}/${e.weekly_hours}h (${state.shiftsCount} shifts)`;
    });

    logs.push(`[SCHEDULE] Created ${shiftsCreated} shifts, ${totalHours.toFixed(1)}h total`);
    logs.push(`[SCHEDULE] Cost: €${totalCost.toFixed(0)} / Sales: €${totalSales.toFixed(0)} = COL% ${colPercent.toFixed(1)}% (target ${targetColPercent}%)`);
    logs.push(`[SCHEDULE] By role: ${JSON.stringify(shiftsByRole)}`);
    logs.push(`[SCHEDULE] By type: ${JSON.stringify(shiftsByType)}`);
    logs.push(`[SCHEDULE] Contract hours dist: ${JSON.stringify(hourDist)}`);

    logs.forEach(l => console.log(l));
    warnings.forEach(w => console.warn(w));

    return new Response(
      JSON.stringify({
        success: true,
        shifts_created: shiftsCreated,
        days_generated: new Set(assignments.map(a => a.slot.date)).size,
        employees_count: employees.length,
        total_hours: Math.round(totalHours * 10) / 10,
        summary: {
          totalCost: Math.round(totalCost),
          totalForecastSales: Math.round(totalSales),
          colPercent: Math.round(colPercent * 10) / 10,
          targetColPercent,
          totalHours: Math.round(totalHours * 10) / 10,
          shiftsByRole,
          shiftsByType,
          avgShiftsPerEmployee: +(assignments.length / employees.length).toFixed(1),
        },
        warnings: warnings.length > 0 ? warnings.slice(0, 20) : undefined,
        logs: logs.slice(0, 50),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SCHEDULE] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', shifts_created: 0, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
