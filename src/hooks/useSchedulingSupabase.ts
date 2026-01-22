import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, addDays, format, parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type ViewMode = 'departments' | 'people' | 'positions' | 'stations';

export type SwapRequestStatus = 'pending' | 'approved' | 'rejected';

export interface Employee {
  id: string;
  name: string;
  initials: string;
  department: string;
  position: string;
  station: string;
  weeklyHours: number;
  targetHours: number;
  hourlyRate: number | null;
  availability: Record<string, 'available' | 'unavailable' | 'day_off' | 'time_off' | 'preferred'>;
  timeOffInfo?: Record<string, any>;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  role: string;
  plannedCost: number | null;
  isOpen?: boolean;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterInitials: string;
  requesterShiftId: string;
  requesterShiftDate: string;
  requesterShiftTime: string;
  targetId: string;
  targetName: string;
  targetInitials: string;
  targetShiftId: string;
  targetShiftDate: string;
  targetShiftTime: string;
  status: SwapRequestStatus;
  createdAt: string;
  reason?: string;
}

export interface DayKPI {
  date: string;
  dayName: string;
  // Forecast data (plan)
  forecastSales: number;
  forecastLaborCost: number;
  forecastLaborHours: number;
  forecastColPercent: number;
  // Shifts data (scheduled)
  shiftsCost: number;
  shiftsHours: number;
  shiftsCount: number;
  // Variance
  varianceCost: number;
  varianceCostPct: number;
  // Legacy fields for UI compatibility
  sales: number;
  cost: number;
  colPercent: number;
  hours: number;
}

export interface ScheduleData {
  locationId: string;
  locationName: string;
  weekStart: Date;
  weekEnd: Date;
  employees: Employee[];
  shifts: Shift[];
  openShifts: Shift[];
  dailyKPIs: DayKPI[];
  // Forecast totals (plan)
  projectedSales: number;
  projectedLabourCost: number;
  projectedColPercent: number;
  // Shifts totals (scheduled)
  totalShiftsCost: number;
  totalShiftsHours: number;
  // Variance
  totalVarianceCost: number;
  totalVarianceCostPct: number;
  // Target
  targetColPercent: number;
  totalHours: number;
  status: 'draft' | 'published';
  timeOffConflicts: number;
  // Missing payroll flag
  missingPayrollCount: number;
}

export interface Location {
  id: string;
  name: string;
}

const DEPARTMENTS = ['Management', 'BOH', 'FOH'];
const STATIONS = ['Grill', 'Prep', 'Bar', 'Floor', 'Counter', 'Drive-thru'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Fetch locations from DB
async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .order('name');
  
  if (error) throw error;
  return data || [];
}

// Fetch employees for a location
async function fetchEmployees(locationId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, role_name, hourly_cost, active')
    .eq('location_id', locationId)
    .eq('active', true);
  
  if (error) throw error;
  
  return (data || []).map((emp, idx) => {
    const nameParts = emp.full_name.split(' ');
    const initials = nameParts.length >= 2 
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : emp.full_name.substring(0, 2).toUpperCase();
    
    // Assign pseudo-random department/station based on role or index
    const department = DEPARTMENTS[idx % DEPARTMENTS.length];
    const station = STATIONS[idx % STATIONS.length];
    
    return {
      id: emp.id,
      name: emp.full_name,
      initials,
      department,
      position: emp.role_name || 'Team Member',
      station,
      weeklyHours: 0, // Will be calculated from shifts
      targetHours: 40,
      hourlyRate: emp.hourly_cost,
      availability: {}, // Default available
      timeOffInfo: undefined,
    };
  });
}

// Fetch shifts for a location and week
async function fetchShifts(
  locationId: string, 
  weekStartISO: string, 
  weekEndISO: string
): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('planned_shifts')
    .select('id, employee_id, shift_date, start_time, end_time, planned_hours, planned_cost, role, status')
    .eq('location_id', locationId)
    .gte('shift_date', weekStartISO)
    .lte('shift_date', weekEndISO);
  
  if (error) throw error;
  
  return (data || []).map(shift => {
    // Format time from "HH:MM:SS" to "HH:MM"
    const formatTime = (t: string) => t ? t.substring(0, 5) : '09:00';
    
    return {
      id: shift.id,
      employeeId: shift.employee_id,
      date: shift.shift_date,
      startTime: formatTime(shift.start_time),
      endTime: formatTime(shift.end_time),
      hours: shift.planned_hours,
      role: shift.role || 'Team Member',
      plannedCost: shift.planned_cost,
      isOpen: !shift.employee_id,
    };
  });
}

// Fetch forecast metrics for a location and week
async function fetchForecastMetrics(
  locationId: string,
  weekStartISO: string,
  weekEndISO: string
): Promise<Record<string, { forecast_sales: number; planned_labor_cost: number; planned_labor_hours: number }>> {
  const { data, error } = await supabase
    .from('forecast_daily_metrics')
    .select('date, forecast_sales, planned_labor_cost, planned_labor_hours')
    .eq('location_id', locationId)
    .gte('date', weekStartISO)
    .lte('date', weekEndISO);
  
  if (error) throw error;
  
  const byDate: Record<string, any> = {};
  (data || []).forEach(row => {
    byDate[row.date] = row;
  });
  
  return byDate;
}

// Fetch target COL% from location_settings
async function fetchTargetCol(locationId: string): Promise<number> {
  const { data } = await supabase
    .from('location_settings')
    .select('target_col_percent')
    .eq('location_id', locationId)
    .maybeSingle();
  
  return data?.target_col_percent ?? 25; // Default 25%
}

