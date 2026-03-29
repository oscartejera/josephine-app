import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Truck, AlertTriangle } from 'lucide-react';
import type { SupplierScore, SupplierScoreResult } from '@/hooks/useWasteSupplierScore';

interface WasteSupplierScoreProps {
  result: SupplierScoreResult;
  isLoading?: boolean;
}

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-500/15', text: 'text-emerald-700' },
  B: { bg: 'bg-blue-500/15', text: 'text-blue-700' },
  C: { bg: 'bg-amber-500/15', text: 'text-amber-700' },
  D: { bg: 'bg-red-500/15', text: 'text-red-700' },
};

export function WasteSupplierScore({ result, isLoading = false }: WasteSupplierScoreProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[240px] w-full" /></CardContent>
      </Card>
    );
  }

  const { suppliers, avgScore, worstSupplier, isReliable } = result;

  if (suppliers.length === 0) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin datos de proveedor</p>
              <p className="text-xs text-muted-foreground">
                Asigna proveedores a tus productos de inventario para ver este análisis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Calidad por Proveedor
            </CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              IA
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Score medio: <span className="font-medium text-foreground">{avgScore}/100</span>
          </div>
        </div>
        {worstSupplier && !isReliable && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Datos limitados — el score mejorará con más registros
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Proveedor</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Score</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Merma total</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">% Caducidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">% Rotura</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Producto top</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <SupplierRow key={supplier.supplierName} supplier={supplier} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SupplierRow({ supplier }: { supplier: SupplierScore }) {
  const grade = GRADE_STYLES[supplier.grade] || GRADE_STYLES.C;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          {supplier.grade === 'D' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
          <span className="text-sm font-medium">{supplier.supplierName}</span>
          <span className="text-xs text-muted-foreground">({supplier.itemCount} items)</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs font-bold px-2 py-0 ${grade.bg} ${grade.text} border-0`}>
            {supplier.grade}
          </Badge>
          <div className="flex-1 min-w-[60px]">
            <Progress
              value={supplier.score}
              className="h-1.5"
            />
          </div>
          <span className="text-xs text-muted-foreground w-6 text-right">{supplier.score}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        €{supplier.totalWaste.toFixed(0)}
        <span className="text-xs text-muted-foreground ml-1">({supplier.totalCount}×)</span>
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        {supplier.expiryPct > 0 ? (
          <span className={supplier.expiryPct > 30 ? 'text-red-600 font-medium' : ''}>
            {supplier.expiryPct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        {supplier.brokenPct > 0 ? (
          <span className={supplier.brokenPct > 20 ? 'text-amber-600 font-medium' : ''}>
            {supplier.brokenPct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-2.5 text-sm text-muted-foreground truncate max-w-[150px]">
        {supplier.topItem}
      </TableCell>
    </TableRow>
  );
}
