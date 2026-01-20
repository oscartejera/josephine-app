/**
 * Shift Types - Nory-style donut chart and table for shift type breakdown
 * Shows Regular, Overtime, Training, Other distribution
 */

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import type { ShiftTypeData } from '@/hooks/useLabourData';

interface ShiftTypesProps {
  data: ShiftTypeData[] | undefined;
  isLoading: boolean;
}

const COLORS = [
  'hsl(var(--bi-actual))',      // Purple for Regular
  'hsl(var(--bi-acs))',          // Orange for Overtime
  'hsl(var(--chart-2))',         // Green for Training
  'hsl(var(--muted-foreground))' // Gray for Other
];

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  const arrow = value >= 0 ? '▲' : '▼';
  
  if (Math.abs(value) < 0.01) {
    return <span className="text-[10px] text-muted-foreground">-</span>;
  }
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      <span>{arrow}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function ChartSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="flex justify-center mb-6">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-sm" 
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="text-sm font-medium">{item.name}</span>
      </div>
      <p className="text-lg font-bold mt-1">{item.value.toFixed(1)}%</p>
    </div>
  );
}

export function ShiftTypes({ data, isLoading }: ShiftTypesProps) {
  if (isLoading || !data) {
    return <ChartSkeleton />;
  }

  const chartData = data.map((d, idx) => ({
    name: d.type,
    value: d.percentActual,
    fill: COLORS[idx % COLORS.length]
  }));

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Shift types</h3>
        
        {/* Donut Chart */}
        <div className="h-[200px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom"
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-medium text-muted-foreground">Type</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground">Actual</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground">Projected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((shift, idx) => (
                <TableRow key={shift.type}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-medium">{shift.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold">{shift.hoursActual}h</span>
                      <DeltaBadge value={shift.delta} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {shift.hoursPlanned}h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
