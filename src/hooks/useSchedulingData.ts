import { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import { 
  getEmployeeDateAvailability, 
  getApprovedTimeOffForDateRange,
  type TimeOffRequest 
} from '@/stores/availabilityStore';

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
  availability: Record<string, 'available' | 'unavailable' | 'day_off' | 'time_off' | 'preferred'>;
  timeOffInfo?: Record<string, TimeOffRequest>;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  role: string;
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
  projectedSales: number;
  projectedLabourCost: number;
  projectedColPercent: number;
  targetColPercent: number;
  totalHours: number;
  status: 'draft' | 'published';
  timeOffConflicts: number; // Count of employees with time-off during the week
}

// Use centralized SeededRandom
import { SeededRandom } from '@/lib/seededRandom';

const LOCATIONS = [
  { id: 'cpu', name: 'CPU' },
  { id: 'westside', name: 'Westside' },
  { id: 'eastside', name: 'Eastside' },
  { id: 'southside', name: 'Southside' },
  { id: 'westend', name: 'Westend' },
  { id: 'hq', name: 'HQ' },
];

const DEPARTMENTS = ['Management', 'BOH', 'FOH'];
const POSITIONS = ['Duty Manager', 'Kitchen Team', 'Server', 'Host', 'Barista', 'Prep Cook'];
const STATIONS = ['Grill', 'Prep', 'Bar', 'Floor', 'Counter', 'Drive-thru'];

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Reese', 'Cameron', 'Drew', 'Finley', 'Hayden'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore'];

function generateEmployees(rng: SeededRandom, count: number, weekStart: Date): Employee[] {
  const employees: Employee[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const initials = `${firstName[0]}${lastName[0]}`;
    const department = rng.pick(DEPARTMENTS);
    const position = rng.pick(POSITIONS);
    const station = rng.pick(STATIONS);
    const targetHours = rng.intRange(32, 40);
    const employeeId = `emp-${i}`;
    
    // Use shared availability store for each day of the week
    const availability: Record<string, 'available' | 'unavailable' | 'day_off' | 'time_off' | 'preferred'> = {};
    const timeOffInfo: Record<string, TimeOffRequest> = {};
    
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dateAvail = getEmployeeDateAvailability(employeeId, date);
      
      if (dateAvail.status === 'time_off') {
        availability[d.toString()] = 'time_off';
        if (dateAvail.timeOffInfo) {
          timeOffInfo[d.toString()] = dateAvail.timeOffInfo;
        }
      } else if (dateAvail.status === 'unavailable') {
        availability[d.toString()] = 'unavailable';
      } else if (dateAvail.status === 'preferred') {
        availability[d.toString()] = 'preferred';
      } else {
        availability[d.toString()] = 'available';
      }
    }
    
    employees.push({
      id: employeeId,
      name,
      initials,
      department,
      position,
      station,
      weeklyHours: 0,
      targetHours,
      availability,
      timeOffInfo: Object.keys(timeOffInfo).length > 0 ? timeOffInfo : undefined,
    });
  }
  
  return employees;
}

