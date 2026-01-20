import { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';

// Types
export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred';

export interface DayAvailability {
  dayIndex: number;
  dayName: string;
  status: AvailabilityStatus;
  startTime?: string;
  endTime?: string;
  note?: string;
}

export interface WeeklyAvailability {
  employeeId: string;
  weekStart: string;
  days: DayAvailability[];
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

export interface Employee {
  id: string;
  name: string;
  initials: string;
  department: string;
  position: string;
}

// Seeded random
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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EMPLOYEES: Employee[] = [
  { id: 'emp-0', name: 'Alex Smith', initials: 'AS', department: 'FOH', position: 'Server' },
  { id: 'emp-1', name: 'Jordan Johnson', initials: 'JJ', department: 'BOH', position: 'Kitchen Team' },
  { id: 'emp-2', name: 'Taylor Williams', initials: 'TW', department: 'FOH', position: 'Host' },
  { id: 'emp-3', name: 'Morgan Brown', initials: 'MB', department: 'Management', position: 'Duty Manager' },
  { id: 'emp-4', name: 'Casey Jones', initials: 'CJ', department: 'FOH', position: 'Barista' },
  { id: 'emp-5', name: 'Riley Garcia', initials: 'RG', department: 'BOH', position: 'Prep Cook' },
  { id: 'emp-6', name: 'Jamie Miller', initials: 'JM', department: 'FOH', position: 'Server' },
  { id: 'emp-7', name: 'Quinn Davis', initials: 'QD', department: 'BOH', position: 'Kitchen Team' },
];

const TIME_OFF_REASONS = [
  'Family vacation',
  'Medical appointment',
  'Personal day',
  'Wedding attendance',
  'Moving to new apartment',
  'Taking care of sick family member',
];

const TIME_OFF_TYPES: TimeOffRequest['type'][] = ['vacation', 'sick', 'personal', 'other'];

function generateMockTimeOffRequests(rng: SeededRandom): TimeOffRequest[] {
  const requests: TimeOffRequest[] = [];
  const today = new Date();
  
  // Generate 5-8 mock requests
  const count = rng.intRange(5, 8);
  
  for (let i = 0; i < count; i++) {
    const employee = rng.pick(EMPLOYEES);
    const daysFromNow = rng.intRange(-5, 20);
    const duration = rng.intRange(1, 5);
    const startDate = addDays(today, daysFromNow);
    const endDate = addDays(startDate, duration - 1);
    
    const statuses: TimeOffRequest['status'][] = ['pending', 'approved', 'rejected'];
    const status = daysFromNow < 0 ? rng.pick(['approved', 'rejected'] as const) : rng.pick(statuses);
    
    requests.push({
      id: `timeoff-${i}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeInitials: employee.initials,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      reason: rng.pick(TIME_OFF_REASONS),
      type: rng.pick(TIME_OFF_TYPES),
      status,
      createdAt: format(addDays(startDate, -rng.intRange(3, 14)), 'yyyy-MM-dd\'T\'HH:mm:ss'),
      reviewedBy: status !== 'pending' ? 'Manager' : undefined,
      reviewedAt: status !== 'pending' ? format(addDays(startDate, -rng.intRange(1, 3)), 'yyyy-MM-dd\'T\'HH:mm:ss') : undefined,
    });
  }
  
  return requests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function generateDefaultAvailability(): DayAvailability[] {
  return DAY_NAMES.map((dayName, dayIndex) => ({
    dayIndex,
    dayName,
    status: dayIndex < 5 ? 'available' : 'preferred', // Weekdays available, weekends preferred
    startTime: '09:00',
    endTime: '22:00',
  }));
}

export function useAvailabilityData(weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })) {
  const [availability, setAvailability] = useState<DayAvailability[]>(generateDefaultAvailability);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>(() => {
    const rng = new SeededRandom('timeoff-seed');
    return generateMockTimeOffRequests(rng);
  });
  const [hasChanges, setHasChanges] = useState(false);
  
  // Current employee (mock - in real app would come from auth)
  const currentEmployee = EMPLOYEES[0];
  
  // Derived data
  const pendingRequests = useMemo(() => 
    timeOffRequests.filter(r => r.status === 'pending'),
    [timeOffRequests]
  );
  
  const myRequests = useMemo(() => 
    timeOffRequests.filter(r => r.employeeId === currentEmployee.id),
    [timeOffRequests, currentEmployee.id]
  );
  
  // Actions
  const updateDayAvailability = (dayIndex: number, updates: Partial<DayAvailability>) => {
    setAvailability(prev => 
      prev.map(day => 
        day.dayIndex === dayIndex ? { ...day, ...updates } : day
      )
    );
    setHasChanges(true);
  };
  
  const saveAvailability = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    setHasChanges(false);
    return true;
  };
  
  const createTimeOffRequest = async (request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeInitials' | 'status' | 'createdAt'>) => {
    const newRequest: TimeOffRequest = {
      ...request,
      id: `timeoff-${Date.now()}`,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeInitials: currentEmployee.initials,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setTimeOffRequests(prev => [newRequest, ...prev]);
    return newRequest;
  };
  
  const approveTimeOffRequest = async (requestId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    setTimeOffRequests(prev =>
      prev.map(r => r.id === requestId ? {
        ...r,
        status: 'approved',
        reviewedBy: 'Manager',
        reviewedAt: new Date().toISOString(),
      } : r)
    );
  };
  
  const rejectTimeOffRequest = async (requestId: string, notes?: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    setTimeOffRequests(prev =>
      prev.map(r => r.id === requestId ? {
        ...r,
        status: 'rejected',
        reviewedBy: 'Manager',
        reviewedAt: new Date().toISOString(),
        notes,
      } : r)
    );
  };
  
  const cancelTimeOffRequest = async (requestId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    setTimeOffRequests(prev => prev.filter(r => r.id !== requestId));
  };
  
  return {
    availability,
    timeOffRequests,
    pendingRequests,
    myRequests,
    currentEmployee,
    employees: EMPLOYEES,
    hasChanges,
    updateDayAvailability,
    saveAvailability,
    createTimeOffRequest,
    approveTimeOffRequest,
    rejectTimeOffRequest,
    cancelTimeOffRequest,
  };
}