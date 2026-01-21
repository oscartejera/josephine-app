import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import type { MenuEngineeringItem, MenuEngineeringStats, PopularityMode } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringMatrixProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
  popularityMode: PopularityMode;
  onPopularityModeChange: (mode: PopularityMode) => void;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  star: 'hsl(142, 71%, 45%)',
  plow_horse: 'hsl(199, 89%, 48%)',
  puzzle: 'hsl(45, 93%, 47%)',
  dog: 'hsl(0, 84%, 60%)',
};

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

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
      <p className="font-semibold mb-2">{item.name}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <span>Ventas:</span>
        <span className="text-foreground font-medium">{formatCurrency(item.sales)}</span>
        <span>Unidades:</span>
        <span className="text-foreground">{item.units.toLocaleString()}</span>
        <span>€ que deja:</span>
        <span className="text-foreground font-medium">{formatCurrency(item.profit_eur)}</span>
        <span>% margen:</span>
        <span className="text-foreground">{formatPercent(item.margin_pct)}</span>
        <span>€/venta:</span>
        <span className="text-foreground">{formatCurrency(item.profit_per_sale)}</span>
      </div>
      {item.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.badges.map((badge, i) => (
            <span key={i} className="text-xs bg-warning/20 text-warning-foreground px-2 py-0.5 rounded">
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuEngineeringMatrix({
  items,
  stats,
  loading,
  popularityMode,
  onPopularityModeChange,
}: MenuEngineeringMatrixProps) {
  // Prepare scatter data
  const scatterData = useMemo(() => {
    return items.map((item) => ({
      ...item,
      x: popularityMode === 'units' ? item.popularity_share : item.sales_share,
      y: item.margin_pct,
    }));
  }, [items, popularityMode]);

  // Calculate axis domains
  const { xMax, yMax } = useMemo(() => {
    if (items.length === 0) return { xMax: 10, yMax: 100 };

    const xValues = items.map((i) =>
      popularityMode === 'units' ? i.popularity_share : i.sales_share
    );
    const yValues = items.map((i) => i.margin_pct);

    return {
      xMax: Math.ceil(Math.max(...xValues) * 1.2),
      yMax: Math.min(100, Math.ceil(Math.max(...yValues) * 1.1)),
    };
  }, [items, popularityMode]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Popularidad vs Margen</CardTitle>
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
          <CardTitle>Popularidad vs Margen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Popularidad vs Margen</CardTitle>
          <div className="flex items-center gap-4">
            {/* Toggle for popularity mode */}
            <div className="flex items-center gap-2">
              <Label htmlFor="pop-mode" className="text-xs text-muted-foreground">
                Por unidades
              </Label>
              <Switch
                id="pop-mode"
                checked={popularityMode === 'sales'}
                onCheckedChange={(checked) =>
                  onPopularityModeChange(checked ? 'sales' : 'units')
                }
              />
              <Label htmlFor="pop-mode" className="text-xs text-muted-foreground">
                Por €
              </Label>
            </div>
            {/* Legend */}
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.star }}
                />
                <span>Estrellas</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.plow_horse }}
                />
                <span>Caballos</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.puzzle }}
                />
                <span>Joyas</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CLASSIFICATION_COLORS.dog }}
                />
                <span>Revisar</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="x"
                name="Popularidad"
                domain={[0, xMax]}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                label={{
                  value: popularityMode === 'units' ? 'Popularidad (% uds)' : 'Popularidad (% €)',
                  position: 'bottom',
                  offset: 20,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Margen"
                domain={[0, yMax]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: '% Margen',
                  angle: -90,
                  position: 'left',
                  offset: 10,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
                }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Reference lines for thresholds */}
              {stats && (
                <>
                  <ReferenceLine
                    x={stats.popThreshold}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={stats.marginThreshold}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
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
