/**
 * Scan&Pay Public Page
 * Ruta pública (sin login) para pagar cuentas escaneando QR
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  ChefHat,
  Receipt,
  CreditCard,
  Smartphone,
  Check,
  Download,
  AlertCircle,
  User,
  Calendar,
  DollarSign,
} from 'lucide-react';
import type { Bill, PaymentMethod } from '@/types/scanpay';

// Mock data/services - en producción usaría context
const mockBills: Record<string, Bill> = {
  'sp_demo_token_1': {
    id: 'bill-demo-1',
    operation_number: 'OP-00001234',
    location_id: 'demo-location-1',
    table_name: 'Mesa 5',
    waiter_name: 'María García',
    items: [
      {
        id: '1',
        name: 'Paella Valenciana',
        quantity: 2,
        unit_price: 18.50,
        tax_rate: 10,
        subtotal: 37.00,
        tax_amount: 3.70,
        total: 40.70,
      },
      {
        id: '2',
        name: 'Ensalada Mixta',
        quantity: 1,
        unit_price: 8.90,
        tax_rate: 10,
        subtotal: 8.90,
        tax_amount: 0.89,
        total: 9.79,
      },
      {
        id: '3',
        name: 'Coca Cola',
        quantity: 2,
        unit_price: 2.50,
        tax_rate: 10,
        subtotal: 5.00,
        tax_amount: 0.50,
        total: 5.50,
      },
    ],
    subtotal: 50.90,
    tax_total: 5.09,
    total: 55.99,
    amount_paid: 0,
    amount_due: 55.99,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paid_at: null,
    voided_at: null,
  },
};

type Screen = 'loading' | 'error' | 'review' | 'payment' | 'success';

export default function ScanPayPublic() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [screen, setScreen] = useState<Screen>('loading');
  const [bill, setBill] = useState<Bill | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipPercentage, setTipPercentage] = useState(10);
  const [customTip, setCustomTip] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadBill();
  }, [token]);

  const loadBill = async () => {
    setScreen('loading');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!token || !mockBills[token]) {
      setScreen('error');
      return;
    }

    const billData = mockBills[token];
    setBill(billData);
    setScreen('review');
  };

  const calculateTip = (): number => {
    if (!tipEnabled || !bill) return 0;
    if (customTip) return parseFloat(customTip) || 0;
    return (bill.amount_due * tipPercentage) / 100;
  };

  const calculateTotal = (): number => {
    if (!bill) return 0;
    const baseAmount = partialAmount ? (parseFloat(partialAmount) || bill.amount_due) : bill.amount_due;
    return baseAmount + calculateTip();
  };

  const handlePay = async () => {
    setProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    setProcessing(false);
    setScreen('success');
  };

  const handleDownloadInvoice = () => {
    // En producción generaría PDF real
    alert('Descargando factura... (función en desarrollo)');
  };

  // Loading screen
  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando cuenta...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error screen
  if (screen === 'error' || !bill) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Token Inválido</h2>
            <p className="text-muted-foreground mb-6">
              El código QR ha expirado o no es válido
            </p>
            <Button onClick={() => navigate('/')}>
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success screen
  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-2">¡Pago Completado!</h2>
            <p className="text-muted-foreground mb-2">
              Operación: {bill.operation_number}
            </p>
            <p className="text-2xl font-bold text-green-600 mb-8">
              €{calculateTotal().toFixed(2)}
            </p>
            
            <div className="space-y-3">
              <Button onClick={handleDownloadInvoice} className="w-full" size="lg">
                <Download className="h-5 w-5 mr-2" />
                Descargar Factura
              </Button>
              
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment method selection screen
  if (screen === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <div className="max-w-md mx-auto py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScreen('review')}
            >
              ←
            </Button>
            <div className="flex items-center gap-2">
              <ChefHat className="h-6 w-6" />
              <span className="font-display font-bold text-lg">Josephine</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Método de Pago</CardTitle>
              <CardDescription>Selecciona cómo quieres pagar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Methods */}
              <RadioGroup value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as PaymentMethod)}>
                <div className="space-y-3">
                  <Label
                    htmlFor="apple_pay"
                    className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5" />
                      <span className="font-medium">Apple Pay</span>
                    </div>
                    <RadioGroupItem value="apple_pay" id="apple_pay" />
                  </Label>

                  <Label
                    htmlFor="google_pay"
                    className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5" />
                      <span className="font-medium">Google Pay</span>
                    </div>
                    <RadioGroupItem value="google_pay" id="google_pay" />
                  </Label>

                  <Label
                    htmlFor="card"
                    className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <span className="font-medium">Tarjeta de Crédito</span>
                    </div>
                    <RadioGroupItem value="card" id="card" />
                  </Label>
                </div>
              </RadioGroup>

              <Separator />

              {/* Tip Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Añadir Propina</Label>
                  <Switch checked={tipEnabled} onCheckedChange={setTipEnabled} />
                </div>

                {tipEnabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map((pct) => (
                        <Button
                          key={pct}
                          variant={tipPercentage === pct && !customTip ? 'default' : 'outline'}
                          onClick={() => {
                            setTipPercentage(pct);
                            setCustomTip('');
                          }}
                          size="sm"
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Otra cantidad:</Label>
                      <Input
                        type="number"
                        placeholder="€"
                        value={customTip}
                        onChange={(e) => setCustomTip(e.target.value)}
                        className="max-w-24"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Partial Payment Option */}
              <div className="space-y-3">
                <Label className="text-sm">Pago Parcial (Opcional)</Label>
                <Input
                  type="number"
                  placeholder={`Máximo €${bill.amount_due.toFixed(2)}`}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Deja vacío para pagar el total
                </p>
              </div>

              <Separator />

              {/* Total */}
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cuenta</span>
                  <span>€{bill.amount_due.toFixed(2)}</span>
                </div>
                {tipEnabled && (
                  <div className="flex justify-between text-sm">
                    <span>Propina</span>
                    <span>€{calculateTip().toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span className="text-primary">€{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handlePay}
                disabled={processing}
                size="lg"
                className="w-full"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    PAGAR €{calculateTotal().toFixed(2)}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Review Bill screen (default)
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <div className="max-w-md mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <ChefHat className="h-8 w-8" />
          <span className="font-display font-bold text-2xl">Josephine</span>
        </div>

        {/* Bill Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Revisar Cuenta</span>
              <Badge variant={bill.status === 'paid' ? 'default' : 'secondary'}>
                {bill.status === 'open' ? 'Pendiente' : 
                 bill.status === 'partially_paid' ? 'Parcial' : 'Pagada'}
              </Badge>
            </CardTitle>
            <CardDescription>Operación {bill.operation_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(bill.created_at).toLocaleDateString('es-ES')}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{bill.waiter_name || 'N/A'}</span>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              {bill.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                  </div>
                  <span className="font-medium">€{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Base</span>
                <span>€{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA</span>
                <span>€{bill.tax_total.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>TOTAL</span>
                <span className="text-primary">€{bill.total.toFixed(2)}</span>
              </div>
            </div>

            {bill.amount_paid > 0 && (
              <>
                <Separator />
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Ya pagado</span>
                    <span className="font-bold text-green-600">-€{bill.amount_paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Pendiente</span>
                    <span>€{bill.amount_due.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pay Button */}
        {bill.status !== 'paid' && (
          <Button
            onClick={() => setScreen('payment')}
            size="lg"
            className="w-full text-lg h-14"
          >
            <CreditCard className="h-6 w-6 mr-2" />
            PAGAR €{bill.amount_due.toFixed(2)}
          </Button>
        )}

        {bill.status === 'paid' && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="p-6 text-center">
              <Check className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <p className="font-bold text-green-800 dark:text-green-200">
                Cuenta ya pagada
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
