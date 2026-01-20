import { useState } from 'react';
import { BISalesHeader } from '@/components/bi/BISalesHeader';
import { BIKpiCards } from '@/components/bi/BIKpiCards';
import { BISalesChart } from '@/components/bi/BISalesChart';
import { BIChannelsTable } from '@/components/bi/BIChannelsTable';
import { BICategoriesProducts } from '@/components/bi/BICategoriesProducts';
import { BILocationTable } from '@/components/bi/BILocationTable';
import { AskJosephinePanel } from '@/components/bi/AskJosephinePanel';
import { useBISalesData } from '@/hooks/useBISalesData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type CompareMode = 'forecast' | 'previous_period' | 'previous_year';
export type GranularityMode = 'daily' | 'weekly' | 'monthly';

export interface BIDateRange {
  from: Date;
  to: Date;
}

export default function BISales() {
  const [dateRange, setDateRange] = useState<BIDateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
  });
  const [granularity, setGranularity] = useState<GranularityMode>('daily');
  const [compareMode, setCompareMode] = useState<CompareMode>('forecast');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [askPanelOpen, setAskPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'orders'>('sales');

  const { data, isLoading } = useBISalesData({
    dateRange,
    granularity,
    compareMode,
    locationIds: selectedLocations
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Internal Header */}
      <BISalesHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        granularity={granularity}
        setGranularity={setGranularity}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        onAskJosephine={() => setAskPanelOpen(true)}
      />

      {/* KPI Cards */}
      <BIKpiCards data={data} isLoading={isLoading} compareMode={compareMode} />


      {/* Main Chart */}
      <BISalesChart 
        data={data} 
        isLoading={isLoading} 
        granularity={granularity}
        dateRange={dateRange}
      />

      {/* Channels Table */}
      <BIChannelsTable data={data} isLoading={isLoading} compareMode={compareMode} />

      {/* Categories + Products Row */}
      <BICategoriesProducts data={data} isLoading={isLoading} />

      {/* Sales by Location */}
      <BILocationTable data={data} isLoading={isLoading} />

      {/* Ask Josephine Panel */}
      <AskJosephinePanel 
        open={askPanelOpen} 
        onClose={() => setAskPanelOpen(false)}
        data={data}
      />
    </div>
  );
}
