import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Plus, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethod {
    id: string;
    type: 'card' | 'bank';
    last4: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
    nickname?: string;
}

export function PaymentMethodsTab() {
    const { toast } = useToast();
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
        const saved = localStorage.getItem('paymentMethods');
        return saved ? JSON.parse(saved) : [];
    });
    const [showAddPayment, setShowAddPayment] = useState(false);
    const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
    const [newCard, setNewCard] = useState({
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        nickname: ''
    });

    // Persist payment methods to localStorage
    useEffect(() => {
        localStorage.setItem('paymentMethods', JSON.stringify(paymentMethods));
    }, [paymentMethods]);

    const detectCardBrand = (number: string): string => {
        const cleaned = number.replace(/\s/g, '');
        if (cleaned.startsWith('4')) return 'Visa';
        if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'Mastercard';
        if (/^3[47]/.test(cleaned)) return 'Amex';
        if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
        return 'Card';
    };

    const formatCardNumber = (value: string): string => {
        const cleaned = value.replace(/\D/g, '').slice(0, 16);
        const groups = cleaned.match(/.{1,4}/g);
        return groups ? groups.join(' ') : cleaned;
    };

    const handleAddPaymentMethod = () => {
        const cleaned = newCard.cardNumber.replace(/\s/g, '');
        if (cleaned.length < 13) {
            toast({ variant: "destructive", title: "Error", description: "Card number is invalid" });
            return;
        }
        if (!newCard.expiryMonth || !newCard.expiryYear) {
            toast({ variant: "destructive", title: "Error", description: "Please enter expiry date" });
            return;
        }
        if (newCard.cvv.length < 3) {
            toast({ variant: "destructive", title: "Error", description: "CVV is invalid" });
            return;
        }

        const newMethod: PaymentMethod = {
            id: crypto.randomUUID(),
            type: 'card',
            last4: cleaned.slice(-4),
            brand: detectCardBrand(cleaned),
            expiryMonth: parseInt(newCard.expiryMonth),
            expiryYear: parseInt(newCard.expiryYear),
            isDefault: paymentMethods.length === 0,
            nickname: newCard.nickname || undefined
        };

        setPaymentMethods([...paymentMethods, newMethod]);
        setNewCard({ cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '', nickname: '' });
        setShowAddPayment(false);
        toast({ title: "Payment method added", description: `${newMethod.brand} ending in ${newMethod.last4}` });
    };

    const handleSetDefaultPayment = (id: string) => {
        setPaymentMethods(paymentMethods.map(pm => ({
            ...pm,
            isDefault: pm.id === id
        })));
        toast({ title: "Default updated", description: "Payment method set as default" });
    };

    const handleDeletePayment = () => {
        if (!deletePaymentId) return;
        const method = paymentMethods.find(pm => pm.id === deletePaymentId);
        const remaining = paymentMethods.filter(pm => pm.id !== deletePaymentId);

        // If deleting default, make first remaining the default
        if (method?.isDefault && remaining.length > 0) {
            remaining[0].isDefault = true;
        }

        setPaymentMethods(remaining);
        setDeletePaymentId(null);
        toast({ title: "Deleted", description: "Payment method removed" });
    };

    const getCardIcon = (brand?: string) => {
        return brand || 'Card';
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Payment Methods
                            </CardTitle>
                            <CardDescription>Manage payment methods for procurement autopay</CardDescription>
                        </div>
                        <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Payment Method
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Payment Method</DialogTitle>
                                    <DialogDescription>
                                        Add a credit or debit card for automated procurement payments.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="cardNumber">Card Number</Label>
                                        <Input
                                            id="cardNumber"
                                            placeholder="1234 5678 9012 3456"
                                            value={newCard.cardNumber}
                                            onChange={(e) => setNewCard({
                                                ...newCard,
                                                cardNumber: formatCardNumber(e.target.value)
                                            })}
                                            maxLength={19}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="expiryMonth">Month</Label>
                                            <Select
                                                value={newCard.expiryMonth}
                                                onValueChange={(val) => setNewCard({ ...newCard, expiryMonth: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="MM" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 12 }, (_, i) => (
                                                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                                                            {String(i + 1).padStart(2, '0')}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="expiryYear">Year</Label>
                                            <Select
                                                value={newCard.expiryYear}
                                                onValueChange={(val) => setNewCard({ ...newCard, expiryYear: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="YY" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 10 }, (_, i) => {
                                                        const year = new Date().getFullYear() + i;
                                                        return (
                                                            <SelectItem key={year} value={String(year)}>
                                                                {year}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cvv">CVV</Label>
                                            <Input
                                                id="cvv"
                                                placeholder="123"
                                                value={newCard.cvv}
                                                onChange={(e) => setNewCard({
                                                    ...newCard,
                                                    cvv: e.target.value.replace(/\D/g, '').slice(0, 4)
                                                })}
                                                maxLength={4}
                                                type="password"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nickname">Nickname (optional)</Label>
                                        <Input
                                            id="nickname"
                                            placeholder="e.g., Company Card, Personal Visa"
                                            value={newCard.nickname}
                                            onChange={(e) => setNewCard({ ...newCard, nickname: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                                        <Shield className="h-4 w-4" />
                                        <span>Your card details are securely encrypted</span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowAddPayment(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleAddPaymentMethod}>
                                        Add Card
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {paymentMethods.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-40" />
                            <p className="font-medium">No payment methods</p>
                            <p className="text-sm mt-1">Add a payment method to enable autopay for procurement orders</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {paymentMethods.map((method) => (
                                <div
                                    key={method.id}
                                    className={`flex items-center justify-between p-4 rounded-lg border ${method.isDefault ? 'border-primary bg-primary/5' : 'border-border'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-8 bg-muted rounded flex items-center justify-center text-xs font-bold">
                                            {getCardIcon(method.brand)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {method.nickname || method.brand} •••• {method.last4}
                                                </span>
                                                {method.isDefault && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Default
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Expires {String(method.expiryMonth).padStart(2, '0')}/{method.expiryYear}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!method.isDefault && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetDefaultPayment(method.id)}
                                            >
                                                Set as default
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeletePaymentId(method.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-2">About Autopay</h4>
                        <p className="text-sm text-muted-foreground">
                            When you place a procurement order, your default payment method will be charged automatically.
                            You can review order totals before confirming each purchase.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Delete confirmation dialog */}
            <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete payment method?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this payment method from your account. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePayment}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
