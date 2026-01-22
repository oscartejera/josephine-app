import { POSTicket, POSTable } from '@/hooks/usePOSData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Users, Euro, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface POSOpenTablesProps {
  tickets: POSTicket[];
  tables: POSTable[];
  onRefresh: () => void;
}

export function POSOpenTables({ tickets, tables, onRefresh }: POSOpenTablesProps) {
  const getTableForTicket = (ticket: POSTicket) => {
    return tables.find(t => t.id === ticket.pos_table_id);
  };

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No hay mesas abiertas</p>
          <p className="text-sm">Las comandas activas aparecerán aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tickets.map((ticket) => {
        const table = getTableForTicket(ticket);
        const openedAt = new Date(ticket.opened_at);
        const timeOpen = formatDistanceToNow(openedAt, { locale: es, addSuffix: false });

        return (
          <Card key={ticket.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">
                    {table?.table_number || ticket.table_name || 'Sin mesa'}
                  </h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {ticket.service_type === 'dine_in' ? 'Mesa' : 
                     ticket.service_type === 'takeaway' ? 'Para llevar' :
                     ticket.service_type === 'bar' ? 'Barra' : 'Delivery'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{timeOpen}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{ticket.covers || table?.seats || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Euro className="h-4 w-4" />
                  <span>{ticket.gross_total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>

              {ticket.notes && (
                <p className="mt-3 text-sm text-muted-foreground bg-muted/50 rounded p-2">
                  {ticket.notes}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
