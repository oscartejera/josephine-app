/**
 * Shared availability store that provides a central source of truth for 
 * employee availability and time-off requests across Scheduling and Availability modules.
 */

import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

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

// Seeded random for consistent mock data
class SeededRandom {
  private seed: number;
  
  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  intRange(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
}

// In-memory store (would be database in production)
let employeeAvailabilities: Map<string, EmployeeAvailability> = new Map();
let timeOffRequests: TimeOffRequest[] = [];
let isInitialized = false;

/**
 * Generate default weekly availability pattern for an employee
 */
function generateDefaultAvailability(employeeId: string): EmployeeAvailability {
  const rng = new SeededRandom(`avail-${employeeId}`);
  
  const weeklyPattern: DayAvailability[] = DAY_NAMES.map((dayName, dayIndex) => {
    const rand = rng.next();
    let status: AvailabilityStatus;
    
    // Weekdays more likely available, weekends preferred
    if (dayIndex < 5) {
      status = rand < 0.15 ? 'unavailable' : 'available';
    } else {
      if (rand < 0.2) status = 'unavailable';
      else if (rand < 0.5) status = 'preferred';
      else status = 'available';
    }
    
    return {
      dayIndex,
      dayName,
      status,
      startTime: status !== 'unavailable' ? '09:00' : undefined,
      endTime: status !== 'unavailable' ? '22:00' : undefined,
    };
  });
  
  return { employeeId, weeklyPattern };
}

/**
 * Initialize store with mock data for demo employees
 */
function initializeStore() {
  if (isInitialized) return;
  
  const employeeIds = Array.from({ length: 15 }, (_, i) => `emp-${i}`);
  
  employeeIds.forEach(id => {
    employeeAvailabilities.set(id, generateDefaultAvailability(id));
  });
  
  // Generate some mock time-off requests
  const rng = new SeededRandom('timeoff-global');
  const today = new Date();
  
  const employeeNames = [
    { id: 'emp-0', name: 'Alex Smith', initials: 'AS' },
    { id: 'emp-1', name: 'Jordan Johnson', initials: 'JJ' },
    { id: 'emp-2', name: 'Taylor Williams', initials: 'TW' },
    { id: 'emp-3', name: 'Morgan Brown', initials: 'MB' },
    { id: 'emp-4', name: 'Casey Jones', initials: 'CJ' },
  ];
  
  const reasons = [
    'Family vacation',
    'Medical appointment',
    'Personal day',
    'Wedding attendance',
    'Moving to new apartment',
  ];
  
  const types: TimeOffRequest['type'][] = ['vacation', 'sick', 'personal', 'other'];
  
  for (let i = 0; i < 6; i++) {
    const emp = rng.pick(employeeNames);
    const daysFromNow = rng.intRange(-3, 14);
    const duration = rng.intRange(1, 3);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + daysFromNow);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);
    
    const statuses: TimeOffRequest['status'][] = ['pending', 'approved', 'rejected'];
    const status = daysFromNow < 0 ? rng.pick(['approved', 'rejected'] as const) : rng.pick(statuses);
    
    timeOffRequests.push({
      id: `timeoff-${i}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeInitials: emp.initials,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      reason: rng.pick(reasons),
      type: rng.pick(types),
      status,
      createdAt: format(new Date(today.getTime() - rng.intRange(1, 10) * 86400000), "yyyy-MM-dd'T'HH:mm:ss"),
      reviewedBy: status !== 'pending' ? 'Manager' : undefined,
      reviewedAt: status !== 'pending' ? format(new Date(today.getTime() - rng.intRange(1, 5) * 86400000), "yyyy-MM-dd'T'HH:mm:ss") : undefined,
    });
  }
  
  isInitialized = true;
}

// Initialize on module load
initializeStore();

/**
 * Get employee's weekly availability pattern
 */
export function getEmployeeAvailability(employeeId: string): EmployeeAvailability | undefined {
  return employeeAvailabilities.get(employeeId);
}

/**
 * Get all employee availabilities
 */
export function getAllAvailabilities(): EmployeeAvailability[] {
  return Array.from(employeeAvailabilities.values());
}

/**
 * Update employee's weekly availability
 */
export function updateEmployeeAvailability(employeeId: string, weeklyPattern: DayAvailability[]) {
  employeeAvailabilities.set(employeeId, { employeeId, weeklyPattern });
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
    
    // Check if the request overlaps with the date range
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
  // Check time-off first
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
  
  // Check weekly pattern
  const availability = employeeAvailabilities.get(employeeId);
  if (!availability) return { available: true };
  
  // Get day of week (0 = Monday in our system)
  const jsDay = date.getDay(); // 0 = Sunday
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to Monday = 0
  
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
  // Check time-off first
  const approvedTimeOff = timeOffRequests.find(req => {
    if (req.employeeId !== employeeId || req.status !== 'approved') return false;
    const reqStart = parseISO(req.startDate);
    const reqEnd = parseISO(req.endDate);
    return isWithinInterval(date, { start: startOfDay(reqStart), end: endOfDay(reqEnd) });
  });
  
  if (approvedTimeOff) {
    return { status: 'time_off', timeOffInfo: approvedTimeOff };
  }
  
  // Check weekly pattern
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
 * Add a new time-off request
 */
export function addTimeOffRequest(request: Omit<TimeOffRequest, 'id' | 'createdAt'>): TimeOffRequest {
  const newRequest: TimeOffRequest = {
    ...request,
    id: `timeoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  timeOffRequests = [newRequest, ...timeOffRequests];
  return newRequest;
}

/**
 * Update time-off request status
 */
export function updateTimeOffRequestStatus(
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
}

/**
 * Remove a time-off request
 */
export function removeTimeOffRequest(requestId: string) {
  timeOffRequests = timeOffRequests.filter(req => req.id !== requestId);
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
