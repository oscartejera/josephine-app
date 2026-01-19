import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { cn } from '@/lib/utils';

interface HourlySalesChartProps {
  data: Array<{
    hour: string;
    real: number;
    forecast: number;
  }>;
  title?: string;
  className?: string;
}

export function HourlySalesChart({ data, title = "Ventas por Hora", className }: HourlySalesChartProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="forecast" 
                stroke="hsl(var(--muted-foreground))" 
                fillOpacity={1} 
                fill="url(#colorForecast)"
                name="Forecast"
                strokeDasharray="5 5"
              />
              <Area 
                type="monotone" 
                dataKey="real" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorReal)"
                name="Real"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface HourlyLaborChartProps {
  data: Array<{
    hour: string;
    real: number;
    recommended: number;
  }>;
  title?: string;
  className?: string;
}

export function HourlyLaborChart({ data, title = "Labor por Hora", className }: HourlyLaborChartProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
              />
              <Legend />
              <Bar 
                dataKey="recommended" 
                fill="hsl(var(--muted-foreground))" 
                name="Recomendado"
                opacity={0.5}
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="real" 
                fill="hsl(var(--primary))" 
                name="Real"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
