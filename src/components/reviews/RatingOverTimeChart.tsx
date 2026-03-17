import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RatingOverTimePoint } from '@/hooks/useReviewsData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface RatingOverTimeChartProps {
  data: RatingOverTimePoint[];
  isLoading: boolean;
}

export function RatingOverTimeChart({ data, isLoading }: RatingOverTimeChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    displayDate: format(parseISO(point.date), 'EEE dd'),
  }));

  return (
    <Card className="p-5 bg-card border border-border/60 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Rating over time</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded bg-primary" />
            <span className="text-xs text-muted-foreground">Overall Brand</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value.toFixed(2), 'Rating']}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="rating_avg"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
