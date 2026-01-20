import { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, addDays, format, differenceInHours } from 'date-fns';

// Types
export type ViewMode = 'departments' | 'people' | 'positions' | 'stations';

export interface Employee {
  id: string;
  name: string;
  initials: string;
  department: string;
  position: string;
  station: string;
  weeklyHours: number;
  targetHours: number;
  availability: Record<string, 'available' | 'unavailable' | 'day_off'>;
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
}

// Seeded random for consistent data
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
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

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

function generateEmployees(rng: SeededRandom, count: number): Employee[] {
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
    
    // Generate availability for the week
    const availability: Record<string, 'available' | 'unavailable' | 'day_off'> = {};
    for (let d = 0; d < 7; d++) {
      const rand = rng.next();
      if (rand < 0.1) {
        availability[d.toString()] = 'unavailable';
      } else if (rand < 0.15 && (d === 5 || d === 6)) {
        availability[d.toString()] = 'day_off';
      } else {
        availability[d.toString()] = 'available';
      }
    }
    
    employees.push({
      id: `emp-${i}`,
      name,
      initials,
      department,
      position,
      station,
      weeklyHours: 0,
      targetHours,
      availability,
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
  
  // Generate shifts for each employee
  employees.forEach((emp, empIndex) => {
    let weeklyHours = 0;
    
    for (let day = 0; day < 7; day++) {
      const date = format(addDays(weekStart, day), 'yyyy-MM-dd');
      const availability = emp.availability[day.toString()];
      
      if (availability === 'available' && weeklyHours < emp.targetHours) {
        if (rng.next() > 0.2) { // 80% chance of having a shift
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
  
  const location = LOCATIONS.find(l => l.id === locationId) || LOCATIONS[1];
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  const data = useMemo((): ScheduleData | null => {
    if (!hasSchedule) return null;
    
    const seed = `${locationId}-${format(weekStart, 'yyyy-MM-dd')}-v${scheduleVersion}`;
    const rng = new SeededRandom(seed);
    
    const employeeCount = rng.intRange(10, 15);
    const employees = generateEmployees(rng, employeeCount);
    const { shifts, openShifts } = generateShifts(rng, employees, weekStart);
    const dailyKPIs = generateDailyKPIs(rng, weekStart);
    
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
    };
  }, [locationId, weekStart, hasSchedule, scheduleVersion, location.name]);
  
  const createSchedule = async (): Promise<void> => {
    setIsLoading(true);
    // Simulated AI processing
    await new Promise(resolve => setTimeout(resolve, 4500));
    setHasSchedule(true);
    setScheduleVersion(v => v + 1);
    setIsLoading(false);
  };
  
  const undoSchedule = () => {
    if (previousSchedule) {
      setScheduleVersion(v => v - 1);
    } else {
      setHasSchedule(false);
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
  
  return {
    data,
    isLoading,
    hasSchedule,
    locations: LOCATIONS,
    createSchedule,
    undoSchedule,
    acceptSchedule,
    publishSchedule,
  };
}
