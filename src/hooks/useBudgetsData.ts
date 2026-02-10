import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, subDays, differenceInDays } from 'date-fns';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export type BudgetTab = 'sales' | 'labour' | 'cogs' | 'prime';
export type CompareMode = 'budget' | 'previous';

export interface BudgetMetrics {
  // Sales
  salesActual: number;
  salesBudget: number;
  salesVarEur: number;
  salesVarPct: number;
  // Labour
  labourActual: number;
  labourBudget: number;
  labourVarEur: number;
  labourVarPct: number;
  labourHoursActual: number;
  labourHoursBudget: number;
  // COGS
  cogsActual: number;
  cogsBudget: number;
  cogsVarEur: number;
  cogsVarPct: number;
  cogsPctActual: number;
  cogsPctBudget: number;
  // Prime Cost
  primeActual: number;
  primeBudget: number;
  primePctActual: number;
  primePctBudget: number;
  primeVarPp: number;
  primeStatus: 'on_track' | 'at_risk' | 'over_budget';
}

export interface BudgetDailyData {
  date: string;
  salesActual: number;
  salesBudget: number;
  labourActual: number;
  labourBudget: number;
  cogsActual: number;
  cogsBudget: number;
  primeActual: number;
  primeBudget: number;
  primePctActual: number;
  primePctBudget: number;
}

export interface BudgetLocationData {
  locationId: string;
  locationName: string;
  salesActual: number;
  salesBudget: number;
  salesVarEur: number;
  salesVarPct: number;
  labourActual: number;
  labourBudget: number;
  labourVarPct: number;
  cogsActual: number;
  cogsBudget: number;
  cogsVarPct: number;
  primePctActual: number;
  primePctBudget: number;
  primeVarPp: number;
  status: 'on_track' | 'at_risk' | 'over_budget' | 'high_sales_over_labour';
}

const defaultMetrics: BudgetMetrics = {
  salesActual: 0,
  salesBudget: 0,
  salesVarEur: 0,
  salesVarPct: 0,
  labourActual: 0,
  labourBudget: 0,
  labourVarEur: 0,
  labourVarPct: 0,
  labourHoursActual: 0,
  labourHoursBudget: 0,
  cogsActual: 0,
  cogsBudget: 0,
  cogsVarEur: 0,
  cogsVarPct: 0,
  cogsPctActual: 0,
  cogsPctBudget: 0,
  primeActual: 0,
  primeBudget: 0,
  primePctActual: 0,
  primePctBudget: 0,
  primeVarPp: 0,
  primeStatus: 'on_track',
};

