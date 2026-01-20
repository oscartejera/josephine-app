/**
 * Department Distribution - Nory-style chart and table for BOH/FOH/Management breakdown
 * Shows actual vs planned by department with contribution percentages
 */

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { DepartmentData } from '@/hooks/useLabourData';

interface DepartmentDistributionProps {
  data: DepartmentData[] | undefined;
  isLoading: boolean;
}

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
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-[200px] w-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-28" />
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
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-4 min-w-[180px]">
      <p className="text-sm font-semibold mb-3">{label}</p>
      <div className="space-y-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-xs font-medium">{entry.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DepartmentDistribution({ data, isLoading }: DepartmentDistributionProps) {
  if (isLoading || !data) {
    return <ChartSkeleton />;
  }

  const chartData = data.map(d => ({
    name: d.department,
    'Actual': d.contributionActual,
    'Planned': d.contributionPlanned
  }));

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Department distribution</h3>
        
        {/* Chart */}
        <div className="h-[200px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top"
                align="right"
                iconType="rect"
                iconSize={12}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar 
                dataKey="Actual" 
                fill="hsl(var(--bi-actual))" 
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
              <Bar 
                dataKey="Planned" 
                fill="hsl(var(--bi-forecast))" 
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-medium text-muted-foreground">Contribution</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground">Actual</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground">Projected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((dept) => (
                <TableRow key={dept.department}>
                  <TableCell className="font-medium">{dept.department}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold">{dept.contributionActual.toFixed(1)}%</span>
                      <DeltaBadge value={dept.delta} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {dept.contributionPlanned.toFixed(1)}%
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
