// Scheduling module — pure utility functions

import { addDays, format } from 'date-fns';
import type { Location, Shift, DayKPI } from './types';
import { UUID_REGEX, LEGACY_LOCATION_ALIASES, DAY_NAMES } from './types';

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

// Fix double-UTF-8 encoding (mojibake): MarÃ­a → María, etc.
export function fixEncoding(name: string): string {
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
export function getDepartment(roleName: string): string {
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

export function getStation(roleName: string): string {
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

// Build DayKPIs from forecast + shifts + actual
export function buildDailyKPIs(
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
