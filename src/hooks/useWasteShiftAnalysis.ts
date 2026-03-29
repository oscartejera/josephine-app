import { useMemo } from 'react';
import { getDay, getHours, format } from 'date-fns';

// ── Types ──

export type Shift = 'morning' | 'afternoon' | 'night';

export interface ShiftData {
  shift: Shift;
  label: string;
  timeRange: string;
  totalValue: number;
  totalCount: number;
  percentOfTotal: number;
  topReason: string;
}

export interface HeatmapCell {
  day: number;      // 0=Sun..6=Sat
  dayLabel: string;
  hour: number;     // 0-23
  value: number;
  count: number;
}

export interface WastePattern {
  id: string;
  type: 'recurring_spike' | 'shift_concentration' | 'reason_trend' | 'item_repeat';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric: string;
}

// ── Shift classification ──

function getShift(hour: number): Shift {
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

const SHIFT_META: Record<Shift, { label: string; timeRange: string }> = {
  morning:   { label: 'Mañana',  timeRange: '06:00 – 14:00' },
  afternoon: { label: 'Tarde',   timeRange: '14:00 – 22:00' },
  night:     { label: 'Noche',   timeRange: '22:00 – 06:00' },
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
  quantity?: number;
  inventory_item_id?: string;
  inventory_items?: { name?: string } | null;
}

export function useWasteShiftAnalysis(wasteEvents: WasteEvent[]) {
  const shiftData = useMemo<ShiftData[]>(() => {
    if (!wasteEvents.length) return [];

    const shifts: Record<Shift, { value: number; count: number; reasons: Record<string, number> }> = {
      morning:   { value: 0, count: 0, reasons: {} },
      afternoon: { value: 0, count: 0, reasons: {} },
      night:     { value: 0, count: 0, reasons: {} },
    };

    const totalValue = wasteEvents.reduce((sum, e) => sum + (e.waste_value || 0), 0);

    wasteEvents.forEach(event => {
      const hour = getHours(new Date(event.created_at));
      const shift = getShift(hour);
      const val = event.waste_value || 0;
      shifts[shift].value += val;
      shifts[shift].count += 1;
      const r = event.reason || 'other';
      shifts[shift].reasons[r] = (shifts[shift].reasons[r] || 0) + val;
    });

    return (['morning', 'afternoon', 'night'] as Shift[]).map(shift => {
      const d = shifts[shift];
      const topReason = Object.entries(d.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
      return {
        shift,
        label: SHIFT_META[shift].label,
        timeRange: SHIFT_META[shift].timeRange,
        totalValue: d.value,
        totalCount: d.count,
        percentOfTotal: totalValue > 0 ? (d.value / totalValue) * 100 : 0,
        topReason,
      };
    });
  }, [wasteEvents]);

  const heatmapData = useMemo<HeatmapCell[]>(() => {
    if (!wasteEvents.length) return [];

    // 7 days × 24 hours grid
    const grid = new Map<string, { value: number; count: number }>();

    wasteEvents.forEach(event => {
      const dt = new Date(event.created_at);
      const day = getDay(dt);
      const hour = getHours(dt);
      const key = `${day}-${hour}`;
      const existing = grid.get(key) || { value: 0, count: 0 };
      existing.value += event.waste_value || 0;
      existing.count += 1;
      grid.set(key, existing);
    });

    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const data = grid.get(`${day}-${hour}`) || { value: 0, count: 0 };
        cells.push({
          day,
          dayLabel: DAY_LABELS[day],
          hour,
          value: data.value,
          count: data.count,
        });
      }
    }
    return cells;
  }, [wasteEvents]);

  const patterns = useMemo<WastePattern[]>(() => {
    if (!wasteEvents.length) return [];

    const results: WastePattern[] = [];

    // Pattern 1: Day-of-week concentration
    const dayValues: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    wasteEvents.forEach(e => {
      const day = getDay(new Date(e.created_at));
      dayValues[day] += e.waste_value || 0;
      dayCounts[day] += 1;
    });
    const totalVal = dayValues.reduce((a, b) => a + b, 0);
    const avgDayVal = totalVal / 7;
    
    dayValues.forEach((val, day) => {
      if (val > avgDayVal * 1.8 && dayCounts[day] >= 3) {
        results.push({
          id: `day-spike-${day}`,
          type: 'recurring_spike',
          severity: val > avgDayVal * 2.5 ? 'high' : 'medium',
          title: `Pico recurrente: ${DAY_LABELS[day]}`,
          description: `Los ${DAY_LABELS[day]} concentran ${((val / totalVal) * 100).toFixed(0)}% de la merma total — ${((val / avgDayVal - 1) * 100).toFixed(0)}% más que la media diaria.`,
          metric: `€${val.toFixed(0)} (${dayCounts[day]} eventos)`,
        });
      }
    });

    // Pattern 2: Shift concentration
    const shiftValues: Record<Shift, number> = { morning: 0, afternoon: 0, night: 0 };
    wasteEvents.forEach(e => {
      const hour = getHours(new Date(e.created_at));
      shiftValues[getShift(hour)] += e.waste_value || 0;
    });
    const maxShift = (Object.entries(shiftValues) as [Shift, number][]).sort((a, b) => b[1] - a[1])[0];
    if (maxShift && maxShift[1] > totalVal * 0.55) {
      results.push({
        id: `shift-${maxShift[0]}`,
        type: 'shift_concentration',
        severity: maxShift[1] > totalVal * 0.7 ? 'high' : 'medium',
        title: `${SHIFT_META[maxShift[0]].label}: concentración anormal`,
        description: `El turno de ${SHIFT_META[maxShift[0]].label.toLowerCase()} (${SHIFT_META[maxShift[0]].timeRange}) acumula ${((maxShift[1] / totalVal) * 100).toFixed(0)}% de la merma. Investigar procesos del turno.`,
        metric: `€${maxShift[1].toFixed(0)}`,
      });
    }

    // Pattern 3: Repeat offender items
    const itemCounts = new Map<string, { count: number; value: number; name: string }>();
    wasteEvents.forEach(e => {
      const id = e.inventory_item_id || 'unknown';
      const name = e.inventory_items?.name || 'Unknown';
      const existing = itemCounts.get(id) || { count: 0, value: 0, name };
      existing.count += 1;
      existing.value += e.waste_value || 0;
      itemCounts.set(id, existing);
    });
    
    const repeatItems = Array.from(itemCounts.values())
      .filter(item => item.count >= 10 && item.value > totalVal * 0.05)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    
    repeatItems.forEach(item => {
      results.push({
        id: `repeat-${item.name}`,
        type: 'item_repeat',
        severity: item.value > totalVal * 0.1 ? 'high' : 'medium',
        title: `Recurrente: ${item.name}`,
        description: `${item.count} eventos de merma registrados — ${((item.value / totalVal) * 100).toFixed(1)}% del total. Posible problema sistémico.`,
        metric: `€${item.value.toFixed(0)} en ${item.count} eventos`,
      });
    });

    // Pattern 4: High reason concentration
    const reasonValues = new Map<string, number>();
    wasteEvents.forEach(e => {
      const r = e.reason || 'other';
      reasonValues.set(r, (reasonValues.get(r) || 0) + (e.waste_value || 0));
    });
    const sortedReasons = Array.from(reasonValues.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedReasons.length > 0 && sortedReasons[0][1] > totalVal * 0.4) {
      const [reason, value] = sortedReasons[0];
      results.push({
        id: `reason-${reason}`,
        type: 'reason_trend',
        severity: value > totalVal * 0.5 ? 'high' : 'low',
        title: `Motivo dominante: ${reason}`,
        description: `"${reason}" representa ${((value / totalVal) * 100).toFixed(0)}% de la merma. Posible área de mejora sistémica.`,
        metric: `€${value.toFixed(0)}`,
      });
    }

    return results.sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }, [wasteEvents]);

  return { shiftData, heatmapData, patterns };
}
