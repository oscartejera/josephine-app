/**
 * POSOpenTables Component
 * List of tables with open tickets
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, Receipt } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { POSTicket, POSTable } from '@/hooks/usePOSData';

interface POSOpenTablesProps {
  tickets: POSTicket[];
  tables: POSTable[];
  onRefresh: () => void;
}

export function POSOpenTables({ tickets, tables, onRefresh }: POSOpenTablesProps) {
  const getTableName = (tableId?: string) => {
    if (!tableId) return 'Sin mesa';
    return tables.find(t => t.id === tableId)?.name || 'Mesa';
  };

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No hay mesas abiertas</h3>
        <p className="text-muted-foreground">
          Las mesas con comandas activas aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tickets.map(ticket => (
        <Card key={ticket.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">
              {getTableName(ticket.pos_table_id)}
            </h3>
            <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
              {ticket.status}
            </Badge>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {formatDistanceToNow(new Date(ticket.created_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span>{ticket.lines.length} productos</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">
              €{ticket.total_amount.toFixed(2)}
            </span>
            <Button size="sm">Ver detalle</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
