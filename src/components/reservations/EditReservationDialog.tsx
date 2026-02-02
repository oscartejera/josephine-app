import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Reservation } from '@/types/reservations';

interface EditReservationDialogProps {
  reservation: Reservation | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Reservation>) => Promise<void>;
  onCancel: (id: string, reason?: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onSeat: (id: string, tableId?: string) => Promise<void>;
  onNoShow: (id: string) => Promise<void>;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  seated: { label: 'Sentados', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completada', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  no_show: { label: 'No-show', color: 'bg-red-100 text-red-800' },
};

export function EditReservationDialog({
  reservation,
  onOpenChange,
  onUpdate,
  onCancel,
  onConfirm,
  onSeat,
  onNoShow,
}: EditReservationDialogProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reservation) {
      setNotes(reservation.notes || '');
    }
  }, [reservation]);

  if (!reservation) return null;

  const status = statusConfig[reservation.status] || statusConfig.pending;
  const isEditable = ['pending', 'confirmed'].includes(reservation.status);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (notes !== reservation.notes) {
      await onUpdate(reservation.id, { notes });
    }
  };

  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalle de Reserva</DialogTitle>
            <Badge className={status.color}>{status.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guest Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{reservation.guest_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {reservation.party_size} personas
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(reservation.reservation_date), "d 'de' MMMM", { locale: es })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{reservation.reservation_time.substring(0, 5)}</span>
              </div>
              {reservation.guest_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${reservation.guest_phone}`} className="hover:underline">
                    {reservation.guest_phone}
                  </a>
                </div>
              )}
              {reservation.guest_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${reservation.guest_email}`} className="hover:underline truncate">
                    {reservation.guest_email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Special Requests */}
          {reservation.special_requests && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4" />
                Peticiones especiales
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {reservation.special_requests}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notas internas
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas para el equipo..."
              rows={2}
              disabled={!isEditable}
              onBlur={handleSaveNotes}
            />
          </div>

          <Separator />

          {/* Actions */}
          {isEditable && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Acciones</p>
              <div className="grid grid-cols-2 gap-2">
                {reservation.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleAction(() => onConfirm(reservation.id))}
                    disabled={loading}
                  >
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    Confirmar
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleAction(() => onSeat(reservation.id))}
                  disabled={loading}
                >
                  <UserCheck className="h-4 w-4 text-green-500" />
                  Sentar
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={() => handleAction(() => onNoShow(reservation.id))}
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4" />
                  No-show
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={() => handleAction(() => onCancel(reservation.id))}
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Close button for non-editable */}
          {!isEditable && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
