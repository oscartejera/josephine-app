/**
 * LocationPLCard - Individual location P&L card for Instant P&L
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LocationPLMetrics, ViewMode } from '@/hooks/useInstantPLData';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LocationPLCardProps {
  data: LocationPLMetrics;
  viewMode: ViewMode;
  isSelected?: boolean;
  onClick?: () => void;
}

/** Null-safe formatter: returns "—" for null/undefined, delegates to fn otherwise */
function fmtN<T extends number>(value: T | null | undefined, fn: (v: T) => string): string {
  return value != null ? fn(value) : '—';
}

// Format currency
function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return `€${(value / 1000).toFixed(1)}k`;
  }
  return `€${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format percentage
function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format hours
function formatHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

// Delta badge component
function DeltaBadge({ 
  value, 
  isBetter, 
  isPercentage = true 
}: { 
  value: number; 
  isBetter: boolean;
  isPercentage?: boolean;
}) {
  const isPositive = value > 0;
  const displayValue = isPercentage 
    ? `${isPositive ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`
    : `${isPositive ? '↑' : '↓'} ${formatCurrency(Math.abs(value), true)}`;
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        isBetter
          ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]"
          : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
      )}
    >
      {displayValue}
    </span>
  );
}

// Metric row component
function MetricRow({
  label,
  actualPrimary,
  actualSecondary,
  forecastPrimary,
  forecastSecondary,
  delta,
  isBetter,
  tooltipContent
}: {
  label: string;
  actualPrimary: string;
  actualSecondary?: string;
  forecastPrimary: string;
  forecastSecondary?: string;
  delta: number | null;
  isBetter: boolean;
  tooltipContent?: string;
}) {
  const innerContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{actualPrimary}</span>
            {actualSecondary && (
              <span className="text-xs text-muted-foreground">{actualSecondary}</span>
            )}
          </div>
        </div>
        {delta != null && <DeltaBadge value={delta} isBetter={isBetter} />}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Forecast: {forecastPrimary}
        {forecastSecondary && ` (${forecastSecondary})`}
      </p>
    </>
  );
  
  if (tooltipContent) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="py-2.5 border-b border-border/40 last:border-b-0 cursor-help">
            {innerContent}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <div className="py-2.5 border-b border-border/40 last:border-b-0">
      {innerContent}
    </div>
  );
}

export function LocationPLCard({ 
  data, 
  viewMode, 
  isSelected = false,
  onClick 
}: LocationPLCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Compute display values based on view mode
  const getSalesDisplay = () => ({
    actualPrimary: formatCurrency(data.salesActual),
    actualSecondary: undefined,
    forecastPrimary: formatCurrency(data.salesForecast),
    forecastSecondary: undefined
  });
  
  const getCogsDisplay = () => {
    if (data.cogsActual == null) {
      return {
        actualPrimary: '—',
        actualSecondary: 'Not configured',
        forecastPrimary: '—',
        forecastSecondary: ''
      };
    }
    if (viewMode === 'percentage') {
      return {
        actualPrimary: fmtN(data.cogsActualPct, formatPct),
        actualSecondary: formatCurrency(data.cogsActual, true),
        forecastPrimary: fmtN(data.cogsForecastPct, formatPct),
        forecastSecondary: formatCurrency(data.cogsForecast ?? 0, true)
      };
    }
    return {
      actualPrimary: formatCurrency(data.cogsActual),
      actualSecondary: fmtN(data.cogsActualPct, formatPct),
      forecastPrimary: formatCurrency(data.cogsForecast ?? 0),
      forecastSecondary: fmtN(data.cogsForecastPct, formatPct)
    };
  };
  
  const getLabourDisplay = () => {
    if (viewMode === 'hours') {
      return {
        actualPrimary: formatHours(data.labourHoursActual),
        actualSecondary: formatCurrency(data.labourActual, true),
        forecastPrimary: formatHours(data.labourHoursForecast),
        forecastSecondary: formatCurrency(data.labourForecast, true)
      };
    }
    if (viewMode === 'percentage') {
      return {
        actualPrimary: formatPct(data.labourActualPct),
        actualSecondary: formatCurrency(data.labourActual, true),
        forecastPrimary: formatPct(data.labourForecastPct),
        forecastSecondary: formatCurrency(data.labourForecast, true)
      };
    }
    return {
      actualPrimary: formatCurrency(data.labourActual),
      actualSecondary: formatPct(data.labourActualPct),
      forecastPrimary: formatCurrency(data.labourForecast),
      forecastSecondary: formatPct(data.labourForecastPct)
    };
  };
  
  const getFlashProfitDisplay = () => {
    // Flash Profit is data-driven: requires COGS to be meaningful
    if (data.flashProfitActual == null) {
      return {
        actualPrimary: '—',
        actualSecondary: 'Requires COGS',
        forecastPrimary: '—',
        forecastSecondary: ''
      };
    }
    if (viewMode === 'percentage') {
      return {
        actualPrimary: fmtN(data.flashProfitActualPct, formatPct),
        actualSecondary: formatCurrency(data.flashProfitActual, true),
        forecastPrimary: fmtN(data.flashProfitForecastPct, formatPct),
        forecastSecondary: formatCurrency(data.flashProfitForecast ?? 0, true)
      };
    }
    return {
      actualPrimary: formatCurrency(data.flashProfitActual),
      actualSecondary: fmtN(data.flashProfitActualPct, formatPct),
      forecastPrimary: formatCurrency(data.flashProfitForecast ?? 0),
      forecastSecondary: fmtN(data.flashProfitForecastPct, formatPct)
    };
  };
  
  const salesDisplay = getSalesDisplay();
  const cogsDisplay = getCogsDisplay();
  const labourDisplay = getLabourDisplay();
  const flashProfitDisplay = getFlashProfitDisplay();
  
  return (
    <div
      className={cn(
        "flex-shrink-0 w-[260px] bg-card rounded-xl border transition-all cursor-pointer",
        isHovered ? "shadow-lg" : "shadow-sm",
        isSelected 
          ? "border-primary ring-1 ring-primary/30" 
          : "border-border/60 hover:border-border"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40">
        <h3 className="font-semibold text-sm">{data.locationName}</h3>
      </div>
      
      {/* Metrics */}
      <div className="px-4">
        <MetricRow
          label="Sales"
          actualPrimary={salesDisplay.actualPrimary}
          actualSecondary={salesDisplay.actualSecondary}
          forecastPrimary={salesDisplay.forecastPrimary}
          forecastSecondary={salesDisplay.forecastSecondary}
          delta={data.salesDeltaPct}
          isBetter={data.salesDelta >= 0}
        />
        
        <MetricRow
          label="CoGS"
          actualPrimary={cogsDisplay.actualPrimary}
          actualSecondary={cogsDisplay.actualSecondary}
          forecastPrimary={cogsDisplay.forecastPrimary}
          forecastSecondary={cogsDisplay.forecastSecondary}
          delta={data.cogsDeltaPct}
          isBetter={data.cogsIsBetter}
          tooltipContent={`Average CoGS across all locations. Lower is better.`}
        />
        
        <MetricRow
          label={viewMode === 'hours' ? 'Labour Hours' : 'Cost of Labour'}
          actualPrimary={labourDisplay.actualPrimary}
          actualSecondary={labourDisplay.actualSecondary}
          forecastPrimary={labourDisplay.forecastPrimary}
          forecastSecondary={labourDisplay.forecastSecondary}
          delta={data.labourDeltaPct}
          isBetter={data.labourIsBetter}
          tooltipContent={`Labour cost compared to forecast. Under planned is better.`}
        />
        
        <MetricRow
          label="Flash Profit"
          actualPrimary={flashProfitDisplay.actualPrimary}
          actualSecondary={flashProfitDisplay.actualSecondary}
          forecastPrimary={flashProfitDisplay.forecastPrimary}
          forecastSecondary={flashProfitDisplay.forecastSecondary}
          delta={data.flashProfitDeltaPct}
          isBetter={data.flashProfitIsBetter}
        />
      </div>
      
      {/* Bottom padding */}
      <div className="h-3" />
    </div>
  );
}
