/**
 * Shared availability store that provides a central source of truth for
 * employee availability and time-off requests across Scheduling and Availability modules.
 * 
 * Data is persisted in Supabase tables:
 * - employee_availability (weekly patterns per employee)
 * - time_off_requests (vacation/sick/personal requests)
 */

import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Types
export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred';

export interface DayAvailability {
  dayIndex: number; // 0 = Monday, 6 = Sunday
  dayName: string;
  status: AvailabilityStatus;
  startTime?: string;
  endTime?: string;
  note?: string;
}

export interface EmployeeAvailability {
  employeeId: string;
  weeklyPattern: DayAvailability[];
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'vacation' | 'sick' | 'personal' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

// Constants
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// In-memory cache (loaded from DB on first access)
let employeeAvailabilities: Map<string, EmployeeAvailability> = new Map();
let timeOffRequests: TimeOffRequest[] = [];
let isInitialized = false;
let isLoading = false;

/**
 * Generate default weekly availability pattern for an employee
 */
function generateDefaultAvailability(employeeId: string): EmployeeAvailability {
  const weeklyPattern: DayAvailability[] = DAY_NAMES.map((dayName, dayIndex) => ({
    dayIndex,
    dayName,
    status: 'available' as AvailabilityStatus,
    startTime: '09:00',
    endTime: '22:00',
  }));
  return { employeeId, weeklyPattern };
}

/**
 * Load availability data from Supabase 
 */
async function loadFromDB() {
  if (isInitialized || isLoading) return;
  isLoading = true;

  try {
    // Load employee availability patterns
    const { data: availData } = await (supabase as any)
      .from('employee_availability')
      .select('employee_id, day_index, status, start_time, end_time, note');

    if (availData && availData.length > 0) {
      const grouped = new Map<string, DayAvailability[]>();
      for (const row of availData) {
        if (!grouped.has(row.employee_id)) grouped.set(row.employee_id, []);
        grouped.get(row.employee_id)!.push({
          dayIndex: row.day_index,
          dayName: DAY_NAMES[row.day_index] || 'Unknown',
          status: row.status as AvailabilityStatus,
          startTime: row.start_time?.substring(0, 5),
          endTime: row.end_time?.substring(0, 5),
          note: row.note,
        });
      }
      for (const [empId, days] of grouped) {
        // Fill missing days with 'available'
        const fullWeek = DAY_NAMES.map((dayName, i) => {
          const existing = days.find(d => d.dayIndex === i);
          return existing || { dayIndex: i, dayName, status: 'available' as AvailabilityStatus, startTime: '09:00', endTime: '22:00' };
        });
        employeeAvailabilities.set(empId, { employeeId: empId, weeklyPattern: fullWeek });
      }
    }

    // Load time-off requests with employee names
    const { data: timeOffData } = await (supabase as any)
      .from('time_off_requests')
      .select('id, employee_id, start_date, end_date, reason, type, status, reviewed_by, reviewed_at, notes, created_at, employees(full_name)')
      .order('created_at', { ascending: false });

    if (timeOffData && timeOffData.length > 0) {
      timeOffRequests = timeOffData.map((row: any) => {
        const name = row.employees?.full_name || 'Employee';
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        return {
          id: row.id,
          employeeId: row.employee_id,
          employeeName: name,
          employeeInitials: initials,
          startDate: row.start_date,
          endDate: row.end_date,
          reason: row.reason || '',
          type: row.type as TimeOffRequest['type'],
          status: row.status as TimeOffRequest['status'],
          createdAt: row.created_at,
          reviewedBy: row.reviewed_by,
          reviewedAt: row.reviewed_at,
          notes: row.notes,
        };
      });
    }
  } catch (err) {
    console.error('[availabilityStore] Error loading from DB:', err);
  } finally {
    isInitialized = true;
    isLoading = false;
  }
}

// Initialize on module load
loadFromDB();

/**
 * Get employee's weekly availability pattern
 */
export function getEmployeeAvailability(employeeId: string): EmployeeAvailability | undefined {
  return employeeAvailabilities.get(employeeId) || generateDefaultAvailability(employeeId);
}

/**
 * Get all employee availabilities
 */
export function getAllAvailabilities(): EmployeeAvailability[] {
  return Array.from(employeeAvailabilities.values());
}

/**
 * Update employee's weekly availability — persists to DB
 */
export async function updateEmployeeAvailability(employeeId: string, weeklyPattern: DayAvailability[]) {
  employeeAvailabilities.set(employeeId, { employeeId, weeklyPattern });

  // Upsert to DB
  const rows = weeklyPattern.map(day => ({
    employee_id: employeeId,
    day_index: day.dayIndex,
    status: day.status,
    start_time: day.startTime || null,
    end_time: day.endTime || null,
    note: day.note || null,
  }));

  try {
    await (supabase as any)
      .from('employee_availability')
      .upsert(rows, { onConflict: 'employee_id,day_index' });
  } catch (err) {
    console.error('[availabilityStore] Error saving availability:', err);
  }
}

/**
 * Get all time-off requests
 */
export function getAllTimeOffRequests(): TimeOffRequest[] {
  return [...timeOffRequests];
}

/**
 * Get approved time-off requests for a specific date range
 */
export function getApprovedTimeOffForDateRange(startDate: Date, endDate: Date): TimeOffRequest[] {
  return timeOffRequests.filter(req => {
    if (req.status !== 'approved') return false;

    const reqStart = parseISO(req.startDate);
    const reqEnd = parseISO(req.endDate);

    return (
      isWithinInterval(reqStart, { start: startOfDay(startDate), end: endOfDay(endDate) }) ||
      isWithinInterval(reqEnd, { start: startOfDay(startDate), end: endOfDay(endDate) }) ||
      (reqStart <= startDate && reqEnd >= endDate)
    );
  });
}

/**
 * Check if employee is available on a specific date
 */
export function isEmployeeAvailableOnDate(
  employeeId: string,
  date: Date,
  checkTimeOff: boolean = true
): { available: boolean; reason?: 'unavailable' | 'day_off' | 'time_off' | 'preferred' } {
  if (checkTimeOff) {
    const hasApprovedTimeOff = timeOffRequests.some(req => {
      if (req.employeeId !== employeeId || req.status !== 'approved') return false;
      const reqStart = parseISO(req.startDate);
      const reqEnd = parseISO(req.endDate);
      return isWithinInterval(date, { start: startOfDay(reqStart), end: endOfDay(reqEnd) });
    });

    if (hasApprovedTimeOff) {
      return { available: false, reason: 'time_off' };
    }
  }

  const availability = employeeAvailabilities.get(employeeId);
  if (!availability) return { available: true };

  const jsDay = date.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;

  const dayAvail = availability.weeklyPattern[dayIndex];
  if (!dayAvail) return { available: true };

  if (dayAvail.status === 'unavailable') {
    return { available: false, reason: 'unavailable' };
  }

  if (dayAvail.status === 'preferred') {
    return { available: true, reason: 'preferred' };
  }

  return { available: true };
}

/**
 * Get employee availability status for a specific date including time preferences
 */
export function getEmployeeDateAvailability(employeeId: string, date: Date): {
  status: 'available' | 'unavailable' | 'preferred' | 'time_off';
  startTime?: string;
  endTime?: string;
  timeOffInfo?: TimeOffRequest;
} {
  const approvedTimeOff = timeOffRequests.find(req => {
    if (req.employeeId !== employeeId || req.status !== 'approved') return false;
    const reqStart = parseISO(req.startDate);
    const reqEnd = parseISO(req.endDate);
    return isWithinInterval(date, { start: startOfDay(reqStart), end: endOfDay(reqEnd) });
  });

  if (approvedTimeOff) {
    return { status: 'time_off', timeOffInfo: approvedTimeOff };
  }

  const availability = employeeAvailabilities.get(employeeId);
  if (!availability) return { status: 'available', startTime: '09:00', endTime: '22:00' };

  const jsDay = date.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;

  const dayAvail = availability.weeklyPattern[dayIndex];
  if (!dayAvail) return { status: 'available', startTime: '09:00', endTime: '22:00' };

  return {
    status: dayAvail.status,
    startTime: dayAvail.startTime,
    endTime: dayAvail.endTime,
  };
}

/**
 * Add a new time-off request — persists to DB
 */
export async function addTimeOffRequest(request: Omit<TimeOffRequest, 'id' | 'createdAt'>): Promise<TimeOffRequest> {
  const newRequest: TimeOffRequest = {
    ...request,
    id: `timeoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  timeOffRequests = [newRequest, ...timeOffRequests];

  // Persist to DB
  try {
    const { data } = await (supabase as any)
      .from('time_off_requests')
      .insert({
        employee_id: request.employeeId,
        org_id: '7bca34d5-4448-40b8-bb7f-55f1417aeccd', // TODO: get from context
        start_date: request.startDate,
        end_date: request.endDate,
        reason: request.reason,
        type: request.type,
        status: request.status || 'pending',
        notes: request.notes,
      })
      .select('id')
      .single();

    if (data) {
      newRequest.id = data.id;
      timeOffRequests[0] = newRequest;
    }
  } catch (err) {
    console.error('[availabilityStore] Error saving time-off request:', err);
  }

  return newRequest;
}

/**
 * Update time-off request status — persists to DB
 */
export async function updateTimeOffRequestStatus(
  requestId: string,
  status: TimeOffRequest['status'],
  reviewedBy?: string,
  notes?: string
) {
  timeOffRequests = timeOffRequests.map(req => {
    if (req.id !== requestId) return req;
    return {
      ...req,
      status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      notes,
    };
  });

  // Persist to DB
  try {
    await (supabase as any)
      .from('time_off_requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        notes,
      })
      .eq('id', requestId);
  } catch (err) {
    console.error('[availabilityStore] Error updating time-off request:', err);
  }
}

/**
 * Remove a time-off request — persists to DB
 */
export async function removeTimeOffRequest(requestId: string) {
  timeOffRequests = timeOffRequests.filter(req => req.id !== requestId);

  try {
    await (supabase as any)
      .from('time_off_requests')
      .delete()
      .eq('id', requestId);
  } catch (err) {
    console.error('[availabilityStore] Error deleting time-off request:', err);
  }
}

/**
 * Get pending time-off requests
 */
export function getPendingTimeOffRequests(): TimeOffRequest[] {
  return timeOffRequests.filter(req => req.status === 'pending');
}

/**
 * Get time-off requests for a specific employee
 */
export function getEmployeeTimeOffRequests(employeeId: string): TimeOffRequest[] {
  return timeOffRequests.filter(req => req.employeeId === employeeId);
}

/**
 * Force reload from DB (useful after mutations)
 */
export async function reloadAvailabilityStore() {
  isInitialized = false;
  employeeAvailabilities = new Map();
  timeOffRequests = [];
  await loadFromDB();
}
