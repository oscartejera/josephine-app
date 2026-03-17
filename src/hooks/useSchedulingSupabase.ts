// Scheduling hook — uses resolve_data_source(org_id) via dataSource from AppContext
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfWeek, addDays, format } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

// Re-export types and utils for backward compatibility
export type { ViewMode, SwapRequestStatus, Employee, Shift, SwapRequest, DayKPI, ScheduleData, Location } from './scheduling/types';
export { resolveLocationId } from './scheduling/utils';

// Internal imports
import type { Shift, SwapRequest, ScheduleData } from './scheduling/types';
import { buildDailyKPIs } from './scheduling/utils';
import {
  fetchLocations,
  fetchEmployees,
  fetchShifts,
  fetchForecastMetrics,
  fetchTargetCol,
  fetchActualSales,
  checkForecastExists,
  generateForecast,
} from './scheduling/queries';

// ── Intelligent Shift Assignment Algorithm ──────────────────
interface ShiftAssignment {
  employeeId: string;
  role: string;
  startTime: string;
  endTime: string;
  hours: number;
  hourlyCost: number;
}

interface SchedulingConfig {
  openingTime: string;         // e.g. "09:00"
  closingTime: string;         // e.g. "01:00"
  maxHoursPerDay: number;      // e.g. 10
  maxWeeklyHours: number;      // e.g. 40
  demandCurve: Record<string, number>;  // hour→pct of daily sales
  staffingRatios: Record<string, number>; // role→covers/hour capacity
  closedDays: number[];
}

const DEFAULT_CONFIG: SchedulingConfig = {
  openingTime: '09:00',
  closingTime: '01:00',
  maxHoursPerDay: 10,
  maxWeeklyHours: 40,
  demandCurve: {
    '9': 0.01, '10': 0.02, '11': 0.04, '12': 0.07,
    '13': 0.14, '14': 0.15, '15': 0.08, '16': 0.03,
    '17': 0.03, '18': 0.04, '19': 0.05, '20': 0.10,
    '21': 0.12, '22': 0.09, '23': 0.03,
  },
  staffingRatios: { Chef: 12, Server: 16, Bartender: 25, Host: 40, Manager: 999 },
  closedDays: [],
};

// Department classification
function getDeptForRole(role: string | null): 'BOH' | 'FOH' {
  const r = (role || '').toLowerCase();
  if (['cook', 'cocinero', 'cocinero/a', 'chef', 'dishwasher', 'friegaplatos', 'prep'].includes(r)) return 'BOH';
  return 'FOH';
}

// Build daypart shift blocks from the demand curve
interface DaypartBlock {
  label: string;
  start: string;
  end: string;
  hours: number;
  demandWeight: number; // fraction of daily sales in this block
}

function buildDayparts(config: SchedulingConfig, dayOfWeek: number): DaypartBlock[] {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const curve = config.demandCurve;
  const openHour = parseInt(config.openingTime.split(':')[0]);
  let closeHour = parseInt(config.closingTime.split(':')[0]);
  if (closeHour <= openHour) closeHour += 24; // wrap past midnight

  // Aggregate demand into 3 natural dayparts
  let morningWt = 0, afternoonWt = 0, eveningWt = 0;
  for (let h = openHour; h < closeHour && h < 24; h++) {
    const wt = curve[String(h)] || 0;
    if (h < 14) morningWt += wt;
    else if (h < 18) afternoonWt += wt;
    else eveningWt += wt;
  }

  // If demand curve data exists use it, else fallback to equal splits
  const totalWt = morningWt + afternoonWt + eveningWt;

  const dayparts: DaypartBlock[] = [];

  if (totalWt > 0) {
    if (morningWt > 0.01) {
      dayparts.push({
        label: 'morning',
        start: isWeekend ? '10:00' : `${String(openHour).padStart(2, '0')}:00`,
        end: '14:00',
        hours: isWeekend ? 4 : Math.min(14 - openHour, 8),
        demandWeight: morningWt / totalWt,
      });
    }
    if (afternoonWt > 0.01) {
      dayparts.push({
        label: 'afternoon',
        start: '14:00',
        end: '18:00',
        hours: 4,
        demandWeight: afternoonWt / totalWt,
      });
    }
    if (eveningWt > 0.01) {
      const closeStr = closeHour >= 24
        ? `${String(closeHour - 24).padStart(2, '0')}:00`
        : `${String(closeHour).padStart(2, '0')}:00`;
      dayparts.push({
        label: 'evening',
        start: '18:00',
        end: closeStr,
        hours: Math.min(closeHour - 18, 8),
        demandWeight: eveningWt / totalWt,
      });
    }
  }

  // Fallback: simple split if no dayparts generated
  if (dayparts.length === 0) {
    dayparts.push(
      { label: 'morning', start: isWeekend ? '10:00' : '09:00', end: '15:00', hours: isWeekend ? 5 : 6, demandWeight: 0.35 },
      { label: 'evening', start: '17:00', end: '23:00', hours: 6, demandWeight: 0.65 },
    );
  }

  return dayparts;
}

