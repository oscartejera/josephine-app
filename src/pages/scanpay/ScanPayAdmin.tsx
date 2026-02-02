/**
 * Scan&Pay Admin Page
 * Gestión interna de cuentas y generación de QR
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QrCode, Receipt, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Mock bills
const mockBills = [
  {
    id: 'bill-demo-1',
    operation_number: 'OP-00001234',
    table_name: 'Mesa 5',
    waiter_name: 'María García',
    total: 58.30,
    amount_due: 58.30,
    status: 'open' as const,
    created_at: new Date().toISOString(),
  },
  {
    id: 'bill-demo-2',
    operation_number: 'OP-00001235',
    table_name: 'Mesa 12',
    waiter_name: 'Carlos López',
    total: 116.05,
    amount_due: 56.05,
    status: 'partially_paid' as const,
    created_at: new Date().toISOString(),
  },
  {
    id: 'bill-demo-3',
    operation_number: 'OP-00001236',
    table_name: 'Terraza 3',
    waiter_name: 'Ana Rodríguez',
    total: 80.30,
    amount_due: 0,
    status: 'paid' as const,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export default function ScanPayAdmin() {
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  const handleGenerateQR = (bill: any) => {
    const token = 'sp_demo_token_1';
    const url = `${window.location.origin}/scan-pay/${token}`;
    setQrUrl(url);
    setSelectedBill(bill);
    setQrDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Pagada</Badge>;
      case 'partially_paid':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Parcial</Badge>;
      case 'open':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Anulada</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <QrCode className="h-6 w-6" />
          Scan & Pay
        </h1>
        <p className="text-muted-foreground">
          Gestión de cuentas y códigos QR para pago
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operación</TableHead>
                <TableHead>Mesa</TableHead>
                <TableHead>Camarero</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono">{bill.operation_number}</TableCell>
                  <TableCell>{bill.table_name}</TableCell>
                  <TableCell>{bill.waiter_name}</TableCell>
                  <TableCell className="text-right">€{bill.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold">
                    €{bill.amount_due.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(bill.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateQR(bill)}
                      disabled={bill.status === 'paid'}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código QR - {selectedBill?.operation_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-6">
            {/* QR Code (en producción usaría librería de QR) */}
            <div className="bg-white p-8 rounded-lg border-4 border-primary flex items-center justify-center">
              <div className="text-center">
                <QrCode className="h-48 w-48 mx-auto text-primary" />
                <p className="text-xs text-muted-foreground mt-4">
                  Escanea para pagar
                </p>
              </div>
            </div>

            {/* URL for testing */}
            <div className="p-3 bg-muted rounded text-xs font-mono break-all">
              {qrUrl}
            </div>

            <Button
              onClick={() => window.open(qrUrl, '_blank')}
              className="w-full"
            >
              Abrir en Nueva Pestaña (Testing)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
