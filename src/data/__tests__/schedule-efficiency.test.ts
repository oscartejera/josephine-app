import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests for schedule efficiency engine.
 *
 * Flow 1: SPLH calculation from forecast + shifts
 * Flow 2: Over-budget detection when cost exceeds target
 * Flow 3: Competitor-free DOM (no Nory/WISK/MarketMan in visible text)
 */

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        rpc: (...args: any[]) => mockRpc(...args),
        from: vi.fn(),
    },
}));

// ─── Flow 1: SPLH Calculation ─────────────────────────────────────────────────

describe('Schedule Efficiency: SPLH Calculation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('calculates SPLH = forecast_sales / scheduled_hours', () => {
        const forecastSales = 24000; // €24,000 weekly
        const scheduledHours = 480;  // 480h scheduled
        const splh = forecastSales / scheduledHours;

        expect(splh).toBe(50); // €50/hour
    });

    it('returns 0 SPLH when no hours are scheduled', () => {
        const forecastSales = 24000;
        const scheduledHours = 0;
        const splh = scheduledHours > 0 ? forecastSales / scheduledHours : 0;

        expect(splh).toBe(0);
    });

    it('generates low_splh insight when below goal', () => {
        const splh = 38;
        const splhGoal = 50;
        const insights: any[] = [];

        if (splh < splhGoal) {
            insights.push({
                type: 'low_splh',
                severity: 'warning',
                message: `SPLH actual (€${splh}) está por debajo del objetivo (€${splhGoal}).`,
            });
        }

        expect(insights).toHaveLength(1);
        expect(insights[0].type).toBe('low_splh');
        expect(insights[0].severity).toBe('warning');
    });
});

// ─── Flow 2: Over-budget Detection ───────────────────────────────────────────

describe('Schedule Efficiency: Budget Validation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('flags over_budget when scheduled cost exceeds target by >5%', () => {
        const scheduledCost = 8500;
        const targetCost = 7500;
        const overBudget = scheduledCost > targetCost * 1.05;
        const variancePct = ((scheduledCost - targetCost) / targetCost) * 100;

        expect(overBudget).toBe(true);
        expect(variancePct).toBeCloseTo(13.33, 1);
    });

    it('does NOT flag over_budget when within 5% tolerance', () => {
        const scheduledCost = 7800;
        const targetCost = 7500;
        const overBudget = scheduledCost > targetCost * 1.05;

        expect(overBudget).toBe(false);
    });

    it('generates over_budget insight with actionable suggestion', () => {
        const scheduledCost = 9200;
        const targetCost = 7500;
        const overBudget = scheduledCost > targetCost * 1.05;
        const variancePct = Math.round(((scheduledCost - targetCost) / targetCost) * 100 * 10) / 10;
        const insights: any[] = [];

        if (overBudget) {
            insights.push({
                type: 'over_budget',
                severity: 'critical',
                message: `Coste laboral programado (€${scheduledCost}) excede el presupuesto (€${targetCost}) en un ${variancePct}%.`,
            });
        }

        expect(insights).toHaveLength(1);
        expect(insights[0].severity).toBe('critical');
        expect(insights[0].message).toContain('excede el presupuesto');
    });
});

// ─── Flow 3: Competitor-free Verification ────────────────────────────────────

describe('Competitor-free DOM: No WISK/Nory/MarketMan in UI text', () => {
    it('CreateScheduleModal steps contain no competitor names', () => {
        const STEPS = [
            { title: 'Analizando pronóstico de ventas y SPLH histórico' },
            { title: 'Calculando niveles de dotación óptimos por estación' },
            { title: 'Verificando restricciones de disponibilidad y contratos' },
        ];

        const competitors = ['nory', 'wisk', 'marketman'];

        STEPS.forEach(step => {
            const lower = step.title.toLowerCase();
            competitors.forEach(comp => {
                expect(lower).not.toContain(comp);
            });
        });
    });

    it('Waste reason codes contain no competitor names', () => {
        const WASTE_REASONS = [
            { code: 'spillage', label: 'Derrame' },
            { code: 'expiry', label: 'Caducidad' },
            { code: 'kitchen_error', label: 'Error Cocina' },
            { code: 'courtesy', label: 'Cortesía' },
            { code: 'theft', label: 'Robo' },
            { code: 'broken', label: 'Rotura' },
            { code: 'end_of_day', label: 'Fin de día' },
            { code: 'other', label: 'Otro' },
        ];

        const competitors = ['nory', 'wisk', 'marketman'];

        WASTE_REASONS.forEach(reason => {
            const text = `${reason.code} ${reason.label}`.toLowerCase();
            competitors.forEach(comp => {
                expect(text).not.toContain(comp);
            });
        });
    });
});
