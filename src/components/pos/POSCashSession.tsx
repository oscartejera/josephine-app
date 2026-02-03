/**
 * POSCashSession Component
 * Cash drawer session management
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet, DoorOpen, DoorClosed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CashSession } from '@/hooks/usePOSData';

interface POSCashSessionProps {
  locationId: string;
  session: CashSession | null;
  onSessionChange: () => void;
}

export function POSCashSession({
  locationId,
  session,
  onSessionChange,
}: POSCashSessionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState('100');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenSession = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pos_cash_sessions')
        .insert({
          location_id: locationId,
          opened_by: 'demo-user', // In production, use actual user
          opening_cash: parseFloat(openingCash) || 0,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Caja abierta');
      onSessionChange();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pos_cash_sessions')
        .update({
          status: 'closed',
          closing_cash: parseFloat(closingCash) || 0,
          closed_at: new Date().toISOString(),
          closed_by: 'demo-user',
        })
        .eq('id', session.id);

      if (error) throw error;

      toast.success('Caja cerrada');
      onSessionChange();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={session ? 'outline' : 'default'}
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="gap-2"
      >
        {session ? (
          <>
            <DoorOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar Caja</span>
          </>
        ) : (
          <>
            <DoorClosed className="h-4 w-4" />
            <span className="hidden sm:inline">Abrir Caja</span>
          </>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {session ? 'Cerrar Caja' : 'Abrir Caja'}
            </DialogTitle>
            <DialogDescription>
              {session
                ? 'Introduce el efectivo contado para cerrar la sesión.'
                : 'Introduce el efectivo inicial para abrir la caja.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {session ? (
              <>
                <div className="grid gap-2">
                  <Label>Efectivo inicial</Label>
                  <div className="text-2xl font-bold">
                    €{session.opening_cash.toFixed(2)}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="closing-cash">Efectivo contado</Label>
                  <Input
                    id="closing-cash"
                    type="number"
                    step="0.01"
                    value={closingCash}
                    onChange={e => setClosingCash(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="opening-cash">Efectivo inicial</Label>
                <Input
                  id="opening-cash"
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  placeholder="100.00"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={session ? handleCloseSession : handleOpenSession}
              disabled={loading}
            >
              {loading ? 'Procesando...' : session ? 'Cerrar Caja' : 'Abrir Caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
