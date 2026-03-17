import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useCategorySales } from '@/hooks/useCategorySales';
import { useTranslation } from 'react-i18next';

const CATEGORY_COLORS: Record<string, string> = {
  'Bebidas': 'hsl(var(--chart-4))',
  'Entrantes': 'hsl(var(--chart-2))',
  'Principales': 'hsl(var(--chart-1))',
  'Postres': 'hsl(var(--chart-3))'
};

const FALLBACK_COLOR = 'hsl(var(--muted-foreground))';

interface CategoryBreakdownChartProps {
  className?: string;
}

export function CategoryBreakdownChart({ className }: CategoryBreakdownChartProps) {
  const { t } = useTranslation();
  const { categories, loading, totalSales } = useCategorySales();

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = categories.map(c => ({
    ...c,
    fill: CATEGORY_COLORS[c.category] || FALLBACK_COLOR
  }));

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{data.category}</p>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.CategoryBreakdownChart.ventas')} <span className="font-semibold text-foreground">{formatCurrency(data.sales)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.CategoryBreakdownChart.unidades')} <span className="font-semibold text-foreground">{data.units.toLocaleString('es-ES')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.CategoryBreakdownChart.porcentaje')} <span className="font-semibold text-foreground">{data.percentage.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {chartData.map((entry) => (
        <div key={entry.category} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-sm text-muted-foreground">
            {entry.category} ({entry.percentage.toFixed(0)}%)
          </span>
        </div>
      ))}
    </div>
  {t('dashboard.CategoryBreakdownChart.return')}
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('dashboard.ventasPorCategoria')}</CardTitle>
          <span className="text-sm text-muted-foreground">
            Total: {formatCurrency(totalSales)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            {t('dashboard.CategoryBreakdownChart.noHayDatosDeVentas')}
          </div>
        ) : (
          <>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="sales"
                    nameKey="category"
                    strokeWidth={0}
                  >
                    {chartData.map((entry) => (
                      <Cell 
                        key={entry.category} 
                        fill={entry.fill}
                        className="drop-shadow-sm"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {renderCustomLegend()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
