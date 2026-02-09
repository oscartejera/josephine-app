import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { BudgetKPICards, BudgetChart, BudgetLocationTable } from '@/components/budgets';
import { useBudgetsData, type BudgetTab } from '@/hooks/useBudgetsData';

export default function Budgets() {
  const { locations } = useApp();
  const { hasPermission, loading: permLoading } = usePermissions();

  const initialDateRange = useMemo((): DateRangeValue => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }, []);

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<BudgetTab>('sales');
  const [locationsOpen, setLocationsOpen] = useState(false);

  const { isLoading, metrics, dailyData, locationData } = useBudgetsData(dateRange, selectedLocations);

  // Loading state
  if (permLoading) return null;

  const locationsLabel = selectedLocations.length === 0 ? 'All locations' :
    selectedLocations.length === 1 ? locations.find(l => l.id === selectedLocations[0])?.name :
    `${selectedLocations.length} locations`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Compare actual performance vs budget</p>
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
                <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setSelectedLocations([])}>
                  <Checkbox checked={selectedLocations.length === 0} />
                  <span className="text-sm">All locations</span>
                </div>
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => {
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
