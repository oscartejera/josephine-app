import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, ChevronDown, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NoAccess } from '@/components/common/NoAccess';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { CashKPICards, CashLeakageChart, CashLocationTable } from '@/components/cash-management';
import { useCashManagementData } from '@/hooks/useCashManagementData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CashManagement() {
  const { locations } = useApp();
  const { hasPermission, isLoading: permLoading } = usePermissions();

  const initialDateRange = useMemo((): DateRangeValue => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }, []);

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { isLoading, metrics, dailyData, locationData, hasData, refetch } = useCashManagementData(dateRange, selectedLocations);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      // Insert demo data directly
      const locationIds = locations.map(l => l.id);
      const rows = [];
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const locId of locationIds) {
          const baseSales = 5000 + Math.random() * 15000;
          const cashPct = 0.15 + Math.random() * 0.25;
          rows.push({
            date: dateStr,
            location_id: locId,
            net_sales: Math.round(baseSales),
            gross_sales: Math.round(baseSales * 1.1),
            orders_count: Math.round(baseSales / 35),
            payments_cash: Math.round(baseSales * cashPct),
            payments_card: Math.round(baseSales * (1 - cashPct)),
            payments_other: 0,
            refunds_amount: Math.round(baseSales * (0.002 + Math.random() * 0.013)),
            refunds_count: Math.round(Math.random() * 5),
            discounts_amount: Math.round(baseSales * (0.01 + Math.random() * 0.03)),
            comps_amount: Math.round(baseSales * Math.random() * 0.01),
            voids_amount: Math.round(baseSales * Math.random() * 0.005),
          });
        }
      }

      const { error } = await supabase.from('pos_daily_finance').upsert(rows, { onConflict: 'date,location_id' });
      if (error) throw error;
      
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
  if (!hasPermission('cash_management.view')) return <NoAccess />;

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

      {/* Empty State */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-sm text-muted-foreground mb-4">Generate demo data to explore Cash Management</p>
          <Button onClick={handleSeedDemoData} disabled={seeding}>
            {seeding ? 'Generating...' : 'Generate Demo Data'}
          </Button>
        </div>
      )}

      {/* Content */}
      {(isLoading || hasData) && (
        <>
          <CashKPICards metrics={metrics} isLoading={isLoading} />
          <CashLeakageChart data={dailyData} isLoading={isLoading} />
          {selectedLocations.length === 0 && <CashLocationTable data={locationData} isLoading={isLoading} />}
        </>
      )}
    </div>
  );
}