export function useBudgetsData(
  dateRange: DateRangeValue,
  selectedLocations: string[],
  compareMode: CompareMode = 'budget'
) {
  const { locations, loading: appLoading, dataSource } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<BudgetMetrics>(defaultMetrics);
  const [dailyData, setDailyData] = useState<BudgetDailyData[]>([]);
  const [locationData, setLocationData] = useState<BudgetLocationData[]>([]);
  const [hasData, setHasData] = useState(false);

  const effectiveLocationIds = useMemo(() => {
    if (selectedLocations.length > 0) return selectedLocations;
    return locations.map(l => l.id);
  }, [selectedLocations, locations]);

  const fetchData = useCallback(async () => {
    if (!dateRange.from || !dateRange.to || appLoading) return;

    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch budgets
      let budgetQuery = supabase
        .from('budgets_daily')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        budgetQuery = budgetQuery.in('location_id', effectiveLocationIds);
      }

      const { data: budgetData, error: budgetError } = await budgetQuery;

      // Fetch actuals - pos_daily_finance for sales
      let salesQuery = supabase
        .from('pos_daily_finance')
        .select('date, location_id, net_sales')
        .eq('data_source', dataSource)
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        salesQuery = salesQuery.in('location_id', effectiveLocationIds);
      }

      const { data: salesData } = await salesQuery;

      // Fetch labour
      let labourQuery = supabase
        .from('labour_daily')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        labourQuery = labourQuery.in('location_id', effectiveLocationIds);
      }

      const { data: labourData } = await labourQuery;

      // Fetch COGS
      let cogsQuery = supabase
        .from('cogs_daily')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        cogsQuery = cogsQuery.in('location_id', effectiveLocationIds);
      }

      const { data: cogsData } = await cogsQuery;

      const hasBudgets = budgetData && budgetData.length > 0;
      const hasSales = salesData && salesData.length > 0;
      setHasData(hasBudgets || hasSales);

      if (!hasBudgets && !hasSales) {
        setMetrics(defaultMetrics);
        setDailyData([]);
        setLocationData([]);
        setIsLoading(false);
        return;
      }

      // Aggregate totals
      const salesActual = (salesData || []).reduce((sum, r) => sum + (r.net_sales || 0), 0);
      const salesBudget = (budgetData || []).reduce((sum, r) => sum + (r.budget_sales || 0), 0);
      const labourActual = (labourData || []).reduce((sum, r) => sum + (r.labour_cost || 0), 0);
      const labourBudget = (budgetData || []).reduce((sum, r) => sum + (r.budget_labour || 0), 0);
      const labourHoursActual = (labourData || []).reduce((sum, r) => sum + (r.labour_hours || 0), 0);
      const cogsActual = (cogsData || []).reduce((sum, r) => sum + (r.cogs_amount || 0), 0);
      const cogsBudget = (budgetData || []).reduce((sum, r) => sum + (r.budget_cogs || 0), 0);

      const primeActual = labourActual + cogsActual;
      const primeBudget = labourBudget + cogsBudget;
      const primePctActual = salesActual > 0 ? (primeActual / salesActual) * 100 : 0;
      const primePctBudget = salesBudget > 0 ? (primeBudget / salesBudget) * 100 : 0;
      const primeVarPp = primePctActual - primePctBudget;

      const salesVarPct = salesBudget > 0 ? ((salesActual - salesBudget) / salesBudget) * 100 : 0;
      const labourVarPct = labourBudget > 0 ? ((labourActual - labourBudget) / labourBudget) * 100 : 0;

      let primeStatus: 'on_track' | 'at_risk' | 'over_budget' = 'on_track';
      if (primeVarPp > 2 || (salesVarPct < -5 && labourVarPct > 5)) {
        primeStatus = 'at_risk';
      }
      if (primeVarPp > 5) {
        primeStatus = 'over_budget';
      }

      setMetrics({
        salesActual,
        salesBudget,
        salesVarEur: salesActual - salesBudget,
        salesVarPct,
        labourActual,
        labourBudget,
        labourVarEur: labourActual - labourBudget,
        labourVarPct,
        labourHoursActual,
        labourHoursBudget: 0, // Could be calculated from budget if we store hours
        cogsActual,
        cogsBudget,
        cogsVarEur: cogsActual - cogsBudget,
        cogsVarPct: cogsBudget > 0 ? ((cogsActual - cogsBudget) / cogsBudget) * 100 : 0,
        cogsPctActual: salesActual > 0 ? (cogsActual / salesActual) * 100 : 0,
        cogsPctBudget: salesBudget > 0 ? (cogsBudget / salesBudget) * 100 : 0,
        primeActual,
        primeBudget,
        primePctActual,
        primePctBudget,
        primeVarPp,
        primeStatus,
      });

      // Daily data for chart
      const dailyMap = new Map<string, BudgetDailyData>();

      (budgetData || []).forEach(row => {
        const existing = dailyMap.get(row.date) || createEmptyDailyData(row.date);
        existing.salesBudget += row.budget_sales || 0;
        existing.labourBudget += row.budget_labour || 0;
        existing.cogsBudget += row.budget_cogs || 0;
        existing.primeBudget = existing.labourBudget + existing.cogsBudget;
        existing.primePctBudget = existing.salesBudget > 0 
          ? (existing.primeBudget / existing.salesBudget) * 100 : 0;
        dailyMap.set(row.date, existing);
      });

      (salesData || []).forEach(row => {
        const existing = dailyMap.get(row.date) || createEmptyDailyData(row.date);
        existing.salesActual += row.net_sales || 0;
        dailyMap.set(row.date, existing);
      });

      (labourData || []).forEach(row => {
        const existing = dailyMap.get(row.date) || createEmptyDailyData(row.date);
        existing.labourActual += row.labour_cost || 0;
        existing.primeActual = existing.labourActual + existing.cogsActual;
        existing.primePctActual = existing.salesActual > 0 
          ? (existing.primeActual / existing.salesActual) * 100 : 0;
        dailyMap.set(row.date, existing);
      });

      (cogsData || []).forEach(row => {
        const existing = dailyMap.get(row.date) || createEmptyDailyData(row.date);
        existing.cogsActual += row.cogs_amount || 0;
        existing.primeActual = existing.labourActual + existing.cogsActual;
        existing.primePctActual = existing.salesActual > 0 
          ? (existing.primeActual / existing.salesActual) * 100 : 0;
        dailyMap.set(row.date, existing);
      });

      setDailyData(Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

      // Location data
      const locMap = new Map<string, any>();

      (budgetData || []).forEach(row => {
        const existing = locMap.get(row.location_id) || createEmptyLocBudget();
        existing.salesBudget += row.budget_sales || 0;
        existing.labourBudget += row.budget_labour || 0;
        existing.cogsBudget += row.budget_cogs || 0;
        locMap.set(row.location_id, existing);
      });

      (salesData || []).forEach(row => {
        const existing = locMap.get(row.location_id) || createEmptyLocBudget();
        existing.salesActual += row.net_sales || 0;
        locMap.set(row.location_id, existing);
      });

      (labourData || []).forEach(row => {
        const existing = locMap.get(row.location_id) || createEmptyLocBudget();
        existing.labourActual += row.labour_cost || 0;
        locMap.set(row.location_id, existing);
      });

      (cogsData || []).forEach(row => {
        const existing = locMap.get(row.location_id) || createEmptyLocBudget();
        existing.cogsActual += row.cogs_amount || 0;
        locMap.set(row.location_id, existing);
      });

      const locDataArray: BudgetLocationData[] = [];
      locMap.forEach((data, locId) => {
        const loc = locations.find(l => l.id === locId);
        const primeActualLoc = data.labourActual + data.cogsActual;
        const primeBudgetLoc = data.labourBudget + data.cogsBudget;
        const primePctActualLoc = data.salesActual > 0 ? (primeActualLoc / data.salesActual) * 100 : 0;
        const primePctBudgetLoc = data.salesBudget > 0 ? (primeBudgetLoc / data.salesBudget) * 100 : 0;
        const primeVarPpLoc = primePctActualLoc - primePctBudgetLoc;
        const salesVarPctLoc = data.salesBudget > 0 
          ? ((data.salesActual - data.salesBudget) / data.salesBudget) * 100 : 0;
        const labourVarPctLoc = data.labourBudget > 0 
          ? ((data.labourActual - data.labourBudget) / data.labourBudget) * 100 : 0;

        let status: BudgetLocationData['status'] = 'on_track';
        if (primeVarPpLoc > 2 || (salesVarPctLoc < -5 && labourVarPctLoc > 5)) {
          status = 'at_risk';
        }
        if (salesVarPctLoc > 0 && labourVarPctLoc > 5) {
          status = 'high_sales_over_labour';
        }

        locDataArray.push({
          locationId: locId,
          locationName: loc?.name || 'Unknown',
          salesActual: data.salesActual,
          salesBudget: data.salesBudget,
          salesVarEur: data.salesActual - data.salesBudget,
          salesVarPct: salesVarPctLoc,
          labourActual: data.labourActual,
          labourBudget: data.labourBudget,
          labourVarPct: labourVarPctLoc,
          cogsActual: data.cogsActual,
          cogsBudget: data.cogsBudget,
          cogsVarPct: data.cogsBudget > 0 
            ? ((data.cogsActual - data.cogsBudget) / data.cogsBudget) * 100 : 0,
          primePctActual: primePctActualLoc,
          primePctBudget: primePctBudgetLoc,
          primeVarPp: primeVarPpLoc,
          status,
        });
      });

      setLocationData(locDataArray.sort((a, b) => b.primeVarPp - a.primeVarPp));
    } catch (err) {
      console.error('Error in useBudgetsData:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, effectiveLocationIds, locations, appLoading, compareMode]);

  useEffect(() => {
    if (!appLoading) {
      fetchData();
    }
  }, [fetchData, appLoading]);

  return { isLoading, metrics, dailyData, locationData, hasData, refetch: fetchData };
}

function createEmptyDailyData(date: string): BudgetDailyData {
  return {
    date,
    salesActual: 0,
    salesBudget: 0,
    labourActual: 0,
    labourBudget: 0,
    cogsActual: 0,
    cogsBudget: 0,
    primeActual: 0,
    primeBudget: 0,
    primePctActual: 0,
    primePctBudget: 0,
  };
}

function createEmptyLocBudget() {
  return {
    salesActual: 0,
    salesBudget: 0,
    labourActual: 0,
    labourBudget: 0,
    cogsActual: 0,
    cogsBudget: 0,
  };
}
