import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, CheckCircle, AlertCircle } from 'lucide-react';
import type { FiscalMetrics } from '@/hooks/useFiscalData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Model303PreviewProps {
  metrics: FiscalMetrics;
  year: number;
  quarter: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

export function Model303Preview({ 
  metrics, 
  year, 
  quarter,
  isLoading 
}: Model303PreviewProps) {
  const { ventasByRate, comprasByRate, ivaRepercutido, ivaSoportado, ivaAPagar } = metrics;

  // Group by standard Spanish IVA rates
  const getByRate = (items: typeof ventasByRate, rate: number) => 
    items.find(i => i.rate === rate) || { base: 0, iva: 0, rate };

  const ventas21 = getByRate(ventasByRate, 21);
  const ventas10 = getByRate(ventasByRate, 10);
  const ventas4 = getByRate(ventasByRate, 4);

  const compras21 = getByRate(comprasByRate, 21);
  const compras10 = getByRate(comprasByRate, 10);
  const compras4 = getByRate(comprasByRate, 4);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modelo 303 - Vista Previa</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] animate-pulse">
          <div className="h-full w-full rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Modelo 303</CardTitle>
              <p className="text-sm text-muted-foreground">
                Autoliquidación T{quarter} {year}
              </p>
            </div>
            <Badge variant={ivaAPagar >= 0 ? 'destructive' : 'default'}>
              {ivaAPagar >= 0 ? 'A ingresar' : 'A compensar'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Total IVA devengado</span>
                <span className="font-medium">{formatCurrency(ivaRepercutido)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Total IVA deducible</span>
                <span className="font-medium">{formatCurrency(ivaSoportado)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold">Resultado</span>
                <span className={`text-xl font-bold ${ivaAPagar >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(Math.abs(ivaAPagar))}
                </span>
              </div>
            </div>
            <Button className="mt-6 w-full" variant="outline">
              Ver detalle completo
            </Button>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modelo 303 - Autoliquidación IVA
            <Badge variant="outline">T{quarter} {year}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* IVA Devengado (Repercutido) */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              IVA Devengado (Ventas)
            </h3>
            <div className="space-y-2 rounded-lg border p-4">
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
                <span>Tipo</span>
                <span className="text-right">Base Imponible</span>
                <span className="text-right">Cuota</span>
              </div>
              {[ventas21, ventas10, ventas4].filter(v => v.base > 0).map(v => (
                <div key={`ventas-${v.rate}`} className="grid grid-cols-3 gap-4">
                  <span>IVA {v.rate}%</span>
                  <span className="text-right">{formatCurrency(v.base)}</span>
                  <span className="text-right font-medium">{formatCurrency(v.iva)}</span>
                </div>
              ))}
              <div className="mt-2 grid grid-cols-3 gap-4 border-t pt-2 font-semibold">
                <span>Total Devengado</span>
                <span></span>
                <span className="text-right">{formatCurrency(ivaRepercutido)}</span>
              </div>
            </div>
          </div>

          {/* IVA Deducible (Soportado) */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              IVA Deducible (Compras)
            </h3>
            <div className="space-y-2 rounded-lg border p-4">
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
                <span>Tipo</span>
                <span className="text-right">Base Imponible</span>
                <span className="text-right">Cuota</span>
              </div>
              {[compras21, compras10, compras4].filter(c => c.base > 0).map(c => (
                <div key={`compras-${c.rate}`} className="grid grid-cols-3 gap-4">
                  <span>IVA {c.rate}%</span>
                  <span className="text-right">{formatCurrency(c.base)}</span>
                  <span className="text-right font-medium">{formatCurrency(c.iva)}</span>
                </div>
              ))}
              <div className="mt-2 grid grid-cols-3 gap-4 border-t pt-2 font-semibold">
                <span>Total Deducible</span>
                <span></span>
                <span className="text-right">{formatCurrency(ivaSoportado)}</span>
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">
                Resultado de la Autoliquidación
              </span>
              <div className="text-right">
                <p className={`text-2xl font-bold ${ivaAPagar >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(Math.abs(ivaAPagar))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ivaAPagar >= 0 ? 'A ingresar en Hacienda' : 'A compensar en próximas declaraciones'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button disabled>
              Presentar en AEAT
              <Badge variant="secondary" className="ml-2">
                Próximamente
              </Badge>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
