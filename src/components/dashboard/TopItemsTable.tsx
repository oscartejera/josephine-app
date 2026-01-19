import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface TopItem {
  rank: number;
  name: string;
  category: string;
  sales: number;
  quantity: number;
  margin?: number;
}

interface TopItemsTableProps {
  items: TopItem[];
  title?: string;
  className?: string;
}

export function TopItemsTable({ items, title = "Top Items", className }: TopItemsTableProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Uds</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.rank}>
                <TableCell className="font-medium">{item.rank}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right font-medium">
                  €{item.sales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right">
                  {item.margin !== undefined ? (
                    <Badge variant={item.margin >= 65 ? "default" : item.margin >= 50 ? "secondary" : "destructive"}>
                      {item.margin}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
