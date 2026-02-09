import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { CashKPICards, CashLeakageChart, CashLocationTable } from '@/components/cash-management';
import { useCashManagementData } from '@/hooks/useCashManagementData';

export default function CashManagement() {
  const { locations } = useApp();
  const { hasPermission, loading: permLoading } = usePermissions();

  const initialDateRange = useMemo((): DateRangeValue => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }, []);

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationsOpen, setLocationsOpen] = useState(false);

  const { isLoading, metrics, dailyData, locationData } = useCashManagementData(dateRange, selectedLocations);

  // Loading state only - no access blocking
  if (permLoading) return null;

  const locationsLabel = selectedLocations.length === 0 ? 'All locations' :
    selectedLocations.length === 1 ? locations.find(l => l.id === selectedLocations[0])?.name :
    `${selectedLocations.length} locations`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Management</h1>
          <p className="text-sm text-muted-foreground">Monitor sales, payments, refunds and leakage</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={locationsOpen} onOpenChange={setLocationsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <MapPin className="h-4 w-4" />
                {locationsLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <div className="flex items-center space-x-2" onClick={() => setSelectedLocations([])}>
                  <Checkbox checked={selectedLocations.length === 0} />
                  <span className="text-sm">All locations</span>
                </div>
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center space-x-2" onClick={() => {
                    setSelectedLocations(prev => prev.includes(loc.id) ? prev.filter(id => id !== loc.id) : [...prev, loc.id]);
                  }}>
                    <Checkbox checked={selectedLocations.includes(loc.id)} />
                    <span className="text-sm">{loc.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
