import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { BudgetKPICards, BudgetChart, BudgetLocationTable } from '@/components/budgets';
import { useBudgetsData, type BudgetTab } from '@/hooks/useBudgetsData';

export default function Budgets() {
  const { hasPermission, loading: permLoading } = usePermissions();

  const initialDateRange = useMemo((): DateRangeValue => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }, []);

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<BudgetTab>('sales');

  const { isLoading, metrics, dailyData, locationData } = useBudgetsData(dateRange, selectedLocations);

  // Loading state
  if (permLoading) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Compare actual performance vs budget</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePickerNoryLike
            value={dateRange}
            onChange={(range, mode) => { setDateRange(range); setDateMode(mode); }}
            mode={dateMode}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BudgetTab)}>
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="cogs">COGS</TabsTrigger>
          <TabsTrigger value="prime">Prime Cost</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <BudgetKPICards metrics={metrics} activeTab={activeTab} isLoading={isLoading} />
      <BudgetChart data={dailyData} activeTab={activeTab} isLoading={isLoading} />
      {selectedLocations.length === 0 && <BudgetLocationTable data={locationData} isLoading={isLoading} />}
    </div>
  );
}
