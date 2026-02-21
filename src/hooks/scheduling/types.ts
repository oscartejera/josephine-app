// Scheduling module — shared types and constants

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
    // Efficiency metrics
    splh: number;   // Sales Per Labor Hour
    oplh: number;   // Orders Per Labor Hour (estimated)
    scheduledColPercent: number; // COL% based on scheduled shifts (not forecast)
}

export interface Location {
    id: string;
    name: string;
}

// Constants
export const DEPARTMENTS = ['BOH', 'FOH'];
export const STATIONS = ['Cocina', 'Prep', 'Bar', 'Sala', 'Limpieza'];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Legacy location name mappings (for old URLs like /scheduling?location=southside)
export const LEGACY_LOCATION_ALIASES: Record<string, string[]> = {
    'southside': ['southside', 'south'],
    'westside': ['westside', 'west'],
    'central': ['central', 'centro', 'downtown'],
    'hq': ['hq', 'headquarters', 'main'],
    'chamberi': ['chamberi', 'chamberí'],
    'malasana': ['malasana', 'malasaña'],
    'salamanca': ['salamanca'],
};
