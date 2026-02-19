// TODO: Migrate forecast_daily_metrics access to use get_labor_plan_unified RPC
// which resolves data_source via resolve_data_source(org_id) internally.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, addDays, format, parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
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
  // Variance (Shifts vs Forecast)
  varianceCost: number;
  varianceCostPct: number;
  // Actual data (from sales_daily_unified for past days)
  actualSales?: number;
  actualLaborCost?: number;
  actualColPercent?: number;
  // Variance Actual vs Forecast
  salesVarianceVsForecast?: number;
  salesVarianceVsForecastPct?: number;
  isPastDay?: boolean;
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
  // Actual totals (for past days)
  totalActualSales: number;
  totalActualLaborCost: number;
  // Target
  targetColPercent: number;
  targetCost: number;
  totalHours: number;
  status: 'draft' | 'published';
  timeOffConflicts: number;
  // Missing payroll flag
  missingPayrollCount: number;
  // Nory-style metrics
  splh: number;   // Sales Per Labor Hour
  oplh: number;   // Orders Per Labor Hour (estimated)
  scheduledColPercent: number; // COL% based on scheduled shifts (not forecast)
}

export interface Location {
  id: string;
  name: string;
}

const DEPARTMENTS = ['BOH', 'FOH'];
const STATIONS = ['Cocina', 'Prep', 'Bar', 'Sala', 'Limpieza'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Legacy location name mappings (for old URLs like /scheduling?location=southside)
const LEGACY_LOCATION_ALIASES: Record<string, string[]> = {
  'southside': ['southside', 'south'],
  'westside': ['westside', 'west'],
  'central': ['central', 'centro', 'downtown'],
  'hq': ['hq', 'headquarters', 'main'],
  'chamberi': ['chamberi', 'chamberí'],
  'malasana': ['malasana', 'malasaña'],
  'salamanca': ['salamanca'],
};

/**
 * Resolve a location parameter (UUID or legacy string) to a valid UUID
 * @param locationParam - The location parameter from URL (could be UUID or legacy string)
 * @param locations - Available locations from DB
 * @returns Valid UUID or null
 */
export function resolveLocationId(
  locationParam: string | null,
  locations: Location[]
): string | null {
  if (!locationParam || locations.length === 0) return null;
  
  // If it's already a valid UUID, check if it exists in locations
  if (UUID_REGEX.test(locationParam)) {
    const exists = locations.find(l => l.id === locationParam);
    return exists ? locationParam : locations[0]?.id || null;
  }
  
  // Try to match by legacy alias or partial name
  const lowerParam = locationParam.toLowerCase();
  
  // Check legacy aliases
  for (const [alias, variants] of Object.entries(LEGACY_LOCATION_ALIASES)) {
    if (variants.includes(lowerParam)) {
      const match = locations.find(l => 
        l.name.toLowerCase().includes(alias) ||
        l.name.toLowerCase().includes(lowerParam)
      );
      if (match) return match.id;
    }
  }
  
  // Direct partial name match
  const match = locations.find(l => 
    l.name.toLowerCase().includes(lowerParam) ||
    lowerParam.includes(l.name.toLowerCase())
  );
  
  if (match) return match.id;
  
  // Fallback to first location
  return locations[0]?.id || null;
}

// Fetch locations from DB
async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .order('name');
  
  if (error) throw error;
  return data || [];
}

// Fix double-UTF-8 encoding (mojibake): MarÃ­a → María, etc.
function fixEncoding(name: string): string {
  return name
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã\x81/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã\x8D/g, 'Í')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã'/g, 'Ñ');
}

