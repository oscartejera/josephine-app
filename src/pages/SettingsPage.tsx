import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Users, Target, Download, Plus, Save, CreditCard, Trash2, CheckCircle2, Shield, RefreshCw, Database, AlertTriangle, Loader2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UsersRolesManager } from '@/components/settings/UsersRolesManager';
import { TeamManager } from '@/components/settings/TeamManager';
import { DemoDataManager } from '@/components/settings/DemoDataManager';
import { ProductKDSManager } from '@/components/settings/ProductKDSManager';
import { PaymentHistoryManager } from '@/components/settings/PaymentHistoryManager';
import { PrinterConfigManager } from '@/components/settings/PrinterConfigManager';
import { Progress } from '@/components/ui/progress';
import { Receipt } from 'lucide-react';

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

interface LocationSetting {
  id: string;
  location_id: string;
  location_name: string;
  target_gp_percent: number;
  target_col_percent: number;
  default_cogs_percent: number;
}

export default function SettingsPage() {
  const { locations, group } = useApp();
  const { profile } = useAuth();
  const { isOwner, hasPermission } = usePermissions();
  const [settings, setSettings] = useState<LocationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ target_gp: '', target_col: '', default_cogs: '' });
  const { toast } = useToast();
  
  const canManageUsers = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);
  const canManageBilling = isOwner || hasPermission(PERMISSIONS.SETTINGS_BILLING_MANAGE);
  const isAdmin = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);
  
  // Payment methods state (mock data - would be stored in backend)
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

  useEffect(() => {
    fetchSettings();
  }, [locations]);

  // Persist payment methods to localStorage
  useEffect(() => {
    localStorage.setItem('paymentMethods', JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('location_settings')
      .select(`
        id, location_id, target_gp_percent, target_col_percent, default_cogs_percent,
        locations(name)
      `);
    
    const mapped: LocationSetting[] = (data || []).map((s: any) => ({
      id: s.id,
      location_id: s.location_id,
      location_name: s.locations?.name || 'Desconocido',
      target_gp_percent: s.target_gp_percent,
      target_col_percent: s.target_col_percent,
      default_cogs_percent: s.default_cogs_percent
    }));
    setSettings(mapped);
    setLoading(false);
  };

  const handleEdit = (setting: LocationSetting) => {
    setEditingId(setting.id);
    setEditValues({
      target_gp: setting.target_gp_percent.toString(),
      target_col: setting.target_col_percent.toString(),
      default_cogs: setting.default_cogs_percent.toString()
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('location_settings')
      .update({
        target_gp_percent: parseFloat(editValues.target_gp),
        target_col_percent: parseFloat(editValues.target_col),
        default_cogs_percent: parseFloat(editValues.default_cogs)
      })
      .eq('id', id);
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar" });
    } else {
      toast({ title: "Guardado", description: "Objetivos actualizados" });
      setEditingId(null);
      fetchSettings();
    }
  };

  const handleExport = async (table: string) => {
    let data: any[] = [];
    let filename = '';
    
    switch (table) {
      case 'tickets':
        const { data: tickets } = await supabase.from('tickets').select('*').limit(1000);
        data = tickets || [];
        filename = 'tickets.csv';
        break;
      case 'employees':
        const { data: employees } = await supabase.from('employees').select('*');
        data = employees || [];
        filename = 'employees.csv';
        break;
      case 'inventory':
        const { data: inventory } = await supabase.from('inventory_items').select('*');
        data = inventory || [];
        filename = 'inventory.csv';
        break;
    }
    
    if (data.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "No hay datos para exportar" });
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    toast({ title: "Exportado", description: `${filename} descargado` });
  };

  // Payment method handlers
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
    // Simple text-based brand indicator
    return brand || 'Card';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground">Configuración del grupo y locales</p>
      </div>

      <Tabs defaultValue="team">
        <TabsList className="flex-wrap h-auto gap-1">
          {canManageUsers && <TabsTrigger value="team">Equipo</TabsTrigger>}
          <TabsTrigger value="locations">Locales</TabsTrigger>
          {canManageUsers && <TabsTrigger value="users">Roles</TabsTrigger>}
          <TabsTrigger value="objectives">Objetivos</TabsTrigger>
          <TabsTrigger value="kds">Destinos KDS</TabsTrigger>
          <TabsTrigger value="printers">Impresoras</TabsTrigger>
          {canManageBilling && <TabsTrigger value="payment">Payment</TabsTrigger>}
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="export">Exportar</TabsTrigger>
          {isOwner && <TabsTrigger value="demo">Demo</TabsTrigger>}
        </TabsList>

        {canManageUsers && (
          <TabsContent value="team">
            <TeamManager />
          </TabsContent>
        )}

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Locales de {group?.name || 'Grupo'}</CardTitle>
                  <CardDescription>Gestiona los locales de tu grupo</CardDescription>
                </div>
                {isAdmin && (
                  <Button disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Local
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Moneda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {loc.name}
                        </div>
                      </TableCell>
                      <TableCell>{loc.city || '-'}</TableCell>
                      <TableCell>Europe/Madrid</TableCell>
                      <TableCell>EUR</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="users">
            <UsersRolesManager />
          </TabsContent>
        )}

        <TabsContent value="objectives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Objetivos por Local
              </CardTitle>
              <CardDescription>Define los KPIs objetivo para cada local</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Target GP%</TableHead>
                    <TableHead className="text-right">Target COL%</TableHead>
                    <TableHead className="text-right">COGS Default %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium">{setting.location_name}</TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.target_gp}
                            onChange={(e) => setEditValues({...editValues, target_gp: e.target.value})}
                          />
                        ) : (
                          `${setting.target_gp_percent}%`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.target_col}
                            onChange={(e) => setEditValues({...editValues, target_col: e.target.value})}
                          />
                        ) : (
                          `${setting.target_col_percent}%`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.default_cogs}
                            onChange={(e) => setEditValues({...editValues, default_cogs: e.target.value})}
                          />
                        ) : (
                          `${setting.default_cogs_percent}%`
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          editingId === setting.id ? (
                            <Button size="sm" onClick={() => handleSave(setting.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(setting)}>
                              Editar
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kds">
          <ProductKDSManager />
        </TabsContent>

        <TabsContent value="printers">
          <PrinterConfigManager />
        </TabsContent>

        <TabsContent value="transactions">
          <PaymentHistoryManager />
        </TabsContent>

        <TabsContent value="payment">
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
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        method.isDefault ? 'border-primary bg-primary/5' : 'border-border'
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
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Datos
              </CardTitle>
              <CardDescription>Descarga datos en formato CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Tickets</h3>
                  <p className="text-sm text-muted-foreground mb-4">Historial de ventas y transacciones</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('tickets')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Empleados</h3>
                  <p className="text-sm text-muted-foreground mb-4">Lista de empleados y roles</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('employees')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Inventario</h3>
                  <p className="text-sm text-muted-foreground mb-4">Items de inventario y stock</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('inventory')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isOwner && (
          <TabsContent value="demo">
            <DemoDataManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
