import { useState } from 'react';
import { CashSession } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Wallet, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

interface POSCashSessionProps {
  locationId: string;
  session: CashSession | null;
  onSessionChange: () => void;
}

export function POSCashSession({ locationId, session, onSessionChange }: POSCashSessionProps) {
  const { user } = useAuth();
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenSession = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pos_cash_sessions')
        .insert({
          location_id: locationId,
          opened_by: user.id,
          opening_cash: parseFloat(openingCash) || 0,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Caja abierta');
      setShowOpenDialog(false);
      setOpeningCash('');
      onSessionChange();
    } catch (error) {
      console.error('Error opening cash session:', error);
      toast.error('Error al abrir caja');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session || !user) return;

    setLoading(true);
    try {
      // Calculate expected cash from cash payments during session
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('method', 'cash')
        .gte('created_at', session.opened_at);

      const cashPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const expectedCash = session.opening_cash + cashPayments;
      const actualCash = parseFloat(closingCash) || 0;
      const difference = actualCash - expectedCash;

      const { error } = await supabase
        .from('pos_cash_sessions')
        .update({
          closed_by: user.id,
          closing_cash: actualCash,
          expected_cash: expectedCash,
          cash_difference: difference,
          closed_at: new Date().toISOString(),
          status: 'closed',
        })
        .eq('id', session.id);

      if (error) throw error;

      if (Math.abs(difference) > 0.01) {
        toast.warning(`Caja cerrada con diferencia de €${difference.toFixed(2)}`);
      } else {
        toast.success('Caja cerrada correctamente');
      }

      setShowCloseDialog(false);
      setClosingCash('');
      onSessionChange();
    } catch (error) {
      console.error('Error closing cash session:', error);
      toast.error('Error al cerrar caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {session ? (
        <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(true)}>
          <Lock className="h-4 w-4 mr-2" />
          Cerrar caja
        </Button>
      ) : (
        <Button variant="default" size="sm" onClick={() => setShowOpenDialog(true)}>
          <Unlock className="h-4 w-4 mr-2" />
          Abrir caja
        </Button>
      )}

      {/* Open Session Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Abrir Caja
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Efectivo inicial</label>
              <Input
                type="number"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="text-xl h-14 text-center"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cantidad de efectivo al iniciar el turno
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpenSession} disabled={loading}>
              {loading ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Cerrar Caja
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Efectivo inicial</span>
                <span className="font-medium">€{session?.opening_cash.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Efectivo final (contado)</label>
              <Input
                type="number"
                step="0.01"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0.00"
                className="text-xl h-14 text-center"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cuenta el efectivo en caja y introduce el total
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCloseSession} disabled={loading}>
              {loading ? 'Cerrando...' : 'Cerrar caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
