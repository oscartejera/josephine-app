// Scheduling module — data fetching functions

import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Location, Employee, Shift } from './types';
import { fixEncoding, getDepartment, getStation } from './utils';

// Fetch locations from DB
export async function fetchLocations(): Promise<Location[]> {
    const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');

    if (error) throw error;
    return data || [];
}

// Fetch employees for a location
export async function fetchEmployees(locationId: string): Promise<Employee[]> {
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
export async function fetchShifts(
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
export async function fetchForecastMetrics(
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
export async function fetchTargetCol(locationId: string): Promise<number> {
    const { data } = await supabase
        .from('location_settings')
        .select('target_col_percent')
        .eq('location_id', locationId)
        .maybeSingle();

    return data?.target_col_percent ?? 22; // Default 22%
}

// Fetch actual sales from sales_daily_unified (for past days comparison)
export async function fetchActualSales(
    locationId: string,
    weekStartISO: string,
    weekEndISO: string,
    dataSource: 'pos' | 'demo' = 'demo'
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
export async function checkForecastExists(locationId: string): Promise<boolean> {
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
export async function generateForecast(locationId: string): Promise<boolean> {
    console.log('[scheduling] Generating forecast for location:', locationId);

    try {
        const { data, error } = await supabase.functions.invoke('generate_forecast', {
            body: {
                location_id: locationId,
                horizon_days: 365
            }
        });

        if (error) {
            console.error('[scheduling] Forecast generation error:', error);
            return false;
        }

        console.log('[scheduling] Forecast generated:', data);
        return true;
    } catch (err) {
        console.error('[scheduling] Forecast generation exception:', err);
        return false;
    }
}
