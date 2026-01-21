import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, ChevronDown, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NoAccess } from '@/components/common/NoAccess';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { BudgetKPICards, BudgetChart, BudgetLocationTable } from '@/components/budgets';
import { useBudgetsData, type BudgetTab } from '@/hooks/useBudgetsData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [seeding, setSeeding] = useState(false);

  const { isLoading, metrics, dailyData, locationData, hasData, refetch } = useBudgetsData(dateRange, selectedLocations);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      const locationIds = locations.map(l => l.id);
      const budgetRows = [];
      const labourRows = [];
      const cogsRows = [];
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const locId of locationIds) {
          const budgetSales = 8000 + Math.random() * 12000;
          budgetRows.push({
            date: dateStr,
            location_id: locId,
            budget_sales: Math.round(budgetSales),
            budget_labour: Math.round(budgetSales * (0.25 + Math.random() * 0.1)),
            budget_cogs: Math.round(budgetSales * (0.25 + Math.random() * 0.1)),
          });
          labourRows.push({
            date: dateStr,
            location_id: locId,
            labour_cost: Math.round(budgetSales * (0.22 + Math.random() * 0.12)),
            labour_hours: Math.round((budgetSales * 0.28) / 14),
          });
          cogsRows.push({
            date: dateStr,
            location_id: locId,
            cogs_amount: Math.round(budgetSales * (0.22 + Math.random() * 0.12)),
          });
        }
      }

      await Promise.all([
        supabase.from('budgets_daily').upsert(budgetRows, { onConflict: 'date,location_id' }),
        supabase.from('labour_daily').upsert(labourRows, { onConflict: 'date,location_id' }),
        supabase.from('cogs_daily').upsert(cogsRows, { onConflict: 'date,location_id' }),
      ]);
      
      toast.success('Demo data generated successfully');
      refetch();
    } catch (err) {
      console.error('Error seeding data:', err);
      toast.error('Failed to generate demo data');
    } finally {
      setSeeding(false);
    }
  };

  if (permLoading) return null;
  if (!hasPermission('budgets.view')) return <NoAccess />;

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

      {/* Empty State */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-sm text-muted-foreground mb-4">Generate demo data to explore Budgets</p>
          <Button onClick={handleSeedDemoData} disabled={seeding}>
            {seeding ? 'Generating...' : 'Generate Demo Data'}
          </Button>
        </div>
      )}

      {/* Content */}
      {(isLoading || hasData) && (
        <>
          <BudgetKPICards metrics={metrics} activeTab={activeTab} isLoading={isLoading} />
          <BudgetChart data={dailyData} activeTab={activeTab} isLoading={isLoading} />
          {selectedLocations.length === 0 && <BudgetLocationTable data={locationData} isLoading={isLoading} />}
        </>
      )}
    </div>
  );
}