function generateShifts(rng: SeededRandom, employees: Employee[], weekStart: Date): { shifts: Shift[]; openShifts: Shift[] } {
  const shifts: Shift[] = [];
  const openShifts: Shift[] = [];
  
  const shiftTemplates = [
    { start: '07:00', end: '13:00', hours: 6 },
    { start: '07:30', end: '13:00', hours: 5.5 },
    { start: '09:00', end: '17:00', hours: 8 },
    { start: '11:00', end: '19:00', hours: 8 },
    { start: '12:00', end: '20:00', hours: 8 },
    { start: '14:00', end: '22:00', hours: 8 },
    { start: '16:00', end: '22:00', hours: 6 },
    { start: '17:00', end: '23:00', hours: 6 },
  ];
  
  // Generate shifts for each employee - respecting availability!
  employees.forEach((emp, empIndex) => {
    let weeklyHours = 0;
    
    for (let day = 0; day < 7; day++) {
      const date = format(addDays(weekStart, day), 'yyyy-MM-dd');
      const availability = emp.availability[day.toString()];
      
      // Only schedule if employee is available (not unavailable, day_off, or time_off)
      const canSchedule = availability === 'available' || availability === 'preferred';
      
      if (canSchedule && weeklyHours < emp.targetHours) {
        // Lower chance of scheduling on preferred days (employee would rather not)
        const scheduleProbability = availability === 'preferred' ? 0.3 : 0.8;
        
        if (rng.next() < scheduleProbability) {
          const template = rng.pick(shiftTemplates);
          weeklyHours += template.hours;
          
          shifts.push({
            id: `shift-${empIndex}-${day}`,
            employeeId: emp.id,
            date,
            startTime: template.start,
            endTime: template.end,
            hours: template.hours,
            role: emp.position,
          });
        }
      }
    }
    
    emp.weeklyHours = weeklyHours;
  });
  
  // Generate some open shifts
  for (let day = 0; day < 7; day++) {
    if (rng.next() > 0.6) {
      const date = format(addDays(weekStart, day), 'yyyy-MM-dd');
      const template = rng.pick(shiftTemplates);
      
      openShifts.push({
        id: `open-${day}`,
        employeeId: '',
        date,
        startTime: template.start,
        endTime: template.end,
        hours: template.hours,
        role: rng.pick(POSITIONS),
        isOpen: true,
      });
    }
  }
  
  return { shifts, openShifts };
}

