import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue, type ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import { useTranslation } from 'react-i18next';

interface Location {
  id: string;
  name: string;
}

interface MenuEngineeringHeaderProps {
  selectedLocationId: string | null;
  onLocationChange: (id: string | null) => void;
  dateRange: DateRangeValue;
  dateMode: DateMode;
  onDateChange: (range: DateRangeValue, mode: DateMode, granularity: ChartGranularity) => void;
  onDateModeChange: (mode: DateMode) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onRefresh: () => void;
  loading: boolean;
  accessibleLocations: Location[];
}

export function MenuEngineeringHeader({
  
  selectedLocationId,
  onLocationChange,
  dateRange,
  dateMode,
  onDateChange,
  onDateModeChange,
  categories,
  selectedCategory,
  onCategoryChange,
  onRefresh,
  loading,
  accessibleLocations,
}: MenuEngineeringHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Menu Profitability</h1>
          <p className="text-muted-foreground">Discover which products make you the most money</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedLocationId || 'all'} onValueChange={(v) => onLocationChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {accessibleLocations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePickerNoryLike
          value={dateRange}
          onChange={onDateChange}
          mode={dateMode}
          onModeChange={onDateModeChange}
          isLoading={loading}
        />

        <Select value={selectedCategory || 'all'} onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
