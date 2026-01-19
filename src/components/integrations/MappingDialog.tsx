import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle } from 'lucide-react';

interface MappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  connectionId: string;
}

interface FieldMapping {
  internalField: string;
  table: string;
  providerField: string;
  status: 'ok' | 'missing' | 'partial';
}

const PROVIDER_MAPPINGS: Record<string, FieldMapping[]> = {
  revo: [
    { internalField: 'external_id', table: 'tickets', providerField: 'ticket_uid', status: 'ok' },
    { internalField: 'opened_at', table: 'tickets', providerField: 'opened_date', status: 'ok' },
    { internalField: 'closed_at', table: 'tickets', providerField: 'closed_date', status: 'ok' },
    { internalField: 'table_name', table: 'tickets', providerField: 'table.name', status: 'ok' },
    { internalField: 'covers', table: 'tickets', providerField: 'pax', status: 'ok' },
    { internalField: 'channel', table: 'tickets', providerField: 'order_type', status: 'ok' },
    { internalField: 'gross_total', table: 'tickets', providerField: 'total_bruto', status: 'ok' },
    { internalField: 'discount_total', table: 'tickets', providerField: 'total_descuento', status: 'ok' },
    { internalField: 'tax_total', table: 'tickets', providerField: 'total_impuestos', status: 'ok' },
    { internalField: 'item_name', table: 'ticket_lines', providerField: 'producto.nombre', status: 'ok' },
    { internalField: 'quantity', table: 'ticket_lines', providerField: 'cantidad', status: 'ok' },
    { internalField: 'unit_price', table: 'ticket_lines', providerField: 'precio_unitario', status: 'ok' },
    { internalField: 'category_name', table: 'ticket_lines', providerField: 'categoria.nombre', status: 'ok' },
    { internalField: 'voided', table: 'ticket_lines', providerField: 'anulado', status: 'ok' },
    { internalField: 'comped', table: 'ticket_lines', providerField: 'invitacion', status: 'ok' },
    { internalField: 'method', table: 'payments', providerField: 'forma_pago.tipo', status: 'ok' },
    { internalField: 'amount', table: 'payments', providerField: 'importe', status: 'ok' },
  ],
  glop: [
    { internalField: 'external_id', table: 'tickets', providerField: 'IdVenta', status: 'ok' },
    { internalField: 'opened_at', table: 'tickets', providerField: 'FechaHora', status: 'ok' },
    { internalField: 'closed_at', table: 'tickets', providerField: 'FechaCierre', status: 'ok' },
    { internalField: 'table_name', table: 'tickets', providerField: 'Mesa', status: 'ok' },
    { internalField: 'covers', table: 'tickets', providerField: 'NumComensales', status: 'partial' },
    { internalField: 'channel', table: 'tickets', providerField: 'TipoVenta', status: 'ok' },
    { internalField: 'gross_total', table: 'tickets', providerField: 'TotalBruto', status: 'ok' },
    { internalField: 'discount_total', table: 'tickets', providerField: 'Descuento', status: 'ok' },
    { internalField: 'tax_total', table: 'tickets', providerField: 'IVA', status: 'ok' },
    { internalField: 'item_name', table: 'ticket_lines', providerField: 'Articulo.Nombre', status: 'ok' },
    { internalField: 'quantity', table: 'ticket_lines', providerField: 'Unidades', status: 'ok' },
    { internalField: 'unit_price', table: 'ticket_lines', providerField: 'PVP', status: 'ok' },
    { internalField: 'voided', table: 'ticket_lines', providerField: 'Anulado', status: 'ok' },
    { internalField: 'comped', table: 'ticket_lines', providerField: 'Invitacion', status: 'missing' },
    { internalField: 'method', table: 'payments', providerField: 'FormaPago', status: 'ok' },
    { internalField: 'amount', table: 'payments', providerField: 'Importe', status: 'ok' },
  ],
  square: [
    { internalField: 'external_id', table: 'tickets', providerField: 'order.id', status: 'ok' },
    { internalField: 'opened_at', table: 'tickets', providerField: 'order.created_at', status: 'ok' },
    { internalField: 'closed_at', table: 'tickets', providerField: 'order.closed_at', status: 'ok' },
    { internalField: 'table_name', table: 'tickets', providerField: 'order.metadata.table', status: 'partial' },
    { internalField: 'covers', table: 'tickets', providerField: 'order.metadata.covers', status: 'missing' },
    { internalField: 'channel', table: 'tickets', providerField: 'order.source.name', status: 'ok' },
    { internalField: 'gross_total', table: 'tickets', providerField: 'order.total_money.amount', status: 'ok' },
    { internalField: 'discount_total', table: 'tickets', providerField: 'order.total_discount_money', status: 'ok' },
    { internalField: 'tax_total', table: 'tickets', providerField: 'order.total_tax_money', status: 'ok' },
    { internalField: 'item_name', table: 'ticket_lines', providerField: 'line_items[].name', status: 'ok' },
    { internalField: 'quantity', table: 'ticket_lines', providerField: 'line_items[].quantity', status: 'ok' },
    { internalField: 'unit_price', table: 'ticket_lines', providerField: 'line_items[].base_price_money', status: 'ok' },
    { internalField: 'voided', table: 'ticket_lines', providerField: '—', status: 'missing' },
    { internalField: 'method', table: 'payments', providerField: 'payments[].card_details.card', status: 'ok' },
    { internalField: 'amount', table: 'payments', providerField: 'payments[].amount_money.amount', status: 'ok' },
  ],
  lightspeed: [
    { internalField: 'external_id', table: 'tickets', providerField: 'Sale.saleID', status: 'ok' },
    { internalField: 'opened_at', table: 'tickets', providerField: 'Sale.timeStamp', status: 'ok' },
    { internalField: 'closed_at', table: 'tickets', providerField: 'Sale.completeTime', status: 'ok' },
    { internalField: 'table_name', table: 'tickets', providerField: 'Sale.Register.name', status: 'partial' },
    { internalField: 'covers', table: 'tickets', providerField: '—', status: 'missing' },
    { internalField: 'channel', table: 'tickets', providerField: 'Sale.shopID', status: 'ok' },
    { internalField: 'gross_total', table: 'tickets', providerField: 'Sale.total', status: 'ok' },
    { internalField: 'discount_total', table: 'tickets', providerField: 'Sale.calcDiscount', status: 'ok' },
    { internalField: 'tax_total', table: 'tickets', providerField: 'Sale.calcTax1', status: 'ok' },
    { internalField: 'item_name', table: 'ticket_lines', providerField: 'SaleLines[].Item.description', status: 'ok' },
    { internalField: 'quantity', table: 'ticket_lines', providerField: 'SaleLines[].unitQuantity', status: 'ok' },
    { internalField: 'unit_price', table: 'ticket_lines', providerField: 'SaleLines[].unitPrice', status: 'ok' },
    { internalField: 'voided', table: 'ticket_lines', providerField: '—', status: 'missing' },
    { internalField: 'method', table: 'payments', providerField: 'SalePayments[].PaymentType.name', status: 'ok' },
    { internalField: 'amount', table: 'payments', providerField: 'SalePayments[].amount', status: 'ok' },
  ],
  csv: [
    { internalField: 'external_id', table: 'tickets', providerField: 'ticket_id (mapped)', status: 'ok' },
    { internalField: 'closed_at', table: 'tickets', providerField: 'closed_at (mapped)', status: 'ok' },
    { internalField: 'gross_total', table: 'tickets', providerField: 'gross_total (mapped)', status: 'ok' },
    { internalField: 'item_name', table: 'ticket_lines', providerField: 'item_name (mapped)', status: 'ok' },
    { internalField: 'quantity', table: 'ticket_lines', providerField: 'quantity (mapped)', status: 'ok' },
    { internalField: 'unit_price', table: 'ticket_lines', providerField: 'unit_price (mapped)', status: 'ok' },
    { internalField: 'method', table: 'payments', providerField: 'payment_method (mapped)', status: 'ok' },
    { internalField: 'amount', table: 'payments', providerField: 'payment_amount (mapped)', status: 'ok' },
  ],
};

export function MappingDialog({ open, onOpenChange, provider }: MappingDialogProps) {
  const mappings = PROVIDER_MAPPINGS[provider] || [];
  
  const groupedMappings = {
    tickets: mappings.filter(m => m.table === 'tickets'),
    ticket_lines: mappings.filter(m => m.table === 'ticket_lines'),
    payments: mappings.filter(m => m.table === 'payments'),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>;
      case 'partial':
        return <Badge className="bg-warning/10 text-warning">Partial</Badge>;
      case 'missing':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Missing</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Field Mapping: {provider.toUpperCase()}</DialogTitle>
          <DialogDescription>
            Mapeo de campos entre {provider} y el modelo de datos interno.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {Object.entries(groupedMappings).map(([table, fields]) => (
            <div key={table}>
              <h4 className="font-semibold mb-2 capitalize">{table.replace('_', ' ')}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal Field</TableHead>
                    <TableHead>Provider Field</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{field.internalField}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {field.providerField}
                      </TableCell>
                      <TableCell>{getStatusBadge(field.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