/**
 * Intelligent shift assignment:
 * 1. Splits the day into dayparts using the demand curve
 * 2. Allocates target hours proportionally to each daypart
 * 3. Within each daypart, ensures BOH + FOH coverage
 * 4. Sorts employees by cost (cheapest first)
 * 5. Respects availability + max daily/weekly hours
 * 6. Allows split shifts (employee works 2 dayparts)
 */
function calculateShiftAssignments(
  employees: Array<{ id: string; full_name: string; role_name: string | null; hourly_cost: number | null }>,
  targetHours: number,
  dayOfWeek: number,
  availMap: Map<string, Map<number, { start: string; end: string }>>,
  config: SchedulingConfig = DEFAULT_CONFIG,
  weeklyHoursUsed: Map<string, number> = new Map(),
): ShiftAssignment[] {
  const assignments: ShiftAssignment[] = [];
  const dayparts = buildDayparts(config, dayOfWeek);

  // Track hours assigned today per employee
  const dailyHours = new Map<string, number>();

  // Separate employees by department then sort by cost (ascending)
  const bohEmps = employees.filter(e => getDeptForRole(e.role_name) === 'BOH')
    .sort((a, b) => (a.hourly_cost || 12) - (b.hourly_cost || 12));
  const fohEmps = employees.filter(e => getDeptForRole(e.role_name) === 'FOH')
    .sort((a, b) => (a.hourly_cost || 12) - (b.hourly_cost || 12));

  // If all employees are in one department, treat as mixed
  const hasBothDepts = bohEmps.length > 0 && fohEmps.length > 0;
  const bohRatio = hasBothDepts ? 0.4 : 0.0; // 40% kitchen, 60% front

  for (const dp of dayparts) {
    // Hours to allocate in this daypart
    const dpHours = Math.round(targetHours * dp.demandWeight);
    if (dpHours <= 0) continue;

    // How many people do we need for this daypart?
    const staffNeeded = Math.max(2, Math.ceil(dpHours / dp.hours));
    const bohNeeded = hasBothDepts ? Math.max(1, Math.round(staffNeeded * bohRatio)) : 0;
    const fohNeeded = hasBothDepts ? Math.max(1, staffNeeded - bohNeeded) : staffNeeded;

    const assignGroup = (pool: typeof employees, needed: number) => {
      let assigned = 0;
      for (const emp of pool) {
        if (assigned >= needed) break;

        // Check max weekly hours
        const weeklyUsed = (weeklyHoursUsed.get(emp.id) || 0) + (dailyHours.get(emp.id) || 0);
        if (weeklyUsed >= config.maxWeeklyHours) continue;

        // Check max daily hours
        const todayUsed = dailyHours.get(emp.id) || 0;
        if (todayUsed >= config.maxHoursPerDay) continue;

        // Check availability
        const empAvail = availMap.get(emp.id);
        if (empAvail && empAvail.size > 0 && !empAvail.has(dayOfWeek)) continue;

        // Check availability time window if present
        if (empAvail && empAvail.has(dayOfWeek)) {
          const avail = empAvail.get(dayOfWeek)!;
          const dpStartH = parseInt(dp.start.split(':')[0]);
          const availStartH = parseInt(avail.start.split(':')[0]);
          // Skip if employee isn't available before the daypart starts
          if (availStartH > dpStartH + 1) continue;
        }

        // Already has a shift in this exact time slot?
        const hasOverlap = assignments.some(a =>
          a.employeeId === emp.id && a.startTime === dp.start
        );
        if (hasOverlap) continue;

        // Calculate actual hours considering remaining capacity
        const remainingWeekly = config.maxWeeklyHours - weeklyUsed;
        const remainingDaily = config.maxHoursPerDay - todayUsed;
        const shiftHours = Math.min(dp.hours, remainingWeekly, remainingDaily);

        if (shiftHours < 2) continue; // Don't create shifts shorter than 2h

        // Adjust end time if partial
        let endTime = dp.end;
        if (shiftHours < dp.hours) {
          const startHour = parseInt(dp.start.split(':')[0]);
          const endHour = startHour + shiftHours;
          endTime = `${String(endHour % 24).padStart(2, '0')}:00`;
        }

        assignments.push({
          employeeId: emp.id,
          role: emp.role_name || 'Team Member',
          startTime: dp.start,
          endTime: endTime,
          hours: shiftHours,
          hourlyCost: emp.hourly_cost || 12,
        });

        dailyHours.set(emp.id, todayUsed + shiftHours);
        assigned++;
      }
    };

    // Assign BOH first then FOH
    if (hasBothDepts) {
      assignGroup(bohEmps, bohNeeded);
      assignGroup(fohEmps, fohNeeded);
    } else {
      // All employees in one pool (sorted by cost)
      const sortedAll = [...employees].sort((a, b) => (a.hourly_cost || 12) - (b.hourly_cost || 12));
      assignGroup(sortedAll, staffNeeded);
    }
  }

  return assignments;
}