function generateDailyKPIs(rng: SeededRandom, weekStart: Date): DayKPI[] {
  const kpis: DayKPI[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  for (let day = 0; day < 7; day++) {
    const date = format(addDays(weekStart, day), 'yyyy-MM-dd');
    const isWeekend = day >= 5;
    const baseSales = isWeekend ? rng.range(3500, 5500) : rng.range(2000, 3500);
    const sales = Math.round(baseSales);
    const colPercent = rng.range(18, 28);
    const cost = Math.round(sales * colPercent / 100);
    const hours = rng.range(40, 80);
    
    kpis.push({
      date,
      dayName: dayNames[day],
      sales,
      cost,
      colPercent: Math.round(colPercent * 10) / 10,
      hours: Math.round(hours * 10) / 10,
    });
  }
  
  return kpis;
}

export function useSchedulingData(locationId: string = 'westside', weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [previousSchedule, setPreviousSchedule] = useState<ScheduleData | null>(null);
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, { employeeId: string; date: string }>>({});
  const [newShifts, setNewShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  
  const location = LOCATIONS.find(l => l.id === locationId) || LOCATIONS[1];
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  // Get time-off conflicts for this week
  const timeOffConflicts = useMemo(() => {
    const approvedTimeOff = getApprovedTimeOffForDateRange(weekStart, weekEnd);
    // Count unique employees with time-off
    const uniqueEmployees = new Set(approvedTimeOff.map(r => r.employeeId));
    return uniqueEmployees.size;
  }, [weekStart, weekEnd]);
  
  const data = useMemo((): ScheduleData | null => {
    if (!hasSchedule) return null;
    
    const seed = `${locationId}-${format(weekStart, 'yyyy-MM-dd')}-v${scheduleVersion}`;
    const rng = new SeededRandom(seed);
    
    const employeeCount = rng.intRange(10, 15);
    // Pass weekStart to generateEmployees so it can check availability for correct dates
    const employees = generateEmployees(rng, employeeCount, weekStart);
    const { shifts: baseShifts, openShifts } = generateShifts(rng, employees, weekStart);
    const dailyKPIs = generateDailyKPIs(rng, weekStart);
    
    // Apply shift overrides (from drag-and-drop)
    let shifts = baseShifts.map(shift => {
      const override = shiftOverrides[shift.id];
      if (override) {
        return {
          ...shift,
          employeeId: override.employeeId,
          date: override.date,
        };
      }
      return shift;
    });
    
    // Add newly created shifts
    shifts = [...shifts, ...newShifts];
    
    // Recalculate employee weekly hours with overrides
    employees.forEach(emp => {
      emp.weeklyHours = shifts
        .filter(s => s.employeeId === emp.id)
        .reduce((sum, s) => sum + s.hours, 0);
    });
    
    const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0) + openShifts.reduce((sum, s) => sum + s.hours, 0);
    const projectedSales = dailyKPIs.reduce((sum, d) => sum + d.sales, 0);
    const projectedLabourCost = dailyKPIs.reduce((sum, d) => sum + d.cost, 0);
    const projectedColPercent = Math.round((projectedLabourCost / projectedSales) * 1000) / 10;
    
    return {
      locationId,
      locationName: location.name,
      weekStart,
      weekEnd,
      employees,
      shifts,
      openShifts,
      dailyKPIs,
      projectedSales,
      projectedLabourCost,
      projectedColPercent,
      targetColPercent: 22,
      totalHours: Math.round(totalHours * 10) / 10,
      status: 'draft',
      timeOffConflicts,
    };
  }, [locationId, weekStart, hasSchedule, scheduleVersion, location.name, shiftOverrides, newShifts, timeOffConflicts]);
  
  const createSchedule = async (): Promise<void> => {
    setIsLoading(true);
    // Simulated AI processing
    await new Promise(resolve => setTimeout(resolve, 4500));
    setShiftOverrides({});
    setNewShifts([]);
    setHasSchedule(true);
    setScheduleVersion(v => v + 1);
    setIsLoading(false);
  };
  
  const undoSchedule = () => {
    if (previousSchedule) {
      setScheduleVersion(v => v - 1);
      setShiftOverrides({});
      setNewShifts([]);
    } else {
      setHasSchedule(false);
      setShiftOverrides({});
      setNewShifts([]);
    }
  };
  
  const acceptSchedule = () => {
    setPreviousSchedule(data);
  };
  
  const publishSchedule = async (emailBody?: string): Promise<void> => {
    // Simulate publishing
    await new Promise(resolve => setTimeout(resolve, 1500));
    // In real implementation, this would call the API
  };
  
  const moveShift = (shiftId: string, toEmployeeId: string, toDate: string) => {
    setShiftOverrides(prev => ({
      ...prev,
      [shiftId]: { employeeId: toEmployeeId, date: toDate },
    }));
  };
  
  const addShift = (shift: Omit<Shift, 'id'>) => {
    const newShift: Shift = {
      ...shift,
      id: `new-shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setNewShifts(prev => [...prev, newShift]);
    return newShift;
  };
  
  const createSwapRequest = (
    requesterShift: Shift,
    targetShift: Shift,
    reason?: string
  ) => {
    if (!data) return;
    
    const requester = data.employees.find(e => e.id === requesterShift.employeeId);
    const target = data.employees.find(e => e.id === targetShift.employeeId);
    
    if (!requester || !target) return;
    
    const newRequest: SwapRequest = {
      id: `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  };
  
  const approveSwapRequest = (requestId: string) => {
    const request = swapRequests.find(r => r.id === requestId);
    if (!request) return;
    
    // Apply the swap by moving shifts
    setShiftOverrides(prev => ({
      ...prev,
      [request.requesterShiftId]: { employeeId: request.targetId, date: request.requesterShiftDate },
      [request.targetShiftId]: { employeeId: request.requesterId, date: request.targetShiftDate },
    }));
    
    // Update status
    setSwapRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r)
    );
  };
  
  const rejectSwapRequest = (requestId: string) => {
    setSwapRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: 'rejected' as const } : r)
    );
  };
  
  const pendingSwapRequests = swapRequests.filter(r => r.status === 'pending');
  
  const hasChanges = Object.keys(shiftOverrides).length > 0 || newShifts.length > 0;
  
  return {
    data,
    isLoading,
    hasSchedule,
    hasChanges,
    locations: LOCATIONS,
    positions: POSITIONS,
    swapRequests,
    pendingSwapRequests,
    timeOffConflicts,
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
