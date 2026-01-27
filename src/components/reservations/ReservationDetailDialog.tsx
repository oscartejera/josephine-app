import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Phone, Mail, Users, Calendar, Clock, CreditCard, MessageSquare, UserCheck, X } from 'lucide-react';

interface ReservationDetailDialogProps {
  reservation: {
    id: string;
    guest_name: string;
    party_size: number;
    reservation_date: string;
    reservation_time: string;
    status: string;
    source: string | null;
    deposit_paid: boolean | null;
    guest_phone: string | null;
    guest_email: string | null;
    special_requests: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ReservationDetailDialog({
  reservation,
  open,
  onOpenChange,
  onUpdate,
}: ReservationDetailDialogProps) {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservation.id);

      if (error) throw error;

      toast.success(`Reserva ${newStatus === 'confirmed' ? 'confirmada' : newStatus === 'cancelled' ? 'cancelada' : newStatus === 'seated' ? 'sentada' : 'actualizada'}`);
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating reservation:', error);
      toast.error('Error al actualizar la reserva');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'seated': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-muted text-muted-foreground';
      case 'cancelled': return 'bg-destructive/20 text-destructive';
      case 'no_show': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'seated': return 'Sentados';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      case 'no_show': return 'No Show';
      default: return status;
    }
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case 'manual': return 'Manual';
      case 'phone': return 'Teléfono';
      case 'widget': return 'Web';
      case 'walk_in': return 'De paso';
      case 'google': return 'Google';
      default: return 'Manual';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalle de Reserva</DialogTitle>
            <Badge className={getStatusColor(reservation.status)}>
              {getStatusLabel(reservation.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guest Info */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold">{reservation.guest_name}</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {reservation.guest_phone && (
                <a href={`tel:${reservation.guest_phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-4 w-4" />
                  {reservation.guest_phone}
                </a>
              )}
              {reservation.guest_email && (
                <a href={`mailto:${reservation.guest_email}`} className="flex items-center gap-1 hover:text-foreground">
                  <Mail className="h-4 w-4" />
                  {reservation.guest_email}
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Reservation Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(reservation.reservation_date), "d 'de' MMMM yyyy", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{reservation.reservation_time.substring(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{reservation.party_size} {reservation.party_size === 1 ? 'persona' : 'personas'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>{reservation.deposit_paid ? 'Señal pagada' : 'Sin señal'}</span>
            </div>
          </div>

          {reservation.special_requests && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Notas
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {reservation.special_requests}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Source */}
          <div className="text-xs text-muted-foreground">
            Origen: {getSourceLabel(reservation.source)}
          </div>

          {/* Actions */}
          {reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
            <div className="flex gap-2 pt-2">
              {reservation.status === 'pending' && (
                <Button 
                  className="flex-1" 
                  onClick={() => updateStatus('confirmed')}
                  disabled={loading}
                >
                  Confirmar
                </Button>
              )}
              {(reservation.status === 'confirmed' || reservation.status === 'pending') && (
                <Button 
                  className="flex-1" 
                  variant="default"
                  onClick={() => updateStatus('seated')}
                  disabled={loading}
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Sentar
                </Button>
              )}
              {reservation.status === 'seated' && (
                <Button 
                  className="flex-1" 
                  onClick={() => updateStatus('completed')}
                  disabled={loading}
                >
                  Completar
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => updateStatus('cancelled')}
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {reservation.status !== 'cancelled' && reservation.status !== 'completed' && reservation.status !== 'seated' && (
            <Button 
              variant="ghost" 
              className="w-full text-destructive"
              onClick={() => updateStatus('no_show')}
              disabled={loading}
            >
              Marcar como No Show
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
