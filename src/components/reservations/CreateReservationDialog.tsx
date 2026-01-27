import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Clock, Users, User, Phone, Mail, FileText } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReservationSettings } from '@/hooks/useReservationsModule';

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    reservation_date: string;
    reservation_time: string;
    notes?: string;
    special_requests?: string;
  }) => Promise<any>;
  settings: ReservationSettings | null;
  selectedDate: Date;
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  onSubmit,
  settings,
  selectedDate,
}: CreateReservationDialogProps) {
  const [date, setDate] = useState<Date>(selectedDate);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: '2',
    time: '13:00',
    notes: '',
    special_requests: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const timeSlots = [];
  for (let hour = 12; hour <= 23; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guest_name || !formData.party_size || !formData.time) return;

    setSubmitting(true);
    try {
      await onSubmit({
        guest_name: formData.guest_name,
        guest_phone: formData.guest_phone || undefined,
        guest_email: formData.guest_email || undefined,
        party_size: parseInt(formData.party_size),
        reservation_date: format(date, 'yyyy-MM-dd'),
        reservation_time: formData.time,
        notes: formData.notes || undefined,
        special_requests: formData.special_requests || undefined,
      });
      onOpenChange(false);
      // Reset form
      setFormData({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        party_size: '2',
        time: '13:00',
        notes: '',
        special_requests: '',
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Default min/max party sizes (these could be added to settings in a future migration)
  const minParty = 1;
  const maxParty = 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="guest_name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nombre del cliente *
            </Label>
            <Input
              id="guest_name"
              value={formData.guest_name}
              onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              placeholder="Nombre completo"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Fecha *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {format(date, "d 'de' MMM", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora *
              </Label>
              <Select value={formData.time} onValueChange={(v) => setFormData({ ...formData, time: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Party Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Comensales *
            </Label>
            <Select
              value={formData.party_size}
              onValueChange={(v) => setFormData({ ...formData, party_size: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxParty - minParty + 1 }, (_, i) => minParty + i).map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? 'persona' : 'personas'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfono
              </Label>
              <Input
                id="guest_phone"
                type="tel"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                placeholder="+34 612 345 678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notas internas
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas para el equipo..."
              rows={2}
            />
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="special_requests">Peticiones especiales</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              placeholder="Alergias, celebraciones, preferencias..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear Reserva'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