// Nory-style department mapping: Kitchen, Front of House, Bar, Management
function getDepartment(roleName: string): string {
  const r = (roleName || '').toLowerCase();
  // Kitchen (BOH)
  if (['chef', 'cocinero/a', 'preparación', 'lavaplatos', 'prep cook', 'sous chef', 'chef de partida', 'dishwasher'].includes(r)) {
    return 'Kitchen';
  }
  // Bar
  if (['bartender', 'barra', 'barista'].includes(r)) {
    return 'Bar';
  }
  // Management
  if (['manager', 'gerente', 'general manager', 'duty manager', 'assistant manager'].includes(r)) {
    return 'Management';
  }
  // Front of House (default)
  return 'Front of House';
}

function getStation(roleName: string): string {
  const map: Record<string, string> = {
    'Chef': 'Cocina',
    'Cocinero/a': 'Cocina',
    'Sous Chef': 'Cocina',
    'Chef de Partida': 'Cocina',
    'Prep Cook': 'Prep',
    'Preparación': 'Prep',
    'Dishwasher': 'Cocina',
    'Lavaplatos': 'Cocina',
    'Server': 'Sala',
    'Camarero/a': 'Sala',
    'Bartender': 'Bar',
    'Barra': 'Bar',
    'Host': 'Sala',
    'Manager': 'Sala',
    'Gerente': 'Sala',
    'Limpieza': 'Limpieza',
  };
  return map[roleName] || 'Sala';
}

