import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// =================================================================
// NORY-STYLE SCHEDULING v4 — Demand-driven via forecast_hourly_metrics
//
// Flow:
// 1. Resolve data_source from org_settings (service_role, no RPC needed)
// 2. Fetch forecast_hourly_metrics for demand[date][hour]
// 3. Convert demand → planned_hours via SPLH goal
// 4. Split hours into shift blocks (prep / commercial / close)
// 5. Assign employees (contract-aware, load-balanced)
// 6. Output metrics: peak hours, understaffing risk
//
// FALLBACK: If no hourly forecast data, falls back to v3 static curve.
// =================================================================

// ---------- Shift windows (unchanged schema) ----------
const SHIFT_WINDOWS: Record<string, { start: string; end: string; hours: number }> = {
  APERTURA:  { start: '09:00', end: '14:00', hours: 5 },
  COMIDA:    { start: '11:00', end: '16:00', hours: 5 },
  JORNADA:   { start: '10:00', end: '18:00', hours: 8 },
  TARDE:     { start: '16:00', end: '23:00', hours: 7 },
  CENA:      { start: '18:00', end: '23:00', hours: 5 },
  CIERRE:    { start: '20:00', end: '00:30', hours: 4.5 },
};

// ---------- Static demand curve (v3 fallback) ----------
const STATIC_DEMAND_CURVE: Record<number, number> = {
  9: 0.01, 10: 0.02, 11: 0.04, 12: 0.07,
  13: 0.14, 14: 0.15, 15: 0.08, 16: 0.03,
  17: 0.03, 18: 0.04, 19: 0.05, 20: 0.10,
  21: 0.12, 22: 0.09, 23: 0.03,
};

// ---------- OPLH targets (v3 compat, used in static fallback) ----------
const OPLH_TARGETS: Record<string, number> = {
  Chef: 12, Server: 16, Bartender: 25, Host: 40, Manager: 999,
};

const ROLE_SHIFT_MAP: Record<string, string[]> = {
  Chef:      ['APERTURA', 'JORNADA', 'COMIDA', 'CENA', 'TARDE'],
  Server:    ['COMIDA', 'CENA', 'JORNADA', 'TARDE'],
  Bartender: ['COMIDA', 'TARDE', 'CENA'],
  Host:      ['COMIDA', 'CENA'],
  Manager:   ['JORNADA', 'CENA'],
};

// ---------- Minimum floor staffing by hour band ----------
interface FloorStaffing { foh: number; boh: number }
const DEFAULT_FLOOR: Record<string, FloorStaffing> = {
  prep:      { foh: 0, boh: 2 },  // 09-11
  valley:    { foh: 1, boh: 2 },  // 12, 15-18
  lunch:     { foh: 2, boh: 2 },  // 13-14
  dinner:    { foh: 3, boh: 3 },  // 19-22
  close:     { foh: 0, boh: 1 },  // 23
};

function getFloorBand(hour: number): string {
  if (hour >= 9 && hour < 12) return 'prep';
  if (hour >= 13 && hour <= 14) return 'lunch';
  if (hour >= 19 && hour <= 22) return 'dinner';
  if (hour === 23) return 'close';
  return 'valley';
}

// ---------- Config defaults ----------
const CONFIG = {
  defaultTargetColPercent: 32,
  defaultHourlyCost: 14.5,
  defaultACS: 25,
  defaultSPLH: 80,        // €80 sales per labor hour
  minRestHours: 10,
  maxHoursPerDay: 10,
};

// ---------- Types ----------
interface Employee {
  id: string;
  full_name: string;
  role_name: string;
  hourly_cost: number;
  weekly_hours: number;
  contract_type: string;
  max_shifts: number;
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

interface HourDemand {
  hour: number;
  forecastSales: number;
  plannedHoursFOH: number;
  plannedHoursBOH: number;
  totalPlannedHours: number;
  isUnderstaffed: boolean;
}

// ---------- Helpers ----------
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
  const aS = toMin(aStart); let aE = toMin(aEnd); const bS = toMin(bStart); let bE = toMin(bEnd);
  if (aE <= aS) aE += 24 * 60;
  if (bE <= bS) bE += 24 * 60;
  return aS < bE && bS < aE;
}

