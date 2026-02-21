// TODO: Migrate forecast_daily_metrics access to use get_labor_plan_unified RPC
// which resolves data_source via resolve_data_source(org_id) internally.
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

  // Build schedule data - show data if we have shifts OR hasSchedule flag
  const hasShiftsInDB = dbShifts.length > 0;

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
      status: 'draft',
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
      console.log('[createSchedule] Calling generate_schedule for', locationId, weekStartISO);

      // First ensure forecast exists
      const hasForecast = await checkForecastExists(locationId);
      if (!hasForecast) {
        toast.info('Generando forecast primero...');
        const forecastSuccess = await generateForecast(locationId);
        if (!forecastSuccess) {
          toast.error('Error generando forecast');
          return;
        }
        await refetchForecast();
      }

      const { data: result, error } = await supabase.functions.invoke('generate_schedule', {
        body: {
          location_id: locationId,
          week_start: weekStartISO
        }
      });

      if (error) {
        console.error('[createSchedule] Edge function error:', error);
        toast.error(`Error generando turnos: ${error.message}`);
        return;
      }

      if (result?.error) {
        console.error('[createSchedule] Result error:', result.error);
        toast.error(result.error);
        return;
      }

      console.log('[createSchedule] Success:', result);

      // Log summary to console
      if (result?.summary) {
        console.log('=== SCHEDULE SUMMARY ===');
        console.log(`Total Cost: €${result.summary.totalCost}`);
        console.log(`Forecast Sales: €${result.summary.totalForecastSales}`);
        console.log(`COL%: ${result.summary.colPercent}% (Target: ${result.summary.targetColPercent}%)`);
        console.log(`ACS (28d): €${result.summary.acs28d}`);
        console.log(`Avg Dwell Time: ${result.summary.avgDwellTime} min`);
        console.log(`Shifts by role:`, result.summary.shiftsByRole);
        console.log('========================');
      }

      // Refetch shifts from DB
      await refetchShifts();

      // Reset local overrides and show schedule
      setShiftOverrides({});
      setNewShifts([]);
      setHasSchedule(true);

      const colStatus = result.summary?.colPercent <= result.summary?.targetColPercent
        ? '✓'
        : `⚠ (objetivo ${result.summary?.targetColPercent}%)`;

      toast.success(
        `Creados ${result.shifts_created} turnos • COL% ${result.summary?.colPercent}% ${colStatus}`,
        { duration: 5000 }
      );

      if (result.warnings?.length > 0) {
        console.warn('[createSchedule] Warnings:', result.warnings);
        // Show first warning as toast
        toast.warning(result.warnings[0], { duration: 4000 });
      }

    } catch (err) {
      console.error('[createSchedule] Exception:', err);
      toast.error('Error al generar el horario');
    }
  }, [locationId, weekStartISO, refetchShifts, refetchForecast]);

  const undoSchedule = useCallback(() => {
    setHasSchedule(false);
    setShiftOverrides({});
    setNewShifts([]);
  }, []);

  const acceptSchedule = useCallback(() => {
    // Accept current state - shifts are already in DB
    toast.success('Horario aceptado');
  }, []);

  const publishSchedule = useCallback(async (emailBody?: string) => {
    if (!locationId) return;

    try {
      // Update all draft shifts to published status
      const { error } = await supabase
        .from('planned_shifts')
        .update({ status: 'published' })
        .eq('location_id', locationId)
        .gte('shift_date', weekStartISO)
        .lte('shift_date', weekEndISO)
        .eq('status', 'draft');

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
    publishSchedule,
    moveShift,
    addShift,
    createSwapRequest,
    approveSwapRequest,
    rejectSwapRequest,
  };
}
