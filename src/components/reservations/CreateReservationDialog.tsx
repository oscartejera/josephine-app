import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Reservation, CreateReservationInput, ReservationStatus } from '@/hooks/useReservationsModule';

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  editingReservation?: Reservation | null;
  onSubmit: (data: CreateReservationInput) => Promise<any>;
  onUpdate?: (id: string, data: Partial<Reservation>) => Promise<any>;
  isSubmitting?: boolean;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 12;
  const minutes = i % 2 === 0 ? '00' : '30';
  if (hour > 23) return null;
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}).filter(Boolean) as string[];

export function CreateReservationDialog({
  open,
  onOpenChange,
  selectedDate,
  editingReservation,
  onSubmit,
  onUpdate,
  isSubmitting,
}: CreateReservationDialogProps) {
  const isEditing = !!editingReservation;

  const [guestName, setGuestName] = useState(editingReservation?.guest_name || '');
  const [guestEmail, setGuestEmail] = useState(editingReservation?.guest_email || '');
  const [guestPhone, setGuestPhone] = useState(editingReservation?.guest_phone || '');
  const [partySize, setPartySize] = useState(editingReservation?.party_size?.toString() || '2');
  const [reservationTime, setReservationTime] = useState(
    editingReservation?.reservation_time?.substring(0, 5) || '13:00'
  );
  const [durationMinutes, setDurationMinutes] = useState(
    editingReservation?.duration_minutes?.toString() || '90'
  );
  const [specialRequests, setSpecialRequests] = useState(editingReservation?.special_requests || '');
  const [notes, setNotes] = useState(editingReservation?.notes || '');
  const [status, setStatus] = useState<ReservationStatus>(
    (editingReservation?.status as ReservationStatus) || 'confirmed'
  );

  // Reset form when dialog opens with new data
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setPartySize('2');
      setReservationTime('13:00');
      setDurationMinutes('90');
      setSpecialRequests('');
      setNotes('');
      setStatus('confirmed');
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    const data: CreateReservationInput = {
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim() || undefined,
      guest_phone: guestPhone.trim() || undefined,
      party_size: parseInt(partySize) || 2,
      reservation_date: format(selectedDate, 'yyyy-MM-dd'),
      reservation_time: `${reservationTime}:00`,
      duration_minutes: parseInt(durationMinutes) || 90,
      special_requests: specialRequests.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    };

    if (isEditing && editingReservation && onUpdate) {
      await onUpdate(editingReservation.id, data);
    } else {
      await onSubmit(data);
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Reserva' : 'Nueva Reserva'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest name */}
          <div className="space-y-2">
            <Label htmlFor="guest_name">Nombre del cliente *</Label>
            <Input
              id="guest_name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nombre completo"
              required
            />
          </div>

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input
                id="guest_email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest_phone">Teléfono</Label>
              <Input
                id="guest_phone"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+34 612 345 678"
              />
            </div>
          </div>

          {/* Time + party size + duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Select value={reservationTime} onValueChange={setReservationTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="party_size">Comensales *</Label>
              <Input
                id="party_size"
                type="number"
                min={1}
                max={50}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duración</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                  <SelectItem value="150">150 min</SelectItem>
                  <SelectItem value="180">180 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status (only when editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ReservationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="seated">Sentados</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Special requests */}
          <div className="space-y-2">
            <Label htmlFor="special_requests">Peticiones especiales</Label>
            <Textarea
              id="special_requests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Alergias, celebración, preferencia de mesa..."
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas visibles solo para el equipo..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !guestName.trim()}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear reserva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
