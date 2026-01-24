import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CreditCard, Banknote, Smartphone, Check, Users, Receipt, 
  FileText, Plus, Minus, Percent, Euro, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { POSStripePayment } from './POSStripePayment';
import { POSLoyaltyPanel, LoyaltyMember, LoyaltyReward } from './POSLoyaltyPanel';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OrderLineItem {
  id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface SplitPayment {
  id: string;
  label: string;
  amount: number;
  method: 'card' | 'cash' | 'other' | null;
  paid: boolean;
  items?: string[]; // item IDs for split by items
}

interface POSSplitPaymentModalProps {
  total: number;
  subtotal: number;
  tax: number;
  orderLines: OrderLineItem[];
  tableName?: string;
  covers: number;
  ticketId: string;
  locationId: string;
  groupId: string;
  onClose: () => void;
  onPayment: (payments: { method: string; amount: number; tip: number; stripePaymentIntentId?: string }[], loyaltyData?: {
    memberId: string;
    pointsEarned: number;
    rewardRedeemed?: { id: string; value: number; type: string };
  }) => Promise<void>;
  onPrintReceipt: (data: ReceiptData) => void;
}

export interface ReceiptData {
  ticketNumber: string;
  date: string;
  tableName: string;
  items: { name: string; qty: number; price: number; total: number }[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  loyaltyPointsEarned?: number;
  loyaltyRewardRedeemed?: string;
}

const paymentMethods = [
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'other', label: 'Bizum', icon: Smartphone },
];

const tipPresets = [0, 5, 10, 15];
const quickAmounts = [5, 10, 20, 50, 100];

export function POSSplitPaymentModal({
  total,
  subtotal,
  tax,
  orderLines,
  tableName = 'Mesa',
  covers,
  ticketId,
  locationId,
  groupId,
  onClose,
  onPayment,
  onPrintReceipt,
}: POSSplitPaymentModalProps) {
  const [splitMode, setSplitMode] = useState<'full' | 'equal' | 'items'>('full');
  const [splitCount, setSplitCount] = useState(covers || 2);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [selectedItemsForSplit, setSelectedItemsForSplit] = useState<Map<string, Set<number>>>(new Map());
  
  // Current payment being processed
  const [currentPaymentIndex, setCurrentPaymentIndex] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('card');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [pendingStripePaymentId, setPendingStripePaymentId] = useState<string | null>(null);

  // Loyalty state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointsPerEuro, setPointsPerEuro] = useState(1);
  const [welcomeBonus, setWelcomeBonus] = useState(50);
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);

  // Load loyalty settings
  useEffect(() => {
    const loadLoyaltySettings = async () => {
      if (!groupId) return;
      const { data } = await supabase
        .from('loyalty_settings')
        .select('is_enabled, points_per_euro, welcome_bonus')
        .eq('group_id', groupId)
        .single();
      
      if (data) {
        setLoyaltyEnabled(data.is_enabled || false);
        setPointsPerEuro(data.points_per_euro || 1);
        setWelcomeBonus(data.welcome_bonus || 50);
      }
    };
    loadLoyaltySettings();
  }, [groupId]);

  // Calculate reward discount
  const rewardDiscount = useMemo(() => {
    if (!selectedReward) return 0;
    if (selectedReward.reward_type === 'discount') {
      return selectedReward.value || 0;
    }
    if (selectedReward.reward_type === 'percentage') {
      return total * ((selectedReward.value || 0) / 100);
    }
    return 0;
  }, [selectedReward, total]);

  // Calculate tip amount
  const tipAmount = useMemo(() => {
    if (customTip) return parseFloat(customTip) || 0;
    return (total - rewardDiscount) * (tipPercent / 100);
  }, [total, tipPercent, customTip, rewardDiscount]);

  const grandTotal = total - rewardDiscount + tipAmount;
  const pointsToEarn = Math.floor((total - rewardDiscount) * pointsPerEuro);

  // Initialize split payments when mode changes
  const initializeSplitPayments = (mode: 'full' | 'equal' | 'items', count: number = splitCount) => {
    if (mode === 'full') {
      setSplitPayments([{
        id: '1',
        label: 'Total',
        amount: grandTotal,
        method: null,
        paid: false,
      }]);
    } else if (mode === 'equal') {
      const amountPerPerson = grandTotal / count;
      setSplitPayments(
        Array.from({ length: count }, (_, i) => ({
          id: String(i + 1),
          label: `Comensal ${i + 1}`,
          amount: parseFloat(amountPerPerson.toFixed(2)),
          method: null,
          paid: false,
        }))
      );
    } else {
      // Items mode - start empty, user selects items for each person
      setSplitPayments([]);
      setSelectedItemsForSplit(new Map());
    }
    setCurrentPaymentIndex(0);
  };

  // Handle split mode change
  const handleSplitModeChange = (mode: 'full' | 'equal' | 'items') => {
    setSplitMode(mode);
    initializeSplitPayments(mode);
  };

  // Handle split count change for equal split
  const handleSplitCountChange = (delta: number) => {
    const newCount = Math.max(2, Math.min(10, splitCount + delta));
    setSplitCount(newCount);
    if (splitMode === 'equal') {
      initializeSplitPayments('equal', newCount);
    }
  };

  // Toggle item selection for split by items
  const toggleItemForPerson = (personIndex: number, itemIndex: number) => {
    const newMap = new Map(selectedItemsForSplit);
    const personKey = String(personIndex);
    
    if (!newMap.has(personKey)) {
      newMap.set(personKey, new Set());
    }
    
    const personItems = newMap.get(personKey)!;
    if (personItems.has(itemIndex)) {
      personItems.delete(itemIndex);
    } else {
      // Remove from other persons first
      newMap.forEach((items, key) => {
        if (key !== personKey) items.delete(itemIndex);
      });
      personItems.add(itemIndex);
    }
    
    setSelectedItemsForSplit(newMap);
    
    // Recalculate amounts
    updateItemSplitPayments(newMap);
  };

  const updateItemSplitPayments = (itemMap: Map<string, Set<number>>) => {
    const payments: SplitPayment[] = [];
    
    itemMap.forEach((itemIndices, personKey) => {
      if (itemIndices.size > 0) {
        let amount = 0;
        itemIndices.forEach(idx => {
          if (orderLines[idx]) {
            amount += orderLines[idx].total;
          }
        });
        // Add proportional tip and tax
        const proportion = amount / subtotal;
        const proportionalTip = tipAmount * proportion;
        const proportionalTax = tax * proportion;
        
        payments.push({
          id: personKey,
          label: `Comensal ${parseInt(personKey) + 1}`,
          amount: parseFloat((amount + proportionalTip + proportionalTax).toFixed(2)),
          method: null,
          paid: false,
          items: Array.from(itemIndices).map(i => orderLines[i]?.name || ''),
        });
      }
    });
    
    setSplitPayments(payments);
  };

  // Add new person for item split
  const addPersonForItemSplit = () => {
    const nextIndex = splitPayments.length;
    setSelectedItemsForSplit(prev => {
      const newMap = new Map(prev);
      newMap.set(String(nextIndex), new Set());
      return newMap;
    });
    setSplitPayments(prev => [...prev, {
      id: String(nextIndex),
      label: `Comensal ${nextIndex + 1}`,
      amount: 0,
      method: null,
      paid: false,
      items: [],
    }]);
  };

  // Cash calculation
  const cashAmount = parseFloat(cashReceived) || 0;
  const currentPayment = splitPayments[currentPaymentIndex];
  const currentAmount = currentPayment?.amount || grandTotal;
  const change = selectedMethod === 'cash' ? Math.max(0, cashAmount - currentAmount) : 0;
  const canPay = selectedMethod !== 'cash' || cashAmount >= currentAmount;

  // Handle Stripe payment success
  const handleStripeSuccess = async (paymentIntentId: string) => {
    setPendingStripePaymentId(paymentIntentId);
    setShowStripePayment(false);
    
    // Continue with payment processing
    await processPaymentAfterStripe(paymentIntentId);
  };

  const handleStripeError = (error: string) => {
    toast.error(error);
    setShowStripePayment(false);
  };

  // Process current payment
  const handleProcessPayment = async () => {
    // If card payment, show Stripe form
    if (selectedMethod === 'card') {
      setShowStripePayment(true);
      return;
    }
    
    // For cash/other, process directly
    await processPaymentAfterStripe(null);
  };

  const processPaymentAfterStripe = async (stripePaymentIntentId: string | null) => {
    setLoading(true);
    try {
      const paymentData = splitPayments.map((sp, idx) => ({
        method: idx === currentPaymentIndex ? selectedMethod : (sp.method || 'card'),
        amount: sp.amount,
        tip: idx === currentPaymentIndex ? (tipAmount / splitPayments.length) : 0,
        stripePaymentIntentId: idx === currentPaymentIndex ? stripePaymentIntentId || undefined : undefined,
      }));

      // Mark current as paid
      const updatedPayments = [...splitPayments];
      updatedPayments[currentPaymentIndex] = {
        ...updatedPayments[currentPaymentIndex],
        method: selectedMethod as 'card' | 'cash' | 'other',
        paid: true,
      };
      setSplitPayments(updatedPayments);

      // Check if all paid
      const allPaid = updatedPayments.every(p => p.paid);
      
      if (allPaid) {
        // Prepare loyalty data if member is selected
        const loyaltyData = selectedMember ? {
          memberId: selectedMember.id,
          pointsEarned: pointsToEarn,
          rewardRedeemed: selectedReward ? {
            id: selectedReward.id,
            value: rewardDiscount,
            type: selectedReward.reward_type,
          } : undefined,
        } : undefined;

        // Process all payments with loyalty data
        await onPayment(paymentData, loyaltyData);
        setShowReceipt(true);
      } else {
        // Move to next unpaid
        const nextUnpaid = updatedPayments.findIndex((p, i) => i > currentPaymentIndex && !p.paid);
        if (nextUnpaid >= 0) {
          setCurrentPaymentIndex(nextUnpaid);
          setCashReceived('');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate receipt data
  const generateReceiptData = (): ReceiptData => ({
    ticketNumber: `#${Date.now().toString().slice(-6)}`,
    date: new Date().toLocaleString('es-ES'),
    tableName,
    items: orderLines.map(l => ({
      name: l.name,
      qty: l.quantity,
      price: l.unit_price,
      total: l.total,
    })),
    subtotal,
    tax,
    tip: tipAmount,
    total: grandTotal,
    paymentMethod: splitPayments.map(p => p.method).join(', '),
    cashReceived: selectedMethod === 'cash' ? cashAmount : undefined,
    change: selectedMethod === 'cash' ? change : undefined,
    loyaltyPointsEarned: selectedMember ? pointsToEarn : undefined,
    loyaltyRewardRedeemed: selectedReward ? selectedReward.name : undefined,
  });

  // Remaining amount for items mode
  const assignedTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = grandTotal - assignedTotal;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Cobrar - {tableName}</span>
            <div className="text-right">
              {rewardDiscount > 0 && (
                <p className="text-sm text-muted-foreground line-through">€{total.toFixed(2)}</p>
              )}
              <span className="text-2xl font-bold">€{grandTotal.toFixed(2)}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Loyalty Panel - Always visible at top when enabled */}
        {loyaltyEnabled && (
          <POSLoyaltyPanel
            groupId={groupId}
            locationId={locationId}
            ticketTotal={total - rewardDiscount}
            pointsPerEuro={pointsPerEuro}
            welcomeBonus={welcomeBonus}
            selectedMember={selectedMember}
            selectedReward={selectedReward}
            onMemberSelect={setSelectedMember}
            onRewardSelect={setSelectedReward}
          />
        )}

        {/* Reward discount display */}
        {selectedReward && rewardDiscount > 0 && (
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg border border-primary/30">
            <span className="text-sm font-medium">🎁 {selectedReward.name}</span>
            <span className="font-bold text-primary">-€{rewardDiscount.toFixed(2)}</span>
          </div>
        )}

        <Tabs value={splitMode} onValueChange={(v) => handleSplitModeChange(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="full" className="gap-2">
              <Receipt className="h-4 w-4" />
              Cuenta única
            </TabsTrigger>
            <TabsTrigger value="equal" className="gap-2">
              <Users className="h-4 w-4" />
              Dividir igual
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <FileText className="h-4 w-4" />
              Por items
            </TabsTrigger>
          </TabsList>

          {/* Full Payment */}
          <TabsContent value="full" className="flex-1 overflow-auto space-y-4 mt-4">
            <PaymentMethodSelector
              selectedMethod={selectedMethod}
              onSelect={setSelectedMethod}
              amount={grandTotal}
              cashReceived={cashReceived}
              onCashChange={setCashReceived}
              change={change}
            />
            
            <TipSelector
              tipPercent={tipPercent}
              customTip={customTip}
              onTipPercentChange={(p) => { setTipPercent(p); setCustomTip(''); }}
              onCustomTipChange={setCustomTip}
              total={total - rewardDiscount}
              tipAmount={tipAmount}
            />
          </TabsContent>

          {/* Equal Split */}
          <TabsContent value="equal" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <span className="text-muted-foreground">Dividir entre</span>
              <Button variant="outline" size="icon" onClick={() => handleSplitCountChange(-1)}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold w-12 text-center">{splitCount}</span>
              <Button variant="outline" size="icon" onClick={() => handleSplitCountChange(1)}>
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">personas</span>
            </div>

            <div className="text-center text-lg">
              <span className="text-muted-foreground">Cada persona paga: </span>
              <span className="font-bold text-primary">€{(grandTotal / splitCount).toFixed(2)}</span>
            </div>

            <ScrollArea className="h-40">
              <div className="space-y-2">
                {splitPayments.map((payment, idx) => (
                  <div
                    key={payment.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      payment.paid && "bg-green-500/10 border-green-500",
                      idx === currentPaymentIndex && !payment.paid && "ring-2 ring-primary"
                    )}
                  >
                    <span>{payment.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">€{payment.amount.toFixed(2)}</span>
                      {payment.paid && <Check className="h-4 w-4 text-green-600" />}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {currentPayment && !currentPayment.paid && (
              <>
                <div className="text-center text-sm text-muted-foreground">
                  Cobrando a: <span className="font-medium">{currentPayment.label}</span>
                </div>
                <PaymentMethodSelector
                  selectedMethod={selectedMethod}
                  onSelect={setSelectedMethod}
                  amount={currentPayment.amount}
                  cashReceived={cashReceived}
                  onCashChange={setCashReceived}
                  change={change}
                  compact
                />
              </>
            )}
          </TabsContent>

          {/* Split by Items */}
          <TabsContent value="items" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Asigna items a cada comensal
              </span>
              <Button variant="outline" size="sm" onClick={addPersonForItemSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir comensal
              </Button>
            </div>

            {remainingAmount > 0.01 && (
              <div className="text-sm text-amber-600 bg-amber-500/10 p-2 rounded">
                Quedan €{remainingAmount.toFixed(2)} sin asignar
              </div>
            )}

            <ScrollArea className="h-60">
              <div className="space-y-4">
                {splitPayments.map((payment, personIdx) => (
                  <div key={payment.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{payment.label}</span>
                      <span className={cn(
                        "font-bold",
                        payment.paid && "text-green-600"
                      )}>
                        €{payment.amount.toFixed(2)}
                        {payment.paid && <Check className="inline h-4 w-4 ml-1" />}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {orderLines.map((item, itemIdx) => {
                        const isSelected = selectedItemsForSplit.get(String(personIdx))?.has(itemIdx);
                        const isAssignedElsewhere = !isSelected && 
                          Array.from(selectedItemsForSplit.values()).some(set => set.has(itemIdx));
                        
                        return (
                          <Button
                            key={itemIdx}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            disabled={isAssignedElsewhere || payment.paid}
                            className={cn(
                              "text-xs",
                              isAssignedElsewhere && "opacity-30"
                            )}
                            onClick={() => toggleItemForPerson(personIdx, itemIdx)}
                          >
                            {item.name} (€{item.total.toFixed(2)})
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {currentPayment && !currentPayment.paid && splitPayments.length > 0 && (
              <>
                <div className="text-center text-sm text-muted-foreground">
                  Cobrando a: <span className="font-medium">{currentPayment.label}</span>
                </div>
                <PaymentMethodSelector
                  selectedMethod={selectedMethod}
                  onSelect={setSelectedMethod}
                  amount={currentPayment.amount}
                  cashReceived={cashReceived}
                  onCashChange={setCashReceived}
                  change={change}
                  compact
                />
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Tip for split modes */}
        {splitMode !== 'full' && (
          <TipSelector
            tipPercent={tipPercent}
            customTip={customTip}
            onTipPercentChange={(p) => { 
              setTipPercent(p); 
              setCustomTip(''); 
              // Reinitialize with new tip
              setTimeout(() => initializeSplitPayments(splitMode), 0);
            }}
            onCustomTipChange={(v) => {
              setCustomTip(v);
              setTimeout(() => initializeSplitPayments(splitMode), 0);
            }}
            total={total}
            tipAmount={tipAmount}
            compact
          />
        )}

        {/* Stripe Payment Overlay */}
        {showStripePayment && (
          <div className="absolute inset-0 bg-background z-10 flex flex-col p-6">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStripePayment(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-semibold">Pago con tarjeta</h3>
              <span className="ml-auto text-xl font-bold">€{currentAmount.toFixed(2)}</span>
            </div>
            
            <POSStripePayment
              amount={currentAmount}
              ticketId={ticketId}
              locationId={locationId}
              onSuccess={handleStripeSuccess}
              onError={handleStripeError}
              onCancel={() => setShowStripePayment(false)}
            />
          </div>
        )}

        {/* Action Buttons */}
        {!showStripePayment && (
          <div className="flex gap-2 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              className="flex-1 h-12 text-lg"
              disabled={!canPay || loading || (splitMode === 'items' && remainingAmount > 0.01)}
              onClick={handleProcessPayment}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  {splitPayments.filter(p => p.paid).length > 0 
                    ? `Cobrar (${splitPayments.filter(p => p.paid).length + 1}/${splitPayments.length})`
                    : 'Confirmar pago'
                  }
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Payment Method Selector Sub-component
function PaymentMethodSelector({
  selectedMethod,
  onSelect,
  amount,
  cashReceived,
  onCashChange,
  change,
  compact = false,
}: {
  selectedMethod: string;
  onSelect: (method: string) => void;
  amount: number;
  cashReceived: string;
  onCashChange: (value: string) => void;
  change: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3")}>
        {paymentMethods.map((method) => (
          <Button
            key={method.id}
            variant={selectedMethod === method.id ? "default" : "outline"}
            className={cn(
              "flex-col gap-1",
              compact ? "h-14" : "h-16"
            )}
            onClick={() => onSelect(method.id)}
          >
            <method.icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
            <span className={cn(compact && "text-xs")}>{method.label}</span>
          </Button>
        ))}
      </div>

      {selectedMethod === 'cash' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Recibido</label>
            <Input
              type="number"
              step="0.01"
              value={cashReceived}
              onChange={(e) => onCashChange(e.target.value)}
              className="text-xl h-12 text-center font-bold"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                onClick={() => onCashChange(amt.toString())}
              >
                €{amt}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCashChange(amount.toFixed(2))}
            >
              Exacto
            </Button>
          </div>

          {parseFloat(cashReceived) >= amount && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">Cambio</p>
              <p className="text-xl font-bold text-green-600">€{change.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tip Selector Sub-component
function TipSelector({
  tipPercent,
  customTip,
  onTipPercentChange,
  onCustomTipChange,
  total,
  tipAmount,
  compact = false,
}: {
  tipPercent: number;
  customTip: string;
  onTipPercentChange: (percent: number) => void;
  onCustomTipChange: (value: string) => void;
  total: number;
  tipAmount: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2 p-3 bg-muted/50 rounded-lg", compact && "p-2")}>
      <div className="flex items-center justify-between">
        <span className={cn("font-medium flex items-center gap-1", compact && "text-sm")}>
          <Percent className="h-4 w-4" />
          Propina
        </span>
        <span className={cn("font-bold text-primary", compact && "text-sm")}>
          €{tipAmount.toFixed(2)}
        </span>
      </div>
      
      <div className="flex gap-2">
        {tipPresets.map((percent) => (
          <Button
            key={percent}
            variant={tipPercent === percent && !customTip ? "default" : "outline"}
            size="sm"
            onClick={() => onTipPercentChange(percent)}
            className="flex-1"
          >
            {percent}%
          </Button>
        ))}
        <div className="relative flex-1">
          <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="number"
            step="0.5"
            placeholder="Otro"
            value={customTip}
            onChange={(e) => onCustomTipChange(e.target.value)}
            className="h-8 pl-6 text-center text-sm"
          />
        </div>
      </div>
    </div>
  );
}
