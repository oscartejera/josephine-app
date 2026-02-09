import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { CashKPICards, CashLeakageChart, CashLocationTable } from '@/components/cash-management';
import { useCashManagementData } from '@/hooks/useCashManagementData';

export default function CashManagement() {
  const { hasPermission, loading: permLoading } = usePermissions();

  const initialDateRange = useMemo((): DateRangeValue => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }, []);

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations] = useState<string[]>([]);

  const { isLoading, metrics, dailyData, locationData } = useCashManagementData(dateRange, selectedLocations);

  // Loading state only - no access blocking
  if (permLoading) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Management</h1>
          <p className="text-sm text-muted-foreground">Monitor sales, payments, refunds and leakage</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePickerNoryLike
            value={dateRange}
            onChange={(range, mode) => { setDateRange(range); setDateMode(mode); }}
            mode={dateMode}
          />
        </div>
      </div>

      {/* Content */}
      <CashKPICards metrics={metrics} isLoading={isLoading} />
      <CashLeakageChart data={dailyData} isLoading={isLoading} />
      {selectedLocations.length === 0 && <CashLocationTable data={locationData} isLoading={isLoading} />}
    </div>
  );
}
