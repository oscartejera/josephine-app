import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Banknote, Smartphone, Search, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';

interface Payment {
  id: string;
  ticket_id: string;
  amount: number;
  method: 'card' | 'cash' | 'other';
  tip_amount: number;
  stripe_payment_intent_id: string | null;
  paid_at: string;
  created_at: string;
  ticket?: {
    id: string;
    status: string;
    location_id: string;
    locations?: {
      name: string;
    };
  };
}

export function PaymentHistoryManager() {
  const { locations } = useApp();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          ticket:tickets(
            id,
            status,
            location_id,
            locations(name)
          )
        `)
        .order('paid_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      toast.success('ID copiado al portapapeles');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'other':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'card':
        return 'Tarjeta';
      case 'cash':
        return 'Efectivo';
      case 'other':
        return 'Bizum';
      default:
        return method;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      searchTerm === '' ||
      payment.stripe_payment_intent_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.ticket_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
    
    const matchesLocation = locationFilter === 'all' || 
      payment.ticket?.location_id === locationFilter;

    return matchesSearch && matchesMethod && matchesLocation;
  });

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalTips = filteredPayments.reduce((sum, p) => sum + (p.tip_amount || 0), 0);
  const cardPayments = filteredPayments.filter(p => p.method === 'card');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Histórico de Pagos
            </CardTitle>
            <CardDescription>
              Transacciones procesadas con IDs de Stripe
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Transacciones</p>
            <p className="text-xl font-bold">{filteredPayments.length}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Importe Total</p>
            <p className="text-xl font-bold">€{totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Propinas</p>
            <p className="text-xl font-bold">€{totalTips.toFixed(2)}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Pagos con Stripe</p>
            <p className="text-xl font-bold">{cardPayments.filter(p => p.stripe_payment_intent_id).length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID de Stripe o Ticket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="other">Bizum</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los locales</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">Propina</TableHead>
                <TableHead>Stripe Payment Intent ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron pagos
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(payment.paid_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {payment.ticket?.locations?.name || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        {getMethodIcon(payment.method)}
                        {getMethodLabel(payment.method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{payment.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {payment.tip_amount > 0 ? `€${payment.tip_amount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {payment.stripe_payment_intent_id ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[180px] truncate">
                            {payment.stripe_payment_intent_id}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(payment.stripe_payment_intent_id!)}
                          >
                            {copiedId === payment.stripe_payment_intent_id ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <a
                            href={`https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
