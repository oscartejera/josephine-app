import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { IVABreakdown } from '@/hooks/useFiscalData';

interface IVABreakdownChartProps {
  ventasByRate: IVABreakdown[];
  comprasByRate: IVABreakdown[];
  isLoading?: boolean;
}

const COLORS = {
  21: '#ef4444', // red-500
  10: '#f59e0b', // amber-500
  4: '#22c55e',  // green-500
  0: '#6b7280',  // gray-500
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value);
};

export function IVABreakdownChart({ 
  ventasByRate, 
  comprasByRate,
  isLoading 
}: IVABreakdownChartProps) {
  const ventasData = ventasByRate.map(item => ({
    name: `${item.rate}%`,
    value: item.iva,
    base: item.base,
    rate: item.rate,
  }));

  const comprasData = comprasByRate.map(item => ({
    name: `${item.rate}%`,
    value: item.iva,
    base: item.base,
    rate: item.rate,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold">IVA {data.name}</p>
          <p className="text-sm text-muted-foreground">
            Base: {formatCurrency(data.base)}
          </p>
          <p className="text-sm font-medium">
            IVA: {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Desglose por Tipo de IVA</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] animate-pulse">
          <div className="flex h-full items-center justify-center">
            <div className="h-48 w-48 rounded-full bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasVentas = ventasData.length > 0 && ventasData.some(d => d.value > 0);
  const hasCompras = comprasData.length > 0 && comprasData.some(d => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desglose por Tipo de IVA</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Ventas (IVA Repercutido) */}
          <div>
            <h4 className="mb-4 text-center text-sm font-medium text-muted-foreground">
              IVA Repercutido (Ventas)
            </h4>
            {hasVentas ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={ventasData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {ventasData.map((entry) => (
                      <Cell 
                        key={`ventas-${entry.rate}`} 
                        fill={COLORS[entry.rate as keyof typeof COLORS] || COLORS[0]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                Sin datos de ventas
              </div>
            )}
          </div>

          {/* Compras (IVA Soportado) */}
          <div>
            <h4 className="mb-4 text-center text-sm font-medium text-muted-foreground">
              IVA Soportado (Compras)
            </h4>
            {hasCompras ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={comprasData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {comprasData.map((entry) => (
                      <Cell 
                        key={`compras-${entry.rate}`} 
                        fill={COLORS[entry.rate as keyof typeof COLORS] || COLORS[0]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                Sin datos de compras
              </div>
            )}
          </div>
        </div>

        {/* Rate breakdown table */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {ventasByRate.map(item => (
              <div key={`ventas-row-${item.rate}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">IVA {item.rate}%</span>
                <span>{formatCurrency(item.iva)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {comprasByRate.map(item => (
              <div key={`compras-row-${item.rate}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">IVA {item.rate}%</span>
                <span>{formatCurrency(item.iva)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