export function useSchedulingSupabase(
  locationId: string | null,
  weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })
) {
  const queryClient = useQueryClient();
  const { dataSource } = useApp();
  const [hasSchedule, setHasSchedule] = useState(false);
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, { employeeId: string; date: string }>>({});
  const [newShifts, setNewShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [forecastGenerating, setForecastGenerating] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekStartISO = format(weekStart, 'yyyy-MM-dd');
  const weekEndISO = format(weekEnd, 'yyyy-MM-dd');

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['scheduling-locations'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  });

  // Check if forecast exists and generate if missing
  const { data: forecastExists = true, refetch: refetchForecastCheck } = useQuery({
    queryKey: ['scheduling-forecast-check', locationId],
    queryFn: () => checkForecastExists(locationId!),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });

  // Auto-generate forecast if missing
  useEffect(() => {
    if (locationId && forecastExists === false && !forecastGenerating) {
      setForecastGenerating(true);
      console.log('[useSchedulingSupabase] Forecast missing, auto-generating...');

      generateForecast(locationId).then(success => {
        setForecastGenerating(false);
        if (success) {
          // Refetch forecast data
          queryClient.invalidateQueries({ queryKey: ['scheduling-forecast', locationId] });
          refetchForecastCheck();
        } else {
          toast.error('No se pudo generar el forecast. Intenta de nuevo.');
        }
      });
    }
  }, [locationId, forecastExists, forecastGenerating, queryClient, refetchForecastCheck]);

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['scheduling-employees', locationId],
    queryFn: () => fetchEmployees(locationId!),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });

  // Fetch shifts
  const { data: dbShifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['scheduling-shifts', locationId, weekStartISO],
    queryFn: () => fetchShifts(locationId!, weekStartISO, weekEndISO),
    enabled: !!locationId,
    staleTime: 30 * 1000,
  });

  // Fetch forecast metrics
  const { data: forecastByDate = {}, isLoading: forecastLoading, refetch: refetchForecast } = useQuery({
    queryKey: ['scheduling-forecast', locationId, weekStartISO],
    queryFn: () => fetchForecastMetrics(locationId!, weekStartISO, weekEndISO),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });

  // Fetch target COL%
  const { data: targetColPercent = 22 } = useQuery({
    queryKey: ['scheduling-target-col', locationId],
    queryFn: () => fetchTargetCol(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch actual sales from sales_daily_unified (for past days comparison)
  const { data: actualByDate = {} } = useQuery({
    queryKey: ['scheduling-actual-sales', locationId, weekStartISO, dataSource],
    queryFn: () => fetchActualSales(locationId!, weekStartISO, weekEndISO, dataSource),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });

  const isLoading = employeesLoading || shiftsLoading || forecastLoading || forecastGenerating;

  // Auto-detect existing shifts in DB and set hasSchedule accordingly
  const hasShiftsInDB = dbShifts.length > 0;
  useEffect(() => {
    if (hasShiftsInDB && !hasSchedule) {
      setHasSchedule(true);
    }
  }, [hasShiftsInDB, hasSchedule]);

  const data = useMemo((): ScheduleData | null => {
    if (!locationId || (!hasSchedule && !hasShiftsInDB)) return null;

    const location = locations.find(l => l.id === locationId);
    if (!location) return null;

    // Apply shift overrides and add new shifts
    let allShifts = dbShifts.map(shift => {
      const override = shiftOverrides[shift.id];
      if (override) {
        return { ...shift, employeeId: override.employeeId, date: override.date };
      }
      return shift;
    });
    allShifts = [...allShifts, ...newShifts];

    // Separate regular shifts from open shifts (OPEN - prefix employees)
    const openEmployeeIds = new Set(
      employees.filter(e => e.name.startsWith('OPEN -')).map(e => e.id)
    );

    const regularShifts = allShifts.filter(s => s.employeeId && !openEmployeeIds.has(s.employeeId));
    const openShifts = allShifts.filter(s => !s.employeeId || openEmployeeIds.has(s.employeeId) || s.isOpen);

    // Calculate employee weekly hours and derive availability from actual shifts
    const employeesWithHours = employees.map(emp => {
      const empShifts = regularShifts.filter(s => s.employeeId === emp.id);
      // Sum hours correctly even when employee has multiple shifts per day
      const weeklyHours = Math.round(empShifts.reduce((sum, s) => sum + s.hours, 0) * 10) / 10;

      // Derive availability from actual shifts
      const availability: Record<string, 'available' | 'unavailable' | 'day_off' | 'time_off' | 'preferred'> = {};
      for (let d = 0; d < 7; d++) {
        const dayDate = format(addDays(weekStart, d), 'yyyy-MM-dd');
        const hasShift = empShifts.some(s => s.date === dayDate);
        availability[d.toString()] = hasShift ? 'available' : 'day_off';
      }

      return { ...emp, weeklyHours, availability };
    });

    // Build KPIs with actual sales data
    const dailyKPIs = buildDailyKPIs(weekStart, forecastByDate, regularShifts, actualByDate);

    // Calculate totals
    const projectedSales = dailyKPIs.reduce((sum, d) => sum + d.forecastSales, 0);
    const projectedLabourCost = dailyKPIs.reduce((sum, d) => sum + d.forecastLaborCost, 0);
    const projectedColPercent = projectedSales > 0
      ? Math.round((projectedLabourCost / projectedSales) * 1000) / 10
      : 0;

    const totalShiftsCost = dailyKPIs.reduce((sum, d) => sum + d.shiftsCost, 0);
    const totalShiftsHours = dailyKPIs.reduce((sum, d) => sum + d.shiftsHours, 0);
    const totalVarianceCost = totalShiftsCost - projectedLabourCost;
    const totalVarianceCostPct = projectedLabourCost > 0
      ? Math.round((totalVarianceCost / projectedLabourCost) * 1000) / 10
      : 0;

    // Calculate total actual sales (for past days only)
    const totalActualSales = dailyKPIs
      .filter(d => d.isPastDay && d.actualSales !== undefined)
      .reduce((sum, d) => sum + (d.actualSales || 0), 0);
    const totalActualLaborCost = dailyKPIs
      .filter(d => d.isPastDay && d.actualLaborCost !== undefined)
      .reduce((sum, d) => sum + (d.actualLaborCost || 0), 0);

    const totalHours = regularShifts.reduce((sum, s) => sum + s.hours, 0)
      + openShifts.reduce((sum, s) => sum + s.hours, 0);

    // Count employees missing payroll (no hourly_cost)
    const missingPayrollCount = employees.filter(e => e.hourlyRate === null).length;

    // Efficiency metrics
    const splh = totalShiftsHours > 0
      ? Math.round((projectedSales / totalShiftsHours) * 100) / 100
      : 0;
    // Estimate OPLH from sales / average check size (~€25)
    const estimatedOrders = projectedSales / 25;
    const oplh = totalShiftsHours > 0
      ? Math.round((estimatedOrders / totalShiftsHours) * 100) / 100
      : 0;
    // COL% based on actual scheduled shifts cost (not forecast labor)
    const scheduledColPercent = projectedSales > 0
      ? Math.round((totalShiftsCost / projectedSales) * 1000) / 10
      : 0;
    // Target cost = forecast sales × target COL%
    const targetCost = Math.round(projectedSales * (targetColPercent / 100));

    return {
      locationId,
      locationName: location.name,
      weekStart,
      weekEnd,
      employees: employeesWithHours,
      shifts: regularShifts,
      openShifts,
      dailyKPIs,
      projectedSales,
      projectedLabourCost,
      projectedColPercent,
      totalShiftsCost,
      totalShiftsHours,
      totalVarianceCost,
      totalVarianceCostPct,
      targetColPercent,
      targetCost,
      totalHours: Math.round(totalHours * 10) / 10,
      status: (() => {
        const shiftStatuses = allShifts.map(s => s.status || 'draft');
        if (shiftStatuses.length > 0) {
          if (shiftStatuses.every(s => s === 'published')) return 'published' as const;
          if (shiftStatuses.every(s => s === 'approved' || s === 'published')) return 'approved' as const;
        }
        return 'draft' as const;
      })(),
      timeOffConflicts: 0,
      missingPayrollCount,
      // Actual totals for past days
      totalActualSales,
      totalActualLaborCost,
      // Efficiency metrics
      splh,
      oplh,
      scheduledColPercent,
    };
  }, [
    locationId, hasSchedule, locations, employees, dbShifts,
    forecastByDate, weekStart, weekEnd, shiftOverrides, newShifts, targetColPercent, actualByDate
  ]);

  // Create schedule - calls Edge Function to generate real shifts
  const createSchedule = useCallback(async () => {
    if (!locationId) {
      toast.error('No location selected');
      return;
    }

    try {
      console.log('[createSchedule] Starting client-side generation for', locationId, weekStartISO);

      // ── Step 1: Gather raw materials ──────────────────────────
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndISO = format(weekEndDate, 'yyyy-MM-dd');

      // Fetch forecast for the week
      const { data: forecastRows } = await supabase
        .from('forecast_daily_metrics')
        .select('date, forecast_sales, planned_labor_hours')
        .eq('location_id', locationId)
        .gte('date', weekStartISO)
        .lte('date', weekEndISO);

      // Fetch active employees for this location
      const { data: empRows } = await supabase
        .from('employees')
        .select('id, full_name, role_name, hourly_cost')
        .eq('location_id', locationId)
        .eq('active', true);

      // Fetch availability
      const { data: availRows } = await supabase
        .from('employee_availability')
        .select('employee_id, day_of_week, start_time, end_time, is_available')
        .eq('location_id', locationId)
        .eq('is_available', true);

      // Fetch target settings (full settings for smart algorithm)
      const { data: settingsRaw } = await (supabase as any)
        .from('location_settings')
        .select('splh_goal, target_col_percent, opening_time, closing_time, closed_days, max_hours_per_day, hourly_demand_curve, staffing_ratios')
        .eq('location_id', locationId)
        .maybeSingle();
      const settings = settingsRaw as Record<string, any> | null;

      const splhGoal = settings?.splh_goal || 50;
      const targetCol = settings?.target_col_percent || 30;

      // Build SchedulingConfig from DB settings
      const schedConfig: SchedulingConfig = {
        openingTime: (settings?.opening_time || '09:00:00').substring(0, 5),
        closingTime: (settings?.closing_time || '01:00:00').substring(0, 5),
        maxHoursPerDay: settings?.max_hours_per_day || 10,
        maxWeeklyHours: 40,
        demandCurve: settings?.hourly_demand_curve || DEFAULT_CONFIG.demandCurve,
        staffingRatios: settings?.staffing_ratios || DEFAULT_CONFIG.staffingRatios,
        closedDays: settings?.closed_days || [],
      };

      // ── Step 2: Diagnostic checks ─────────────────────────────
      const diagWarnings: string[] = [];

      if (!forecastRows || forecastRows.length === 0) {
        diagWarnings.push('0 horas: No hay ventas proyectadas cargadas para esta semana.');
      }

      if (!empRows || empRows.length === 0) {
        diagWarnings.push('0 horas: No hay empleados activos asignados a este local.');
        toast.error(diagWarnings.join(' '));
        return;
      }

      if (!availRows || availRows.length === 0) {
        diagWarnings.push('Sin disponibilidad registrada — usando horario comercial por defecto.');
      }

      // ── Step 3: Build availability index ──────────────────────
      // Map: employee_id -> Set of day_of_week where available
      const availMap = new Map<string, Map<number, { start: string; end: string }>>();
      (availRows || []).forEach(a => {
        if (!availMap.has(a.employee_id)) availMap.set(a.employee_id, new Map());
        availMap.get(a.employee_id)!.set(a.day_of_week, {
          start: a.start_time,
          end: a.end_time,
        });
      });

      // ── Step 4: Generate shifts per day ───────────────────────
      const shiftsToInsert: Array<{
        employee_id: string;
        location_id: string;
        shift_date: string;
        start_time: string;
        end_time: string;
        planned_hours: number;
        planned_cost: number;
        role: string;
        status: string;
      }> = [];

      let totalHours = 0;
      let totalCost = 0;
      let totalForecastSales = 0;

      // Track weekly hours per employee across all 7 days
      const weeklyHoursUsed = new Map<string, number>();

      // For each day of the week
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + d);
        const dayISO = format(dayDate, 'yyyy-MM-dd');
        const dayOfWeek = dayDate.getDay(); // 0=Sun, 1=Mon, ...

        // Skip closed days
        if (schedConfig.closedDays.includes(dayOfWeek)) {
          continue;
        }

        // Get forecast for this day
        const forecast = forecastRows?.find(f => f.date === dayISO);
        const forecastSales = forecast?.forecast_sales || 0;
        const plannedHours = forecast?.planned_labor_hours || 0;
        totalForecastSales += forecastSales;

        // Calculate target hours from SPLH goal
        // Target hours = forecast_sales / splh_goal
        let targetHoursForDay = forecastSales > 0 ? Math.round(forecastSales / splhGoal) : 0;

        // Fallback: if no forecast, use baseline of 2 staff minimum for 8 hours
        if (targetHoursForDay === 0 && forecastSales === 0) {
          targetHoursForDay = 16; // 2 people × 8 hours as baseline
        }

        // Budget cap: target_col_percent of forecast sales / avg hourly rate
        const avgHourlyCost = empRows.reduce((sum, e) => sum + (e.hourly_cost || 12), 0) / empRows.length;
        const maxBudgetHours = forecastSales > 0
          ? Math.floor((forecastSales * targetCol / 100) / avgHourlyCost)
          : targetHoursForDay;

        // Use the lower of target vs budget
        const hoursToAllocate = Math.min(targetHoursForDay, maxBudgetHours);

        if (hoursToAllocate <= 0) {
          diagWarnings.push(`${dayISO}: El presupuesto (Target COL% ${targetCol}%) es demasiado bajo para cubrir un turno mínimo.`);
          continue;
        }

        // Get available employees for this day
        const availableEmps = empRows.filter(emp => {
          const empAvail = availMap.get(emp.id);
          // If no availability data, assume available (fallback)
          if (!empAvail || empAvail.size === 0) return true;
          return empAvail.has(dayOfWeek);
        });

        if (availableEmps.length === 0) {
          diagWarnings.push(`${dayISO}: No hay empleados disponibles.`);
          continue;
        }

        // ── Smart shift assignment (uses demand curve, role coverage, cost optimization) ──
        const shifts = calculateShiftAssignments(
          availableEmps,
          hoursToAllocate,
          dayOfWeek,
          availMap,
          schedConfig,
          weeklyHoursUsed,
        );

        shifts.forEach(shift => {
          const hours = shift.hours;
          const cost = hours * (shift.hourlyCost || 12);
          shiftsToInsert.push({
            employee_id: shift.employeeId,
            location_id: locationId,
            shift_date: dayISO,
            start_time: shift.startTime,
            end_time: shift.endTime,
            planned_hours: hours,
            planned_cost: cost,
            role: shift.role || 'Team Member',
            status: 'draft',
          });
          totalHours += hours;
          totalCost += cost;
          // Accumulate weekly hours for next day's constraint checking
          weeklyHoursUsed.set(shift.employeeId, (weeklyHoursUsed.get(shift.employeeId) || 0) + hours);
        });
      }

      // ── Step 5: Insert shifts into database ───────────────────
      if (shiftsToInsert.length === 0) {
        const reason = diagWarnings.length > 0
          ? diagWarnings[0]
          : '0 horas: No se pudieron asignar turnos. Verifica forecast y disponibilidad.';
        toast.error(reason);
        return;
      }

      // Delete existing draft shifts for this week first
      await supabase
        .from('planned_shifts')
        .delete()
        .eq('location_id', locationId)
        .eq('status', 'draft')
        .gte('shift_date', weekStartISO)
        .lte('shift_date', weekEndISO);

      // Insert new shifts
      const { error: insertError } = await supabase
        .from('planned_shifts')
        .insert(shiftsToInsert as any);

      if (insertError) {
        console.error('[createSchedule] Insert error:', insertError);
        toast.error(`Error insertando turnos: ${insertError.message}`);
        return;
      }

      // ── Step 6: Refresh UI ────────────────────────────────────
      await refetchShifts();
      setShiftOverrides({});
      setNewShifts([]);
      setHasSchedule(true);

      const colPercent = totalForecastSales > 0
        ? ((totalCost / totalForecastSales) * 100).toFixed(1)
        : '—';
      const colStatus = Number(colPercent) <= targetCol ? '✓' : `⚠ (objetivo ${targetCol}%)`;

      toast.success(
        `Creados ${shiftsToInsert.length} turnos (${totalHours}h) • COL% ${colPercent}% ${colStatus}`,
        { duration: 5000 }
      );

      if (diagWarnings.length > 0) {
        console.warn('[createSchedule] Warnings:', diagWarnings);
        toast.warning(diagWarnings[0], { duration: 4000 });
      }

      console.log('[createSchedule] Complete:', {
        shifts: shiftsToInsert.length,
        totalHours,
        totalCost,
        totalForecastSales,
        colPercent,
      });

    } catch (err) {
      console.error('[createSchedule] Exception:', err);
      toast.error('Error al generar el horario');
    }
  }, [locationId, weekStartISO, weekStart, refetchShifts]);

  const undoSchedule = useCallback(() => {
    setHasSchedule(false);
    setShiftOverrides({});
    setNewShifts([]);
  }, []);

  const acceptSchedule = useCallback(() => {
    // Accept current state - shifts are already in DB
    toast.success('Horario aceptado');
  }, []);

  // Approve schedule: draft → approved (Owner action)
  const approveSchedule = useCallback(async () => {
    if (!locationId) return;

    try {
      const { error } = await supabase
        .from('planned_shifts')
        .update({ status: 'approved' })
        .eq('location_id', locationId)
        .gte('shift_date', weekStartISO)
        .lte('shift_date', weekEndISO)
        .eq('status', 'draft');

      if (error) {
        console.error('[approveSchedule] Error:', error);
        toast.error('Error al aprobar el horario');
        return;
      }

      await refetchShifts();
      toast.success('Horario aprobado — listo para publicar');
    } catch (err) {
      console.error('[approveSchedule] Exception:', err);
      toast.error('Error al aprobar');
    }
  }, [locationId, weekStartISO, weekEndISO, refetchShifts]);

  // Publish schedule: approved → published (Manager action)
  // Also handles direct draft → published for backwards compatibility
  const publishSchedule = useCallback(async (emailBody?: string) => {
    if (!locationId) return;

    try {
      // Update approved OR draft shifts to published
      const { error } = await supabase
        .from('planned_shifts')
        .update({ status: 'published' })
        .eq('location_id', locationId)
        .gte('shift_date', weekStartISO)
        .lte('shift_date', weekEndISO)
        .in('status', ['draft', 'approved']);

      if (error) {
        console.error('[publishSchedule] Error:', error);
        toast.error('Error al publicar el horario');
        return;
      }

      await refetchShifts();
      toast.success('Horario publicado');

    } catch (err) {
      console.error('[publishSchedule] Exception:', err);
      toast.error('Error al publicar');
    }
  }, [locationId, weekStartISO, weekEndISO, refetchShifts]);

  const moveShift = useCallback((shiftId: string, toEmployeeId: string, toDate: string) => {
    setShiftOverrides(prev => ({
      ...prev,
      [shiftId]: { employeeId: toEmployeeId, date: toDate },
    }));
  }, []);

  const addShift = useCallback((shift: Omit<Shift, 'id'>) => {
    const newShift: Shift = {
      ...shift,
      id: `new-shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setNewShifts(prev => [...prev, newShift]);
    return newShift;
  }, []);

  // Swap request handlers (local state for now)
  const createSwapRequest = useCallback((requesterShift: Shift, targetShift: Shift, reason?: string) => {
    if (!data) return;

    const requester = data.employees.find(e => e.id === requesterShift.employeeId);
    const target = data.employees.find(e => e.id === targetShift.employeeId);

    if (!requester || !target) return;

    const newRequest: SwapRequest = {
      id: `swap-${Date.now()}`,
      requesterId: requester.id,
      requesterName: requester.name,
      requesterInitials: requester.initials,
      requesterShiftId: requesterShift.id,
      requesterShiftDate: requesterShift.date,
      requesterShiftTime: `${requesterShift.startTime} - ${requesterShift.endTime}`,
      targetId: target.id,
      targetName: target.name,
      targetInitials: target.initials,
      targetShiftId: targetShift.id,
      targetShiftDate: targetShift.date,
      targetShiftTime: `${targetShift.startTime} - ${targetShift.endTime}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reason,
    };

    setSwapRequests(prev => [...prev, newRequest]);
    return newRequest;
  }, [data]);

  const approveSwapRequest = useCallback((requestId: string) => {
    const request = swapRequests.find(r => r.id === requestId);
    if (!request) return;

    setShiftOverrides(prev => ({
      ...prev,
      [request.requesterShiftId]: { employeeId: request.targetId, date: request.requesterShiftDate },
      [request.targetShiftId]: { employeeId: request.requesterId, date: request.targetShiftDate },
    }));

    setSwapRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r)
    );
  }, [swapRequests]);

  const rejectSwapRequest = useCallback((requestId: string) => {
    setSwapRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'rejected' as const } : r)
    );
  }, []);

  const pendingSwapRequests = swapRequests.filter(r => r.status === 'pending');
  const hasChanges = Object.keys(shiftOverrides).length > 0 || newShifts.length > 0;

  // Get positions from employee roles
  const positions = useMemo(() => {
    const roleSet = new Set(employees.map(e => e.position));
    return Array.from(roleSet);
  }, [employees]);

  return {
    data,
    isLoading,
    hasSchedule,
    hasChanges,
    locations,
    positions,
    swapRequests,
    pendingSwapRequests,
    timeOffConflicts: 0,
    forecastGenerating,
    createSchedule,
    undoSchedule,
    acceptSchedule,
    approveSchedule,
    publishSchedule,
    moveShift,
    addShift,
    createSwapRequest,
    approveSwapRequest,
    rejectSwapRequest,
  };
}
