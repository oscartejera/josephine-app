import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface InventorySalesCardProps {
  totalSales: number;
  assignedSales: number;
  unassignedSales: number;
  isLoading?: boolean;
  currency?: string;
}

export function InventorySalesCard({
  totalSales,
  assignedSales,
  unassignedSales,
  isLoading = false,
  currency = '€'
}: InventorySalesCardProps) {
  const assignedPercent = totalSales > 0 ? (assignedSales / totalSales) * 100 : 0;
  const unassignedPercent = totalSales > 0 ? (unassignedSales / totalSales) * 100 : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-32 mb-4" />
          <Skeleton className="h-3 w-full mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-4">
          {currency}{totalSales.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        
        {/* Stacked progress bar */}
        <div className="h-2.5 rounded-full overflow-hidden bg-muted mb-4">
          <div className="h-full flex">
            <div 
              className="bg-primary h-full transition-all"
              style={{ width: `${assignedPercent}%` }}
            />
            <div 
              className="bg-muted-foreground/30 h-full transition-all"
              style={{ width: `${unassignedPercent}%` }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Assigned</span>
            </div>
            <span className="font-medium">{currency}{assignedSales.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
              <span className="text-muted-foreground">Unassigned</span>
            </div>
            <span className="font-medium">{currency}{unassignedSales.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
