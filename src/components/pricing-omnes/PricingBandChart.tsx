import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { PricingOmnesCategoryResult } from '@/lib/pricing-omnes-engine';
import { useTranslation } from 'react-i18next';

interface PricingBandChartProps {
  result: PricingOmnesCategoryResult | null;
  loading: boolean;
}

const BAND_COLORS = {
  lower: 'hsl(213, 94%, 68%)',    // blue
  middle: 'hsl(271, 91%, 65%)',   // violet
  upper: 'hsl(346, 77%, 64%)',    // rose
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      price: number;
      units: number;
      revenue: number;
      band: string;
      isPromo: boolean;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{d.name}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
        <span>Price:</span><span className="text-foreground font-medium">€{d.price.toFixed(2)}</span>
        <span>Units:</span><span className="text-foreground">{d.units}</span>
        <span>Revenue:</span><span className="text-foreground">€{d.revenue.toFixed(0)}</span>
        <span>Band:</span><span className="text-foreground capitalize">{d.band === 'lower' ? 'Lower' : d.band === 'middle' ? 'Middle' : 'Upper'}</span>
        {d.isPromo && <><span>🎯</span><span className="text-violet-600 font-medium">Promote</span></>}
      </div>
    </div>
  );
}

export function PricingBandChart({ result, loading }: PricingBandChartProps) {
  const { t } = useTranslation();
  const chartData = useMemo(() => {
    if (!result) return [];
    return result.items
      .filter(i => i.listed_price > 0)
      .sort((a, b) => a.listed_price - b.listed_price)
      .map(item => ({
        name: item.item_name,
        price: item.listed_price,
        units: item.units_sold,
        revenue: item.item_revenue,
        band: item.band,
        isPromo: item.is_promotion_candidate,
      }));
  }, [result]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Price Distribution</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!result || chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Price Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Select a category to view the distribution
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Price Distribution by Band</CardTitle>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_COLORS.lower }} />
              <span>Lower (€{result.lower_band_min.toFixed(0)}–{result.lower_band_max.toFixed(0)})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_COLORS.middle }} />
              <span>Middle (€{result.middle_band_min.toFixed(0)}–{result.middle_band_max.toFixed(0)})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_COLORS.upper }} />
              <span>Upper (€{result.upper_band_min.toFixed(0)}–{result.upper_band_max.toFixed(0)})</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 50, left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickFormatter={(v) => `€${v}`}
                label={{
                  value: 'Price (€)',
                  angle: -90,
                  position: 'left',
                  offset: 15,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
                }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Band boundary reference lines */}
              <ReferenceLine
                y={result.lower_band_max}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeOpacity={0.4}
                label={{ value: `€${result.lower_band_max.toFixed(0)}`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
              />
              <ReferenceLine
                y={result.middle_band_max}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeOpacity={0.4}
                label={{ value: `€${result.middle_band_max.toFixed(0)}`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
              />

              <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAND_COLORS[entry.band as keyof typeof BAND_COLORS]}
                    stroke={entry.isPromo ? 'hsl(var(--foreground))' : 'none'}
                    strokeWidth={entry.isPromo ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
