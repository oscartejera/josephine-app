import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

interface WasteHeaderProps {
  dateRange: DateRangeValue;
  setDateRange: (value: DateRangeValue) => void;
  dateMode: DateMode;
  setDateMode: (value: DateMode) => void;
  selectedLocations: string[];
  setSelectedLocations: (value: string[]) => void;
  onAskJosephine?: () => void;
  isConnected?: boolean;
}

export function WasteHeader({
  dateRange,
  setDateRange,
  dateMode,
  setDateMode,
  selectedLocations,
  setSelectedLocations,
}: WasteHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Breadcrumbs and controls row */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('nav.insights')}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{t('waste.title')}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />

        {/* Date Range Picker */}
        <DateRangePickerNoryLike
          value={dateRange}
          onChange={setDateRange}
          mode={dateMode}
          onModeChange={setDateMode}
        />
      </div>

      {/* Title and location selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          {t('waste.totalAccountedWaste')}
        </h1>

        <div className="flex items-center gap-2">
          {/* More actions */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