// =================================================================
// RESOLVE DATA SOURCE (service_role reads org_settings directly)
// Mirrors resolve_data_source RPC logic without calling RPC.
// =================================================================
async function resolveDataSourceEdge(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<{ ds: string; dsLegacy: string; mode: string; reason: string }> {
  // Read org_settings
  const { data: settings } = await supabase
    .from('org_settings')
    .select('data_source_mode, manual_data_source')
    .eq('org_id', orgId)
    .maybeSingle();

  const mode = settings?.data_source_mode ?? 'auto';
  const manualSrc = settings?.manual_data_source;

  // Find latest sync
  const { data: integrations } = await supabase
    .from('integrations')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('provider', 'square')
    .eq('status', 'active');

  let lastSynced: Date | null = null;
  for (const i of (integrations || [])) {
    const meta = i.metadata as Record<string, string> | null;
    if (meta?.last_synced_at) {
      const ts = new Date(meta.last_synced_at);
      if (!lastSynced || ts > lastSynced) lastSynced = ts;
    }
  }

  const isRecent = lastSynced && (Date.now() - lastSynced.getTime()) < 24 * 3600 * 1000;

  let ds: string;
  let reason: string;

  if (mode === 'auto') {
    ds = isRecent ? 'pos' : 'demo';
    reason = isRecent ? 'auto_pos_recent' : 'auto_demo_no_sync';
  } else {
    if (manualSrc === 'demo') {
      ds = 'demo';
      reason = 'manual_demo';
    } else if (manualSrc === 'pos') {
      ds = isRecent ? 'pos' : 'demo';
      reason = isRecent ? 'manual_pos_recent' : 'manual_pos_blocked_no_sync';
    } else {
      ds = 'demo';
      reason = 'auto_demo_no_sync';
    }
  }

  return {
    ds,
    dsLegacy: ds === 'pos' ? 'pos' : 'simulated',
    mode,
    reason,
  };
}

// =================================================================
// BUILD HOURLY DEMAND from forecast_hourly_metrics
// Returns demand[dateStr][hour] = forecastSales
// =================================================================
async function fetchHourlyDemand(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  weekStart: string,
  weekEnd: string,
  ds: string,
): Promise<{ demand: Record<string, Record<number, number>>; available: boolean }> {
  try {
    const { data: rows } = await supabase
      .from('forecast_hourly_metrics')
      .select('forecast_date, hour_of_day, forecast_sales, data_source')
      .eq('location_id', locationId)
      .gte('forecast_date', weekStart)
      .lte('forecast_date', weekEnd)
      .eq('data_source', ds)
      .order('forecast_date')
      .order('hour_of_day');

    if (!rows || rows.length === 0) {
      return { demand: {}, available: false };
    }

    const demand: Record<string, Record<number, number>> = {};
    for (const r of rows) {
      const d = r.forecast_date as string;
      const h = Number(r.hour_of_day);
      const s = Number(r.forecast_sales) || 0;
      if (!demand[d]) demand[d] = {};
      demand[d][h] = (demand[d][h] || 0) + s;
    }

    return { demand, available: true };
  } catch {
    return { demand: {}, available: false };
  }
}

// =================================================================
// CONVERT DEMAND → PLANNED HOURS PER HOUR (v4 core)
//
// planned_staff = max( demand / splh_goal, floor_min )
// Split FOH/BOH based on hour band.
// =================================================================
function demandToHourlyPlan(
  hourlyDemand: Record<number, number>,
  splhGoal: number,
  floorOverrides?: Record<string, FloorStaffing>,
): HourDemand[] {
  const floor = { ...DEFAULT_FLOOR, ...(floorOverrides || {}) };
  const result: HourDemand[] = [];

  for (let h = 9; h <= 23; h++) {
    const forecastSales = hourlyDemand[h] || 0;
    const band = getFloorBand(h);
    const bandFloor = floor[band] || floor['valley'];

    // Demand-driven staff hours (1 staff-hour per SPLH goal in sales)
    const demandDrivenHours = splhGoal > 0 ? forecastSales / splhGoal : 0;

    // Split demand 60% FOH / 40% BOH for commercial hours
    let fohDemand: number, bohDemand: number;
    if (band === 'prep' || band === 'close') {
      fohDemand = 0;
      bohDemand = demandDrivenHours;
    } else {
      fohDemand = demandDrivenHours * 0.6;
      bohDemand = demandDrivenHours * 0.4;
    }

    const plannedFOH = Math.max(fohDemand, bandFloor.foh);
    const plannedBOH = Math.max(bohDemand, bandFloor.boh);
    const total = plannedFOH + plannedBOH;

    // Understaffing: demand exceeds floor by 2x+ and we're clamping hard
    const isUnderstaffed = demandDrivenHours > (bandFloor.foh + bandFloor.boh) * 2
      && total < demandDrivenHours * 0.8;

    result.push({
      hour: h,
      forecastSales,
      plannedHoursFOH: Math.round(plannedFOH * 10) / 10,
      plannedHoursBOH: Math.round(plannedBOH * 10) / 10,
      totalPlannedHours: Math.round(total * 10) / 10,
      isUnderstaffed,
    });
  }

  return result;
}

// =================================================================
// CONVERT HOURLY PLAN → SHIFT SLOTS
//
// Groups consecutive hours into shift blocks:
// - Prep block: 09-11 (BOH only)
// - Commercial blocks: 12-22 (demand-driven, generates COMIDA/CENA/JORNADA)
// - Close block: 23 (BOH only)
// =================================================================
function hourlyPlanToSlots(
  dateStr: string,
  hourlyPlan: HourDemand[],
  employeesByRole: Record<string, Employee[]>,
): Slot[] {
  const slots: Slot[] = [];

  // Aggregate planned hours by period
  const prep = hourlyPlan.filter(h => h.hour >= 9 && h.hour < 12);
  const lunch = hourlyPlan.filter(h => h.hour >= 12 && h.hour < 16);
  const dinner = hourlyPlan.filter(h => h.hour >= 18 && h.hour <= 22);
  const close = hourlyPlan.filter(h => h.hour === 23);

  const maxBOHPrep = Math.max(...prep.map(h => h.plannedHoursBOH), 0);
  const maxFOHLunch = Math.max(...lunch.map(h => h.plannedHoursFOH), 0);
  const maxBOHLunch = Math.max(...lunch.map(h => h.plannedHoursBOH), 0);
  const maxFOHDinner = Math.max(...dinner.map(h => h.plannedHoursFOH), 0);
  const maxBOHDinner = Math.max(...dinner.map(h => h.plannedHoursBOH), 0);
  const maxBOHClose = Math.max(...close.map(h => h.plannedHoursBOH), 0);

  // --- Prep block: BOH (Chef) ---
  const prepChefs = Math.max(1, Math.ceil(maxBOHPrep));
  for (let i = 0; i < prepChefs; i++) {
    slots.push({ date: dateStr, shiftType: 'APERTURA', role: 'Chef',
      startTime: '09:00', endTime: '14:00', hours: 5 });
  }

  // --- Lunch block: FOH ---
  const lunchServers = Math.max(1, Math.ceil(maxFOHLunch));
  for (let i = 0; i < lunchServers; i++) {
    slots.push({ date: dateStr, shiftType: 'COMIDA', role: 'Server',
      startTime: '11:00', endTime: '16:00', hours: 5 });
  }

  // Lunch BOH (additional Chefs beyond prep coverage)
  const lunchExtraBOH = Math.max(0, Math.ceil(maxBOHLunch) - prepChefs);
  for (let i = 0; i < lunchExtraBOH; i++) {
    slots.push({ date: dateStr, shiftType: 'COMIDA', role: 'Chef',
      startTime: '11:00', endTime: '16:00', hours: 5 });
  }

  // Host at lunch if >= 2 FOH
  if (lunchServers >= 2 && (employeesByRole['Host']?.length ?? 0) > 0) {
    slots.push({ date: dateStr, shiftType: 'COMIDA', role: 'Host',
      startTime: '11:00', endTime: '16:00', hours: 5 });
  }

  // Bartender at lunch if busy
  if (lunchServers >= 2 && (employeesByRole['Bartender']?.length ?? 0) > 0) {
    slots.push({ date: dateStr, shiftType: 'COMIDA', role: 'Bartender',
      startTime: '11:00', endTime: '16:00', hours: 5 });
  }

  // --- Dinner block: FOH ---
  const dinnerServers = Math.max(1, Math.ceil(maxFOHDinner));
  for (let i = 0; i < dinnerServers; i++) {
    slots.push({ date: dateStr, shiftType: 'CENA', role: 'Server',
      startTime: '18:00', endTime: '23:00', hours: 5 });
  }

  // Dinner BOH (Chefs)
  const dinnerChefs = Math.max(1, Math.ceil(maxBOHDinner));
  for (let i = 0; i < dinnerChefs; i++) {
    slots.push({ date: dateStr, shiftType: 'CENA', role: 'Chef',
      startTime: '18:00', endTime: '23:00', hours: 5 });
  }

  // Host at dinner
  if ((employeesByRole['Host']?.length ?? 0) > 0) {
    slots.push({ date: dateStr, shiftType: 'CENA', role: 'Host',
      startTime: '18:00', endTime: '23:00', hours: 5 });
  }

  // Bartender at dinner
  if ((employeesByRole['Bartender']?.length ?? 0) > 0) {
    slots.push({ date: dateStr, shiftType: 'TARDE', role: 'Bartender',
      startTime: '16:00', endTime: '23:00', hours: 7 });
  }

  // Manager: full day if >2 total FOH, else just dinner
  const totalFOH = lunchServers + dinnerServers;
  if ((employeesByRole['Manager']?.length ?? 0) > 0) {
    if (totalFOH >= 4) {
      slots.push({ date: dateStr, shiftType: 'JORNADA', role: 'Manager',
        startTime: '10:00', endTime: '18:00', hours: 8 });
    }
    slots.push({ date: dateStr, shiftType: 'CENA', role: 'Manager',
      startTime: '18:00', endTime: '23:00', hours: 5 });
  }

  // If very busy lunch+dinner, add a JORNADA server for bridge coverage
  if (lunchServers >= 3 && dinnerServers >= 3) {
    slots.push({ date: dateStr, shiftType: 'JORNADA', role: 'Server',
      startTime: '10:00', endTime: '18:00', hours: 8 });
    // Remove 1 COMIDA server since JORNADA covers lunch
    const idx = slots.findIndex(s => s.date === dateStr && s.role === 'Server' && s.shiftType === 'COMIDA');
    if (idx >= 0 && lunchServers > 1) slots.splice(idx, 1);
  }

  // --- Close block: BOH only ---
  const closeStaff = Math.max(1, Math.ceil(maxBOHClose));
  // Close is already covered by CENA shifts (end at 23:00)
  // Only add explicit close shift if we need extra beyond CENA coverage
  if (closeStaff > dinnerChefs) {
    slots.push({ date: dateStr, shiftType: 'CIERRE', role: 'Chef',
      startTime: '20:00', endTime: '00:30', hours: 4.5 });
  }

  return slots;
}

// =================================================================
// V3 FALLBACK: Static curve staffing (unchanged logic)
// =================================================================
function calculateStaffNeedsV3(
  dailySales: number,
  acs: number,
): Record<string, Record<string, number>> {
  const dailyCovers = dailySales / acs;
  const lunchPeakCoversPerHour = dailyCovers * Math.max(...[13, 14].map(h => STATIC_DEMAND_CURVE[h] || 0));
  const dinnerPeakCoversPerHour = dailyCovers * Math.max(...[21, 22].map(h => STATIC_DEMAND_CURVE[h] || 0));

  const needs: Record<string, Record<string, number>> = {};
  for (const [role, oplh] of Object.entries(OPLH_TARGETS)) {
    needs[role] = {};
    if (role === 'Manager') {
      needs[role]['JORNADA'] = 1;
      if (dinnerPeakCoversPerHour > 15) needs[role]['CENA'] = 1;
      continue;
    }
    const lunchStaff = Math.max(1, Math.ceil(lunchPeakCoversPerHour / oplh));
    const dinnerStaff = Math.max(1, Math.ceil(dinnerPeakCoversPerHour / oplh));
    if (role === 'Chef') {
      needs[role]['APERTURA'] = 1;
      needs[role]['COMIDA'] = Math.max(1, lunchStaff - 1);
      needs[role]['CENA'] = dinnerStaff;
    } else if (role === 'Host') {
      if (lunchStaff >= 2) needs[role]['COMIDA'] = 1;
      needs[role]['CENA'] = 1;
    } else if (role === 'Bartender') {
      if (lunchStaff >= 2) needs[role]['COMIDA'] = 1;
      needs[role]['TARDE'] = 1;
    } else {
      needs[role]['COMIDA'] = lunchStaff;
      needs[role]['CENA'] = dinnerStaff;
      if (lunchStaff >= 3 && dinnerStaff >= 3) {
        needs[role]['JORNADA'] = 1;
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

    logs.push(`[SCHEDULE] v4 — Starting for location ${location_id}, week ${week_start}`);

    const weekStartDate = new Date(week_start + 'T00:00:00Z');
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    // =========================================================
    // 1. RESOLVE DATA SOURCE
    // =========================================================
    // Look up org_id from location
    const { data: locRow } = await supabase
      .from('locations')
      .select('group_id')
      .eq('id', location_id)
      .single();

    const orgId = locRow?.group_id;
    let dsInfo = { ds: 'demo', dsLegacy: 'simulated', mode: 'auto', reason: 'no_org' };
    if (orgId) {
      dsInfo = await resolveDataSourceEdge(supabase, orgId);
    }
    logs.push(`[SCHEDULE] Data source: ${dsInfo.ds} (${dsInfo.reason})`);

    // =========================================================
    // 2. FETCH EMPLOYEES + PAYROLL
    // =========================================================
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
    (payrollRaw || []).forEach((p: { employee_id: string; weekly_hours: number; contract_type: string }) => {
      payrollMap[p.employee_id] = { weekly_hours: p.weekly_hours, contract_type: p.contract_type };
    });

    const employees: Employee[] = (employeesRaw || [])
      .filter((e: { full_name: string }) => !e.full_name.startsWith('OPEN -'))
      .map((e: { id: string; full_name: string; role_name: string | null; hourly_cost: number | null }) => {
        const payroll = payrollMap[e.id];
        const weeklyHours = payroll?.weekly_hours ?? 40;
        const avgShiftHours = 6.5;
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

    const hourDist: Record<string, number> = {};
    employees.forEach(e => { hourDist[e.weekly_hours + 'h'] = (hourDist[e.weekly_hours + 'h'] || 0) + 1; });
    logs.push(`[SCHEDULE] Contract hours: ${JSON.stringify(hourDist)}`);

    // =========================================================
    // 3. LOCATION SETTINGS
    // =========================================================
    const { data: locSettings } = await supabase
      .from('location_settings')
      .select('target_col_percent, default_hourly_cost, average_check_size, min_rest_hours, max_hours_per_day, staffing_ratios, hourly_demand_curve, closed_days, tables_count, splh_goal')
      .eq('location_id', location_id)
      .maybeSingle();

    const targetColPercent = locSettings?.target_col_percent ?? CONFIG.defaultTargetColPercent;
    const acs = Number(locSettings?.average_check_size) || CONFIG.defaultACS;
    const splhGoal = Number(locSettings?.splh_goal) || CONFIG.defaultSPLH;
    const minRestHours = Number(locSettings?.min_rest_hours) || CONFIG.minRestHours;
    const maxHoursPerDay = Number(locSettings?.max_hours_per_day) || CONFIG.maxHoursPerDay;
    const closedDays: number[] = locSettings?.closed_days ?? [];

    // Override OPLH targets from DB if available (for v3 fallback)
    const dbStaffingRatios = locSettings?.staffing_ratios as Record<string, number> | null;
    if (dbStaffingRatios) {
      for (const [role, val] of Object.entries(dbStaffingRatios)) {
        if (typeof val === 'number' && val > 0) OPLH_TARGETS[role] = val;
      }
    }

    // =========================================================
    // 4. FETCH FORECAST DATA
    // =========================================================
    // 4a. Daily forecast (always needed for budget/COL calculation)
    const { data: forecasts } = await supabase
      .from('forecast_daily_metrics')
      .select('date, forecast_sales, planned_labor_cost, planned_labor_hours, data_source')
      .eq('location_id', location_id)
      .gte('date', week_start)
      .lte('date', weekEnd)
      .order('date');

    // Filter by data_source if column has values matching our ds
    const forecastByDate: Record<string, { forecast_sales: number; planned_labor_cost: number; planned_labor_hours: number }> = {};
    (forecasts || []).forEach((f: { date: string; forecast_sales: number; planned_labor_cost: number; planned_labor_hours: number; data_source?: string }) => {
      // Accept rows that match ds or rows without data_source (legacy)
      const fds = f.data_source;
      if (fds && fds !== dsInfo.ds && fds !== dsInfo.dsLegacy) return;
      forecastByDate[f.date] = {
        forecast_sales: Number(f.forecast_sales) || 0,
        planned_labor_cost: Number(f.planned_labor_cost) || 0,
        planned_labor_hours: Number(f.planned_labor_hours) || 0,
      };
    });

    // 4b. Hourly forecast (v4 demand-driven)
    const { demand: hourlyDemandData, available: hourlyAvailable } = await fetchHourlyDemand(
      supabase, location_id, week_start, weekEnd, dsInfo.ds,
    );

    const schedulingMode = hourlyAvailable ? 'v4_demand_driven' : 'v3_static_curve';
    logs.push(`[SCHEDULE] Scheduling mode: ${schedulingMode} | SPLH goal: €${splhGoal}/h | Target COL: ${targetColPercent}%`);

    // =========================================================
    // 5. DELETE EXISTING SHIFTS
    // =========================================================
    await supabase
      .from('planned_shifts')
      .delete()
      .eq('location_id', location_id)
      .gte('shift_date', week_start)
      .lte('shift_date', weekEnd);

    // =========================================================
    // 6. GENERATE SLOTS (v4 or v3 fallback)
    // =========================================================
    const salesValues = Object.values(forecastByDate).map(f => f.forecast_sales).filter(s => s > 0);
    const medianSales = median(salesValues);

    const allSlots: Slot[] = [];
    const dailyMetrics: Array<{
      date: string;
      forecastSales: number;
      hourlyPlan: HourDemand[];
      peakHours: Array<{ hour: number; sales: number }>;
      understaffingRisk: boolean;
      slotsCount: number;
      totalHours: number;
    }> = [];

    for (let d = 0; d < 7; d++) {
      const current = new Date(weekStartDate);
      current.setUTCDate(current.getUTCDate() + d);
      const dateStr = current.toISOString().split('T')[0];
      const forecast = forecastByDate[dateStr];
      const sales = forecast?.forecast_sales || 0;

      if (sales <= 0) {
        logs.push(`[SCHEDULE] ${dateStr}: CLOSED (no forecast)`);
        continue;
      }

      const dayOfWeek = current.getUTCDay();
      if (closedDays.includes(dayOfWeek)) {
        logs.push(`[SCHEDULE] ${dateStr}: CLOSED (closed day setting)`);
        continue;
      }

      let daySlots: Slot[];
      let hourlyPlan: HourDemand[] = [];

      if (hourlyAvailable && hourlyDemandData[dateStr]) {
        // ---- V4: Demand-driven from hourly forecast ----
        hourlyPlan = demandToHourlyPlan(hourlyDemandData[dateStr], splhGoal);
        daySlots = hourlyPlanToSlots(dateStr, hourlyPlan, employeesByRole);
      } else {
        // ---- V3 FALLBACK: Static curve ----
        // Override curve from DB if available
        const dbDemandCurve = locSettings?.hourly_demand_curve as Record<string, number> | null;
        if (dbDemandCurve && Object.keys(dbDemandCurve).length > 5) {
          for (const [hour, pct] of Object.entries(dbDemandCurve)) {
            STATIC_DEMAND_CURVE[Number(hour)] = Number(pct);
          }
        }

        const staffNeeds = calculateStaffNeedsV3(sales, acs);
        daySlots = [];
        for (const [role, shiftNeeds] of Object.entries(staffNeeds)) {
          if (!employeesByRole[role] || employeesByRole[role].length === 0) continue;
          for (const [shiftType, count] of Object.entries(shiftNeeds)) {
            const sw = SHIFT_WINDOWS[shiftType];
            if (!sw || count <= 0) continue;
            for (let i = 0; i < count; i++) {
              daySlots.push({
                date: dateStr, shiftType, role,
                startTime: sw.start, endTime: sw.end, hours: sw.hours,
              });
            }
          }
        }
      }

      // ---- Budget optimization (shared v3/v4) ----
      let dayHours = daySlots.reduce((s, sl) => s + sl.hours, 0);
      const laborBudget = sales * (targetColPercent / 100);
      let dayCost = dayHours * avgHourlyCost;

      // Trim if over budget by >10%
      if (dayCost > laborBudget * 1.10) {
        const trimPriority = ['Host', 'Bartender', 'Server', 'Chef'];
        for (const trimRole of trimPriority) {
          if (dayCost <= laborBudget * 1.10) break;
          const roleSlots = daySlots
            .filter(s => s.role === trimRole)
            .sort((a, b) => a.hours - b.hours);
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

      // Add if under budget by >25%
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

      // ---- Metrics for this day ----
      const peakHours = hourlyPlan.length > 0
        ? [...hourlyPlan].sort((a, b) => b.forecastSales - a.forecastSales).slice(0, 3).map(h => ({ hour: h.hour, sales: h.forecastSales }))
        : [];

      const understaffingRisk = hourlyPlan.some(h => h.isUnderstaffed);

      dailyMetrics.push({
        date: dateStr,
        forecastSales: sales,
        hourlyPlan,
        peakHours,
        understaffingRisk,
        slotsCount: daySlots.length,
        totalHours: dayHours,
      });

      allSlots.push(...daySlots);
      const dayColPct = sales > 0 ? ((dayCost / sales) * 100).toFixed(1) : '0';
      logs.push(`[SCHEDULE] ${dateStr}: €${sales.toFixed(0)} → ${daySlots.length} shifts, ${dayHours.toFixed(1)}h, est.COL ${dayColPct}%${understaffingRisk ? ' ⚠ UNDERSTAFFED' : ''}`);
    }

    // =========================================================
    // 7. ASSIGN EMPLOYEES (unchanged from v3)
    // =========================================================
    const empState = new Map<string, EmpState>();
    employees.forEach(e => {
      empState.set(e.id, {
        shiftsCount: 0, totalHours: 0, workingDays: new Set(),
        lastShiftDate: '', lastShiftEnd: '', shiftVariety: {},
      });
    });

    const seedValue = week_start.split('-').reduce((a: number, b: string) => a + parseInt(b), 0);
    const assignments: Array<{ employee: Employee; slot: Slot }> = [];
    const blockedDays: Record<string, Set<string>> = {};

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

      const dayDemand: Record<string, number> = {};
      for (const [date, f] of Object.entries(forecastByDate)) {
        dayDemand[date] = f.forecast_sales || 0;
      }
      slots.sort((a, b) => (dayDemand[b.date] || 0) - (dayDemand[a.date] || 0));

      for (const slot of slots) {
        const shuffled = shuffleArray(roleEmps, seedValue + slot.date.charCodeAt(9) + Math.round(slot.hours * 7));

        const candidates = shuffled
          .filter(emp => {
            const state = empState.get(emp.id)!;
            if (state.shiftsCount >= emp.max_shifts) return false;
            if (state.totalHours + slot.hours > emp.weekly_hours + 2) return false;
            const blocked = blockedDays[emp.id];
            if (blocked && blocked.has(slot.date)) return false;
            const existingToday = assignments.filter(a => a.employee.id === emp.id && a.slot.date === slot.date);
            if (existingToday.length >= 2) return false;
            if (existingToday.length === 1) {
              const existing = existingToday[0].slot;
              if (shiftsOverlap(existing.startTime, existing.endTime, slot.startTime, slot.endTime)) return false;
              if (existing.hours + slot.hours > maxHoursPerDay) return false;
            }
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
            const ratioA = sa.totalHours / a.weekly_hours;
            const ratioB = sb.totalHours / b.weekly_hours;
            if (Math.abs(ratioA - ratioB) > 0.1) return ratioA - ratioB;
            if (sa.shiftsCount !== sb.shiftsCount) return sa.shiftsCount - sb.shiftsCount;
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
    // 8. INSERT SHIFTS
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
    // 9. SUMMARY + METRICS
    // =========================================================
    const totalCost = shiftsToInsert.reduce((s, sh) => s + sh.planned_cost, 0);
    const totalHours = shiftsToInsert.reduce((s, sh) => s + sh.planned_hours, 0);
    const totalSales = Object.values(forecastByDate).reduce((s, f) => s + (f.forecast_sales || 0), 0);
    const colPercent = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;

    const shiftsByRole: Record<string, number> = {};
    const shiftsByType: Record<string, number> = {};
    assignments.forEach(a => {
      shiftsByRole[a.slot.role] = (shiftsByRole[a.slot.role] || 0) + 1;
      shiftsByType[a.slot.shiftType] = (shiftsByType[a.slot.shiftType] || 0) + 1;
    });

    // Peak hours across the week
    const allPeakHours = dailyMetrics
      .flatMap(dm => dm.peakHours.map(ph => ({ date: dm.date, ...ph })))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Understaffing risk days
    const understaffedDays = dailyMetrics
      .filter(dm => dm.understaffingRisk)
      .map(dm => dm.date);

    logs.push(`[SCHEDULE] Created ${shiftsCreated} shifts, ${totalHours.toFixed(1)}h total`);
    logs.push(`[SCHEDULE] Cost: €${totalCost.toFixed(0)} / Sales: €${totalSales.toFixed(0)} = COL% ${colPercent.toFixed(1)}% (target ${targetColPercent}%)`);
    logs.push(`[SCHEDULE] By role: ${JSON.stringify(shiftsByRole)}`);
    logs.push(`[SCHEDULE] By type: ${JSON.stringify(shiftsByType)}`);
    if (allPeakHours.length > 0) {
      logs.push(`[SCHEDULE] Peak hours: ${allPeakHours.map(ph => `${ph.date} ${ph.hour}:00 €${Math.round(ph.sales)}`).join(', ')}`);
    }
    if (understaffedDays.length > 0) {
      warnings.push(`Understaffing risk on: ${understaffedDays.join(', ')}`);
    }

    logs.forEach(l => console.log(l));
    warnings.forEach(w => console.warn(w));

    return new Response(
      JSON.stringify({
        success: true,
        scheduling_mode: schedulingMode,
        data_source: dsInfo.ds,
        data_source_reason: dsInfo.reason,
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
          splhGoal,
        },
        metrics: {
          peak_hours: allPeakHours,
          understaffed_days: understaffedDays,
          daily: dailyMetrics.map(dm => ({
            date: dm.date,
            forecast_sales: Math.round(dm.forecastSales),
            slots: dm.slotsCount,
            hours: Math.round(dm.totalHours * 10) / 10,
            understaffing_risk: dm.understaffingRisk,
            peak_hours: dm.peakHours,
          })),
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
