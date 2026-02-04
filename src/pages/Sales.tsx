/**
 * Sales Module - Josephine AI Ops
 * Version: 2.0 - Nory-style with Josephine colors
 */

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Users, Clock, DollarSign, Calendar } from 'lucide-react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = {
  actual: '#6366f1',
  forecast: '#0ea5e9',
  avgCheck: '#f59e0b',
  success: '#10b981',
  danger: '#f43f5e',
};

const VarianceIndicator = ({ value }: { value: number }) => {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <div className={cn('inline-flex items-center gap-1 text-sm font-medium', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </div>
  );
};

export default function Sales() {
  const [dateRange, setDateRange] = useState('week');

  const weeklyData = [
    { day: 'Mon', actual: 12500, forecast: 12200, avgCheck: 24.20 },
    { day: 'Tue', actual: 13800, forecast: 13200, avgCheck: 24.50 },
    { day: 'Wed', actual: 10421, forecast: 10194, avgCheck: 24.41 },
    { day: 'Thu', actual: 15100, forecast: 15200, avgCheck: 24.80 },
    { day: 'Fri', actual: 18200, forecast: 18500, avgCheck: 25.20 },
    { day: 'Sat', actual: 22100, forecast: 22300, avgCheck: 26.50 },
    { day: 'Sun', actual: 16500, forecast: 16800, avgCheck: 25.00 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales</h1>
        <Button variant="outline">✨ Ask Josephine</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <h3 className="text-sm text-muted-foreground mb-2">Sales to Date</h3>
          <div className="text-3xl font-bold">€36,066</div>
          <VarianceIndicator value={0.94} />
        </Card>

        <Card className="p-6">
          <h3 className="text-sm text-muted-foreground mb-2">Avg Check</h3>
          <div className="text-3xl font-bold">€23.70</div>
          <VarianceIndicator value={1.26} />
        </Card>

        <Card className="p-6">
          <h3 className="text-sm text-muted-foreground mb-2">Dwell Time</h3>
          <div className="text-3xl font-bold">42mins</div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sales vs Forecast</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(value) => `€${(value/1000).toFixed(0)}K`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(value) => `€${value}`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="actual" fill={COLORS.actual} name="Actual" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="left" dataKey="forecast" fill={COLORS.forecast} name="Forecast" radius={[8, 8, 0, 0]} opacity={0.6} />
              <Line yAxisId="right" type="monotone" dataKey="avgCheck" stroke={COLORS.avgCheck} strokeWidth={2} name="Avg Check" dot={{ fill: COLORS.avgCheck, r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