// Fetch employees for a location
async function fetchEmployees(locationId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, role_name, hourly_cost, active')
    .eq('location_id', locationId)
    .eq('active', true);
  
  if (error) throw error;
  
  // Filter out OPEN placeholder employees for display
  const filtered = (data || []).filter(e => !e.full_name.startsWith('OPEN -'));
  
  return filtered.map((emp) => {
    // Fix mojibake encoding in names
    const fixedName = fixEncoding(emp.full_name);
    
    const nameParts = fixedName.split(' ');
    const initials = nameParts.length >= 2 
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : fixedName.substring(0, 2).toUpperCase();
    
    const roleName = emp.role_name || 'Server';
    
    return {
      id: emp.id,
      name: fixedName,
      initials,
      department: getDepartment(roleName),
      position: roleName,
      station: getStation(roleName),
      weeklyHours: 0, // Will be calculated from shifts
      targetHours: 40,
      hourlyRate: emp.hourly_cost,
      availability: {}, // Derived from shifts below
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

// Fetch forecast metrics for a location and week (reads forecast_daily_unified contract view)
async function fetchForecastMetrics(
  locationId: string,
  weekStartISO: string,
  weekEndISO: string
): Promise<Record<string, { forecast_sales: number; planned_labor_cost: number; planned_labor_hours: number }>> {
  const { data, error } = await supabase
    .from('forecast_daily_unified' as any)
    .select('day, forecast_sales, planned_labor_cost, planned_labor_hours')
    .eq('location_id', locationId)
    .gte('day', weekStartISO)
    .lte('day', weekEndISO);

  if (error) throw error;

  const byDate: Record<string, any> = {};
  ((data as any[]) || []).forEach(row => {
    byDate[row.day] = {
      forecast_sales: Number(row.forecast_sales) || 0,
      planned_labor_cost: Number(row.planned_labor_cost) || 0,
      planned_labor_hours: Number(row.planned_labor_hours) || 0,
    };
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
  
  return data?.target_col_percent ?? 22; // Default 22%
}

// Fetch actual sales from sales_daily_unified (for past days comparison)
async function fetchActualSales(
  locationId: string,
  weekStartISO: string,
  weekEndISO: string,
  dataSource: 'pos' | 'simulated' = 'simulated'
): Promise<Record<string, { actualSales: number; actualLaborCost: number; actualColPercent: number }>> {
  const { data, error } = await supabase
    .from('sales_daily_unified')
    .select('date, net_sales, labor_cost')
    .eq('location_id', locationId)
    .eq('data_source', dataSource)
    .gte('date', weekStartISO)
    .lte('date', weekEndISO);
  
  if (error) {
    console.warn('Error fetching actual sales:', error);
    return {};
  }
  
  const byDate: Record<string, any> = {};
  (data || []).forEach(row => {
    const actualSales = Number(row.net_sales) || 0;
    const actualLaborCost = Number(row.labor_cost) || 0;
    const actualColPercent = actualSales > 0 
      ? Math.round((actualLaborCost / actualSales) * 1000) / 10 
      : 0;
    byDate[row.date] = { actualSales, actualLaborCost, actualColPercent };
  });
  
  return byDate;
}

// Check if forecast exists for the next 30 days
async function checkForecastExists(locationId: string): Promise<boolean> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const futureDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  
  const { count, error } = await supabase
    .from('forecast_daily_unified' as any)
    .select('day', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('day', today)
    .lte('day', futureDate);
  
  if (error) {
    console.warn('Error checking forecast:', error);
    return false;
  }
  
  // Consider forecast exists if we have at least 20 days (allows some gaps)
  return (count || 0) >= 20;
}

// Generate forecast for 365 days
async function generateForecast(locationId: string): Promise<boolean> {
  console.log('[useSchedulingSupabase] Generating forecast for location:', locationId);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate_forecast', {
      body: { 
        location_id: locationId, 
        horizon_days: 365 
      }
    });
    
    if (error) {
      console.error('[useSchedulingSupabase] Forecast generation error:', error);
      return false;
    }
    
    console.log('[useSchedulingSupabase] Forecast generated:', data);
    return true;
  } catch (err) {
    console.error('[useSchedulingSupabase] Forecast generation exception:', err);
    return false;
  }
}

// Build DayKPIs from forecast + shifts + actual
function buildDailyKPIs(
  weekStart: Date,
  forecastByDate: Record<string, any>,
  shifts: Shift[],
  actualByDate: Record<string, { actualSales: number; actualLaborCost: number; actualColPercent: number }> = {}
): DayKPI[] {
  const kpis: DayKPI[] = [];
  const today = format(new Date(), 'yyyy-MM-dd');
  
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
    const actual = actualByDate[dateStr];
    
    const isPastDay = dateStr < today;
    
    const forecastSales = forecast?.forecast_sales || 0;
    const forecastLaborCost = forecast?.planned_labor_cost || 0;
    const forecastLaborHours = forecast?.planned_labor_hours || 0;
    const forecastColPercent = forecastSales > 0 
      ? Math.round((forecastLaborCost / forecastSales) * 1000) / 10 
      : 0;
    
    // Variance Shifts vs Forecast
    const varianceCost = shiftsData.cost - forecastLaborCost;
    const varianceCostPct = forecastLaborCost > 0 
      ? Math.round((varianceCost / forecastLaborCost) * 1000) / 10 
      : 0;
    
    // Actual data + Variance Actual vs Forecast (only for past days)
    const actualSales = actual?.actualSales;
    const actualLaborCost = actual?.actualLaborCost;
    const actualColPercent = actual?.actualColPercent;
    const salesVarianceVsForecast = actualSales !== undefined && forecastSales > 0
      ? actualSales - forecastSales
      : undefined;
    const salesVarianceVsForecastPct = salesVarianceVsForecast !== undefined && forecastSales > 0
      ? Math.round((salesVarianceVsForecast / forecastSales) * 1000) / 10
      : undefined;
    
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
      // Variance Shifts vs Forecast
      varianceCost: Math.round(varianceCost * 100) / 100,
      varianceCostPct,
      // Actual data (past days only)
      actualSales: isPastDay ? actualSales : undefined,
      actualLaborCost: isPastDay ? actualLaborCost : undefined,
      actualColPercent: isPastDay ? actualColPercent : undefined,
      salesVarianceVsForecast: isPastDay ? salesVarianceVsForecast : undefined,
      salesVarianceVsForecastPct: isPastDay ? salesVarianceVsForecastPct : undefined,
      isPastDay,
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
    
    // Nory-style metrics
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
      // Nory-style metrics
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
