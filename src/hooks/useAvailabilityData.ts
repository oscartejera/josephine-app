import { useState, useMemo, useCallback } from 'react';
import { startOfWeek } from 'date-fns';
import {
  getAllTimeOffRequests,
  getPendingTimeOffRequests,
  getEmployeeTimeOffRequests,
  addTimeOffRequest,
  updateTimeOffRequestStatus,
  removeTimeOffRequest,
  getEmployeeAvailability,
  updateEmployeeAvailability,
  type DayAvailability,
  type TimeOffRequest,
} from '@/stores/availabilityStore';

export type { DayAvailability, TimeOffRequest };
export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred';

export interface Employee {
  id: string;
  name: string;
  initials: string;
  department: string;
  position: string;
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

function generateDefaultAvailability(): DayAvailability[] {
  return DAY_NAMES.map((dayName, dayIndex) => ({
    dayIndex,
    dayName,
    status: dayIndex < 5 ? 'available' : 'preferred',
    startTime: '09:00',
    endTime: '22:00',
  }));
}

export function useAvailabilityData(weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })) {
  const currentEmployee = EMPLOYEES[0];
  
  // Get availability from shared store, or use default
  const storedAvailability = getEmployeeAvailability(currentEmployee.id);
  const [availability, setAvailability] = useState<DayAvailability[]>(
    storedAvailability?.weeklyPattern || generateDefaultAvailability()
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [, forceUpdate] = useState(0);
  
  // Get time-off requests from shared store
  const timeOffRequests = getAllTimeOffRequests();
  
  const pendingRequests = useMemo(() => getPendingTimeOffRequests(), [timeOffRequests]);
  
  const myRequests = useMemo(() => 
    getEmployeeTimeOffRequests(currentEmployee.id),
    [currentEmployee.id, timeOffRequests]
  );
  
  const updateDayAvailability = useCallback((dayIndex: number, updates: Partial<DayAvailability>) => {
    setAvailability(prev => 
      prev.map(day => 
        day.dayIndex === dayIndex ? { ...day, ...updates } : day
      )
    );
    setHasChanges(true);
  }, []);
  
  const saveAvailability = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 800));
    updateEmployeeAvailability(currentEmployee.id, availability);
    setHasChanges(false);
    return true;
  }, [availability, currentEmployee.id]);
  
  const createTimeOffRequest = useCallback(async (request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeInitials' | 'status' | 'createdAt'>) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newRequest = addTimeOffRequest({
      ...request,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeInitials: currentEmployee.initials,
      status: 'pending',
    });
    forceUpdate(n => n + 1);
    return newRequest;
  }, [currentEmployee]);
  
  const approveTimeOffRequest = useCallback(async (requestId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    updateTimeOffRequestStatus(requestId, 'approved', 'Manager');
    forceUpdate(n => n + 1);
  }, []);
  
  const rejectTimeOffRequest = useCallback(async (requestId: string, notes?: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    updateTimeOffRequestStatus(requestId, 'rejected', 'Manager', notes);
    forceUpdate(n => n + 1);
  }, []);
  
  const cancelTimeOffRequest = useCallback(async (requestId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    removeTimeOffRequest(requestId);
    forceUpdate(n => n + 1);
  }, []);
  
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
