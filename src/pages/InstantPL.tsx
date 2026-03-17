/**
 * InstantPL - Flash P&L dashboard page
 * Shows per-location P&L snapshot with actual vs forecast comparisons
 */

import { useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePLReport, type PLData } from '@/lib/pdfReports';
import { useApp } from '@/contexts/AppContext';
import {
  InstantPLHeader,
  FilterChips,
  LocationCardsGrid
} from '@/components/instant-pl';
import { MonthlyCostInput } from '@/components/instant-pl/MonthlyCostInput';
import {
  useInstantPLData,
  FilterMode,
  ChipFilter,
  PLDateRange
} from '@/hooks/useInstantPLData';
import { DateMode, ChartGranularity, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { useTranslation } from 'react-i18next';

export default function InstantPL() {
  const { t } = useTranslation();
  const { group } = useApp();
  // Date range state (default: current month)
  const [dateRange, setDateRange] = useState<PLDateRange>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  }));
  const [dateMode, setDateMode] = useState<DateMode>{t('instantPL.monthlyFilterModeStateBestworstall')}<FilterMode>{t('instantPL.allActiveChipsStateConst')}<ChipFilter[]>(['all_locations']);

  // Fetch data
  const { locations, chipCounts, lastUpdated, isLoading, isError } = useInstantPLData({
    dateRange,
    viewMode: 'amount', // Fixed to amount view
    filterMode,
    activeChips
  });

  // Handle date change
  const handleDateChange = useCallback((
    range: DateRangeValue,
    mode: DateMode,
    _granularity: ChartGranularity
  ) => {
    setDateRange({ from: range.from, to: range.to });
    setDateMode(mode);
  }, []);

  // Handle chip toggle
  const handleChipToggle = useCallback((chip: ChipFilter) => {
    setActiveChips(prev => {
      // If clicking "all_locations", reset to only that
      if (chip === 'all_locations') {
        return ['all_locations'];
      }

      // If currently only "all_locations" is active, switch to the clicked chip
      if (prev.length === 1 && prev[0] === 'all_locations') {
        return [chip];
      }

      // Toggle the chip
      if (prev.includes(chip)) {
        const newChips = prev.filter(c => c !== chip);
        // If no chips left, reset to all_locations
        return newChips.length === 0 ? ['all_locations'] : newChips;
      }

      // Add the chip (and remove all_locations if present)
      return [...prev.filter(c => c !== 'all_locations'), chip];
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <InstantPLHeader
        dateRange={dateRange}
        dateMode={dateMode}
        onDateChange={handleDateChange}
        onDateModeChange={setDateMode}
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
        lastUpdated={lastUpdated}
      />

      {/* PDF Export */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const orgName = group?.name || t('settings.restaurante');
            const period = format(dateRange.from, 'MMMM yyyy', { locale: es });
            const dateRangeStr = `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;
            const totalSales = locations.reduce((s, l) => s + (l.salesActual || 0), 0);
            const totalCogs = locations.reduce((s, l) => s + (l.cogsActual || 0), 0);
            const totalLabour = locations.reduce((s, l) => s + (l.labourActual || 0), 0);

            const plData: PLData = {
              orgName, period, dateRange: dateRangeStr,
              revenue: { netSales: totalSales, otherIncome: 0, totalRevenue: totalSales },
              cogs: { food: totalCogs * 0.75, beverage: totalCogs * 0.25, totalCogs, cogsPercent: totalSales > 0 ? totalCogs / totalSales * 100 : 0 },
              labour: { salaries: totalLabour * 0.85, socialSecurity: totalLabour * 0.15, totalLabour, labourPercent: totalSales > 0 ? totalLabour / totalSales * 100 : 0 },
              overheads: { rent: 0, utilities: 0, marketing: 0, other: 0, totalOverheads: 0 },
              summary: {
                grossProfit: totalSales - totalCogs,
                grossMargin: totalSales > 0 ? (totalSales - totalCogs) / totalSales * 100 : 0,
                primeCost: totalCogs + totalLabour,
                primeCostPercent: totalSales > 0 ? (totalCogs + totalLabour) / totalSales * 100 : 0,
                ebitda: totalSales - totalCogs - totalLabour,
                ebitdaPercent: totalSales > 0 ? (totalSales - totalCogs - totalLabour) / totalSales * 100 : 0,
              },
            };
            generatePLReport(plData);
          }}
          disabled={isLoading || locations.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          {t('instantPL.exportarPlPdf')}
        </Button>
      </div>

      {/* Filter Chips */}
      <FilterChips
        counts={chipCounts}
        activeChips={activeChips}
        onChipToggle={handleChipToggle}
      />

      {/* COGS Input — Native manual entry */}
      <MonthlyCostInput
        year={dateRange.from.getFullYear()}
        month={dateRange.from.getMonth() + 1}
      />

      {/* Location Cards Grid */}
      <LocationCardsGrid
        locations={locations}
        viewMode="amount"
        isLoading={isLoading}
      />

      {/* Error state */}
      {isError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
          <p className="text-destructive font-medium">
            {t('instantPL.failedToLoadPlData')}
          </p>
        </div>
      )}
    </div>
  );
}
