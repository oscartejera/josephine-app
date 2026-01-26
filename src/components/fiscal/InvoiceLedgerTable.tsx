import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { FiscalInvoice } from '@/hooks/useFiscalData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceLedgerTableProps {
  invoices: FiscalInvoice[];
  isLoading?: boolean;
  onAddInvoice?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const statusConfig = {
  pending: { label: 'Pendiente', variant: 'outline' as const },
  accounted: { label: 'Contabilizada', variant: 'secondary' as const },
  paid: { label: 'Pagada', variant: 'default' as const },
};

export function InvoiceLedgerTable({ 
  invoices, 
  isLoading,
  onAddInvoice 
}: InvoiceLedgerTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Libro de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Libro de Facturas
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onAddInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Factura
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay facturas registradas</p>
            <p className="text-sm text-muted-foreground/70">
              Las facturas de ventas se generan automáticamente desde el POS
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nº Factura</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor/Cliente</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {invoice.type === 'issued' ? (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                      <span className="text-sm">
                        {invoice.type === 'issued' ? 'Emitida' : 'Recibida'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {invoice.type === 'issued' 
                      ? invoice.customer_name || '—' 
                      : invoice.supplier_name || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.base_amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {invoice.tax_rate}%
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[invoice.status].variant}>
                      {statusConfig[invoice.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
