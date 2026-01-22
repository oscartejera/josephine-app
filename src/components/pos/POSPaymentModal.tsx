import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Banknote, Smartphone, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSPaymentModalProps {
  total: number;
  onClose: () => void;
  onPayment: (method: string, amount: number) => void;
}

const paymentMethods = [
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'bizum', label: 'Bizum', icon: Smartphone },
];

const quickAmounts = [5, 10, 20, 50, 100];

export function POSPaymentModal({ total, onClose, onPayment }: POSPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('card');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = selectedMethod === 'cash' ? Math.max(0, cashAmount - total) : 0;
  const canPay = selectedMethod !== 'cash' || cashAmount >= total;

  const handlePay = async () => {
    setLoading(true);
    await onPayment(selectedMethod, total);
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="text-3xl font-bold">€{total.toFixed(2)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Payment Method Selection */}
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((method) => (
              <Button
                key={method.id}
                variant={selectedMethod === method.id ? "default" : "outline"}
                className={cn(
                  "h-20 flex-col gap-2",
                  selectedMethod === method.id && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedMethod(method.id)}
              >
                <method.icon className="h-6 w-6" />
                <span>{method.label}</span>
              </Button>
            ))}
          </div>

          {/* Cash Calculator */}
          {selectedMethod === 'cash' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Recibido</label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-2xl h-14 text-center font-bold"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setCashReceived(amount.toString())}
                  >
                    €{amount}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCashReceived(total.toFixed(2))}
                >
                  Exacto
                </Button>
              </div>

              {/* Change Display */}
              {cashAmount >= total && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">Cambio</p>
                  <p className="text-2xl font-bold text-green-600">
                    €{change.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pay Button */}
          <Button
            className="w-full h-14 text-lg"
            disabled={!canPay || loading}
            onClick={handlePay}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Confirmar pago
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
