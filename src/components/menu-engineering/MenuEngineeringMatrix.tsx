import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';
import { useTranslation } from 'react-i18next';

interface MenuEngineeringMatrixProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  star: 'hsl(142, 71%, 45%)',
  plow_horse: 'hsl(199, 89%, 48%)',
  puzzle: 'hsl(45, 93%, 47%)',
  dog: 'hsl(0, 84%, 60%)',
};

function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MenuEngineeringItem & { x: number; y: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold mb-1">{item.name}</p>
      <p className="text-xs text-muted-foreground mb-2 italic">{item.classification_reason}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <span>Price (ex VAT):</span>
        <span className="text-foreground font-medium">{formatCurrency(item.selling_price_ex_vat)}</span>
        <span>Food cost:</span>
        <span className="text-foreground">{formatCurrency(item.unit_food_cost)}</span>
        <span>Unit GP:</span>
        <span className="text-foreground font-medium">{formatCurrency(item.unit_gross_profit)}</span>
        <span>Units sold:</span>
        <span className="text-foreground">{item.units_sold.toLocaleString()}</span>
        <span>Popularity:</span>
        <span className="text-foreground">{item.popularity_pct.toFixed(1)}%</span>
        <span>Cost source:</span>
        <span className="text-foreground">{item.cost_source === 'recipe_actual' ? '✓ Recipe' : item.cost_source === 'fallback_average' ? '~ Cat. avg' : '? No data'}</span>
      </div>
    </div>
  );
}

export function MenuEngineeringMatrix({
  const { t } = useTranslation();
  items,
  stats,
  loading,
}: MenuEngineeringMatrixProps) {
  // Y-axis = unit_gross_profit (€), X-axis = popularity_pct (%)
  const scatterData = useMemo(() => {
    return items.map((item) => ({
      ...item,
      x: item.popularity_pct,
      y: item.unit_gross_profit,
    }));
  }, [items]);

  // Calculate axis domains
  const { xMax, yMax } = useMemo(() => {
    if (items.length === 0) return { xMax: 30, yMax: 20 };

    const xValues = items.map((i) => i.popularity_pct);
    const yValues = items.map((i) => i.unit_gross_profit);

    return {
      xMax: Math.ceil(Math.max(...xValues) * 1.2),
      yMax: Math.ceil(Math.max(...yValues) * 1.2),
    };
  }, [items]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Popularity vs Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Popularity vs Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Popularity vs Profitability</CardTitle>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.star }}
                />
                <span>Stars</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.plow_horse }}
                />
                <span>Plow Horses</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.puzzle }}
                />
                <span>Puzzles</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.dog }}
                />
                <span>Dogs</span>
              </div>
            </div>
          </div>
        </div>
        {/* Threshold info bar */}
        {stats && (
          <p className="text-xs text-muted-foreground mt-1">
            Popularity threshold: {stats.popThreshold.toFixed(1)}% · Profitability threshold: {formatCurrency(stats.marginThreshold)}
            {!stats.isCanonical && ' · ⚠ Overview (select a category for canonical analysis)'}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="x"
                name="Popularity"
                domain={[0, xMax]}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                label={{
                  value: 'Popularity (% units)',
                  position: 'bottom',
                  offset: 20,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Unit GP"
                domain={[0, yMax]}
                tickFormatter={(v) => `€${v}`}
                label={{
                  value: 'Unit GP (€)',
                  angle: -90,
                  position: 'left',
                  offset: 15,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
                }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Reference lines for canonical thresholds */}
              {stats && (
                <>
                  <ReferenceLine
                    x={stats.popThreshold}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    label={{ value: `${stats.popThreshold.toFixed(0)}%`, position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={stats.marginThreshold}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    label={{ value: `€${stats.marginThreshold.toFixed(2)}`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                </>
              )}

              <Scatter data={scatterData} fill="hsl(var(--primary))">
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CLASSIFICATION_COLORS[entry.classification]}
                    r={5}
                    cursor="pointer"
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
