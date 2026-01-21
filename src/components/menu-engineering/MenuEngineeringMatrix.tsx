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

interface MenuEngineeringMatrixProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  star: 'hsl(142, 71%, 45%)',      // Success green
  plow_horse: 'hsl(199, 89%, 48%)', // Info blue
  puzzle: 'hsl(45, 93%, 47%)',     // Warning yellow
  dog: 'hsl(0, 84%, 60%)',         // Destructive red
};

const CATEGORY_COLORS: Record<string, string> = {
  'Bebidas': 'hsl(199, 89%, 48%)',
  'Entrantes': 'hsl(45, 93%, 47%)',
  'Principales': 'hsl(142, 71%, 45%)',
  'Postres': 'hsl(280, 65%, 60%)',
  'Other': 'hsl(215, 16%, 47%)',
};

function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MenuEngineeringItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-2">{item.name}</p>
      <div className="space-y-1 text-muted-foreground">
        <p>Categoría: <span className="text-foreground">{item.category}</span></p>
        <p>Unidades: <span className="text-foreground">{item.units.toLocaleString()}</span></p>
        <p>Ventas: <span className="text-foreground">{formatCurrency(item.sales)}</span></p>
        <p>COGS: <span className="text-foreground">{formatCurrency(item.cogs)}</span></p>
        <p>CM €/ud: <span className="text-foreground">{formatCurrency(item.cm)}</span></p>
        <p>GP%: <span className="text-foreground">{formatPercent(item.gpPct)}</span></p>
        <p>Popularidad: <span className="text-foreground">{formatPercent(item.popularity)}</span></p>
      </div>
    </div>
  );
}

export function MenuEngineeringMatrix({ items, stats, loading }: MenuEngineeringMatrixProps) {
  // Prepare scatter data
  const scatterData = useMemo(() => {
    return items.map(item => ({
      ...item,
      x: item.popularity,
      y: item.cm,
    }));
  }, [items]);

  // Calculate axis domains
  const { xMax, yMax } = useMemo(() => {
    if (items.length === 0) return { xMax: 10, yMax: 10 };
    
    const maxPopularity = Math.max(...items.map(i => i.popularity));
    const maxCM = Math.max(...items.map(i => i.cm));
    
    return {
      xMax: Math.ceil(maxPopularity * 1.1),
      yMax: Math.ceil(maxCM * 1.1),
    };
  }, [items]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matriz Popularidad vs Margen</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matriz Popularidad vs Margen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Matriz Popularidad vs Margen</span>
          <div className="flex gap-4 text-xs font-normal">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS.star }} />
              <span>Star</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS.plow_horse }} />
              <span>Plow Horse</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS.puzzle }} />
              <span>Puzzle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS.dog }} />
              <span>Dog</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
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
                  value: 'Popularidad (%)', 
                  position: 'bottom', 
                  offset: 20,
                  style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' }
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="CM"
                domain={[0, yMax]}
                tickFormatter={(v) => `€${v.toFixed(1)}`}
                label={{ 
                  value: 'CM (€/ud)', 
                  angle: -90, 
                  position: 'left', 
                  offset: 10,
                  style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' }
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for thresholds */}
              {stats && (
                <>
                  <ReferenceLine 
                    x={stats.popularityThreshold} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    label={{ 
                      value: 'P*', 
                      position: 'top',
                      style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
                    }}
                  />
                  <ReferenceLine 
                    y={stats.marginThreshold} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    label={{ 
                      value: 'M*', 
                      position: 'right',
                      style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
                    }}
                  />
                </>
              )}

              <Scatter data={scatterData} fill="hsl(var(--primary))">
                {scatterData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CLASSIFICATION_COLORS[entry.classification]}
                    r={6}
                    cursor="pointer"
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        {/* Quadrant labels */}
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-center">
          <div className="p-2 rounded bg-info/10 border border-info/20">
            <span className="font-medium text-info">🐴 Plow Horses</span>
            <p className="text-muted-foreground">Alta pop. / Bajo margen</p>
          </div>
          <div className="p-2 rounded bg-success/10 border border-success/20">
            <span className="font-medium text-success">⭐ Stars</span>
            <p className="text-muted-foreground">Alta pop. / Alto margen</p>
          </div>
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
            <span className="font-medium text-destructive">🐕 Dogs</span>
            <p className="text-muted-foreground">Baja pop. / Bajo margen</p>
          </div>
          <div className="p-2 rounded bg-warning/10 border border-warning/20">
            <span className="font-medium text-warning">🧩 Puzzles</span>
            <p className="text-muted-foreground">Baja pop. / Alto margen</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