// Build DayKPIs from forecast + shifts
function buildDailyKPIs(
  weekStart: Date,
  forecastByDate: Record<string, any>,
  shifts: Shift[]
): DayKPI[] {
  const kpis: DayKPI[] = [];
  
  // Aggregate shifts by date
  const shiftsByDate: Record<string, { cost: number; hours: number; count: number }> = {};
  shifts.forEach(shift => {
    if (!shiftsByDate[shift.date]) {
      shiftsByDate[shift.date] = { cost: 0, hours: 0, count: 0 };
    }
    shiftsByDate[shift.date].cost += shift.plannedCost || 0;
    shiftsByDate[shift.date].hours += shift.hours;
    shiftsByDate[shift.date].count += 1;
  });
  
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const forecast = forecastByDate[dateStr];
    const shiftsData = shiftsByDate[dateStr] || { cost: 0, hours: 0, count: 0 };
    
    const forecastSales = forecast?.forecast_sales || 0;
    const forecastLaborCost = forecast?.planned_labor_cost || 0;
    const forecastLaborHours = forecast?.planned_labor_hours || 0;
    const forecastColPercent = forecastSales > 0 
      ? Math.round((forecastLaborCost / forecastSales) * 1000) / 10 
      : 0;
    
    const varianceCost = shiftsData.cost - forecastLaborCost;
    const varianceCostPct = forecastLaborCost > 0 
      ? Math.round((varianceCost / forecastLaborCost) * 1000) / 10 
      : 0;
    
    kpis.push({
      date: dateStr,
      dayName: DAY_NAMES[i],
      // Forecast
      forecastSales,
      forecastLaborCost,
      forecastLaborHours,
      forecastColPercent,
      // Shifts
      shiftsCost: Math.round(shiftsData.cost * 100) / 100,
      shiftsHours: Math.round(shiftsData.hours * 10) / 10,
      shiftsCount: shiftsData.count,
      // Variance
      varianceCost: Math.round(varianceCost * 100) / 100,
      varianceCostPct,
      // Legacy UI fields (use forecast as "projected")
      sales: forecastSales,
      cost: forecastLaborCost,
      colPercent: forecastColPercent,
      hours: forecastLaborHours || shiftsData.hours,
    });
  }
  
  return kpis;
}

export function useSchedulingSupabase(
  locationId: string | null,
  weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })
) {
  const queryClient = useQueryClient();
  const [hasSchedule, setHasSchedule] = useState(false);
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, { employeeId: string; date: string }>>({});
  const [newShifts, setNewShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekStartISO = format(weekStart, 'yyyy-MM-dd');
  const weekEndISO = format(weekEnd, 'yyyy-MM-dd');
  
  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['scheduling-locations'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  });
  
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
  const { data: forecastByDate = {}, isLoading: forecastLoading } = useQuery({
    queryKey: ['scheduling-forecast', locationId, weekStartISO],
    queryFn: () => fetchForecastMetrics(locationId!, weekStartISO, weekEndISO),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });
  
  // Fetch target COL%
  const { data: targetColPercent = 25 } = useQuery({
    queryKey: ['scheduling-target-col', locationId],
    queryFn: () => fetchTargetCol(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });
  
  const isLoading = employeesLoading || shiftsLoading || forecastLoading;
  
  // Build schedule data
  const data = useMemo((): ScheduleData | null => {
    if (!locationId || !hasSchedule) return null;
    
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
    
    // Separate regular shifts from open shifts
    const regularShifts = allShifts.filter(s => s.employeeId && !s.isOpen);
    const openShifts = allShifts.filter(s => !s.employeeId || s.isOpen);
    
    // Calculate employee weekly hours
    const employeesWithHours = employees.map(emp => {
      const empShifts = regularShifts.filter(s => s.employeeId === emp.id);
      const weeklyHours = empShifts.reduce((sum, s) => sum + s.hours, 0);
      
      // Generate availability (default available for all days)
      const availability: Record<string, 'available' | 'unavailable' | 'day_off' | 'time_off' | 'preferred'> = {};
      for (let d = 0; d < 7; d++) {
        availability[d.toString()] = 'available';
      }
      
      return { ...emp, weeklyHours, availability };
    });
    
    // Build KPIs
    const dailyKPIs = buildDailyKPIs(weekStart, forecastByDate, regularShifts);
    
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
    
    const totalHours = regularShifts.reduce((sum, s) => sum + s.hours, 0) 
                     + openShifts.reduce((sum, s) => sum + s.hours, 0);
    
    // Count employees missing payroll (no hourly_cost)
    const missingPayrollCount = employees.filter(e => e.hourlyRate === null).length;
    
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
      totalHours: Math.round(totalHours * 10) / 10,
      status: 'draft',
      timeOffConflicts: 0,
      missingPayrollCount,
    };
  }, [
    locationId, hasSchedule, locations, employees, dbShifts, 
    forecastByDate, weekStart, weekEnd, shiftOverrides, newShifts, targetColPercent
  ]);
  
  // Create schedule (just reveals existing data)
  const createSchedule = useCallback(async () => {
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    setShiftOverrides({});
    setNewShifts([]);
    setHasSchedule(true);
  }, []);
  
  const undoSchedule = useCallback(() => {
    setHasSchedule(false);
    setShiftOverrides({});
    setNewShifts([]);
  }, []);
  
  const acceptSchedule = useCallback(() => {
    // Accept current state
  }, []);
  
  const publishSchedule = useCallback(async (emailBody?: string) => {
    // In real implementation, update planned_shifts status to 'published'
    await new Promise(resolve => setTimeout(resolve, 1500));
  }, []);
  
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
