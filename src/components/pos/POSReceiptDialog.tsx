import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Download, X, Check } from 'lucide-react';
import { ReceiptData } from './POSSplitPaymentModal';
import { downloadReceiptPDF, printReceiptPDF } from './POSReceiptPDF';

interface POSReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
}

export function POSReceiptDialog({ open, onClose, data }: POSReceiptDialogProps) {
  const handlePrint = () => {
    printReceiptPDF(data);
  };

  const handleDownload = () => {
    downloadReceiptPDF(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Pago Completado
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-white text-black rounded-lg p-4 shadow-inner border max-w-[280px] mx-auto">
          <ScrollArea className="h-[400px]">
            {/* Header */}
            <div className="text-center mb-4">
              <h3 className="font-bold text-lg">Josephine Restaurant</h3>
              <p className="text-xs text-gray-500">Calle Gran Vía, 123, Madrid</p>
              <p className="text-xs text-gray-500">NIF: B12345678</p>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Ticket Info */}
            <div className="flex justify-between text-xs mb-2">
              <span>Ticket: {data.ticketNumber}</span>
              <span>{data.date}</span>
            </div>
            <div className="text-xs mb-2">Mesa: {data.tableName}</div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Items */}
            <div className="space-y-1">
              <div className="flex text-xs font-bold">
                <span className="flex-1">Descripción</span>
                <span className="w-8 text-center">Cant</span>
                <span className="w-14 text-right">Total</span>
              </div>
              {data.items.map((item, idx) => (
                <div key={idx} className="flex text-xs">
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="w-8 text-center">{item.qty}</span>
                  <span className="w-14 text-right">€{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>€{data.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (10%)</span>
                <span>€{data.tax.toFixed(2)}</span>
              </div>
              {data.tip > 0 && (
                <div className="flex justify-between">
                  <span>Propina</span>
                  <span>€{data.tip.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-400 my-3" />

            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>€{data.total.toFixed(2)}</span>
            </div>

            {/* Payment */}
            <div className="bg-gray-100 rounded p-2 mt-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Método:</span>
                <span className="capitalize">{data.paymentMethod}</span>
              </div>
              {data.cashReceived && (
                <>
                  <div className="flex justify-between">
                    <span>Recibido:</span>
                    <span>€{data.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Cambio:</span>
                    <span>€{(data.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-4">
              <p>¡Gracias por su visita!</p>
              <p>Vuelva pronto</p>
              <p className="mt-2">IVA incluido - Conserve su ticket</p>
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
        
        <Button onClick={onClose} className="w-full">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
