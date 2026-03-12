import { useState, useMemo, useCallback, useEffect } from 'react';
import { startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getRoleDepartment(role: string | null): string {
  switch (role) {
    case 'chef':
    case 'kitchen':
    case 'prep_cook':
      return 'BOH';
    case 'manager':
    case 'ops_manager':
    case 'store_manager':
      return 'Management';
    default:
      return 'FOH';
  }
}

function getRolePosition(role: string | null): string {
  switch (role) {
    case 'chef': return 'Chef';
    case 'kitchen': return 'Kitchen Team';
    case 'prep_cook': return 'Prep Cook';
    case 'manager':
    case 'ops_manager':
    case 'store_manager':
      return 'Manager';
    case 'waiter': return 'Server';
    case 'bartender': return 'Barista';
    case 'host': return 'Host';
    default: return 'Employee';
  }
}

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Load real employees from DB
  useEffect(() => {
    async function fetchEmployees() {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name, role_name')
          .eq('active', true)
          .order('full_name')
          .limit(50);

        if (error) throw error;

        const mapped: Employee[] = (data || []).map((emp: any) => ({
          id: emp.id,
          name: emp.full_name || 'Employee',
          initials: getInitials(emp.full_name || 'E'),
          department: getRoleDepartment(emp.role_name),
          position: getRolePosition(emp.role_name),
        }));
        setEmployees(mapped);
      } catch (err) {
        console.error('[useAvailabilityData] Error loading employees:', err);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  const currentEmployee = employees[0] || { id: '', name: 'Loading...', initials: '--', department: '', position: '' };

  // Get availability from shared store, or use default
  const storedAvailability = getEmployeeAvailability(currentEmployee.id);
  const [availability, setAvailability] = useState<DayAvailability[]>(
    storedAvailability?.weeklyPattern || generateDefaultAvailability()
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [, forceUpdate] = useState(0);

  // Update availability when employee changes
  useEffect(() => {
    if (currentEmployee.id) {
      const stored = getEmployeeAvailability(currentEmployee.id);
      setAvailability(stored?.weeklyPattern || generateDefaultAvailability());
    }
  }, [currentEmployee.id]);

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
    await updateEmployeeAvailability(currentEmployee.id, availability);
    setHasChanges(false);
    return true;
  }, [availability, currentEmployee.id]);

  const { group } = useApp();

  const createTimeOffRequest = useCallback(async (request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeInitials' | 'status' | 'createdAt'>) => {
    const orgId = group?.id || '';
    const newRequest = await addTimeOffRequest({
      ...request,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeInitials: currentEmployee.initials,
      status: 'pending',
    }, orgId);
    forceUpdate(n => n + 1);
    return newRequest;
  }, [currentEmployee]);

  const approveTimeOffRequest = useCallback(async (requestId: string) => {
    await updateTimeOffRequestStatus(requestId, 'approved', 'Manager');
    forceUpdate(n => n + 1);
  }, []);

  const rejectTimeOffRequest = useCallback(async (requestId: string, notes?: string) => {
    await updateTimeOffRequestStatus(requestId, 'rejected', 'Manager', notes);
    forceUpdate(n => n + 1);
  }, []);

  const cancelTimeOffRequest = useCallback(async (requestId: string) => {
    await removeTimeOffRequest(requestId);
    forceUpdate(n => n + 1);
  }, []);

  return {
    availability,
    timeOffRequests,
    pendingRequests,
    myRequests,
    currentEmployee,
    employees,
    hasChanges,
    loadingEmployees,
    updateDayAvailability,
    saveAvailability,
    createTimeOffRequest,
    approveTimeOffRequest,
    rejectTimeOffRequest,
    cancelTimeOffRequest,
  };
}
