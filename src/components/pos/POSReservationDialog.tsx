import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Users, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { POSTable } from '@/hooks/usePOSData';

interface POSReservationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReservationFormData) => Promise<void>;
  tables: POSTable[];
  locationId: string;
  preselectedTable?: POSTable;
}

export interface ReservationFormData {
  location_id: string;
  pos_table_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed';
  notes: string | null;
  special_requests: string | null;
}

export function POSReservationDialog({ 
  open, 
  onClose, 
  onSubmit, 
  tables,
  locationId,
  preselectedTable 
}: POSReservationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ReservationFormData>({
    location_id: locationId,
    pos_table_id: preselectedTable?.id || null,
    guest_name: '',
    guest_phone: null,
    guest_email: null,
    party_size: 2,
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '20:00',
    duration_minutes: 90,
    status: 'confirmed',
    notes: null,
    special_requests: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guest_name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      toast.success('Reserva creada correctamente');
      onClose();
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  const availableTables = tables.filter(t => 
    t.status === 'available' || t.id === preselectedTable?.id
  );

  // Generate time slots from 12:00 to 23:30
  const timeSlots = [];
  for (let h = 12; h <= 23; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Nueva Reserva
          </DialogTitle>
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
              onChange={(e) => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
              placeholder="Nombre completo"
              required
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="guest_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfono
              </Label>
              <Input
                id="guest_phone"
                type="tel"
                value={formData.guest_phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, guest_phone: e.target.value || null }))}
                placeholder="+34 600..."
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
                value={formData.guest_email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, guest_email: e.target.value || null }))}
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.reservation_date}
                onChange={(e) => setFormData(prev => ({ ...prev, reservation_date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora
              </Label>
              <Select 
                value={formData.reservation_time}
                onValueChange={(value) => setFormData(prev => ({ ...prev, reservation_time: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Party Size & Table */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="party_size" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Personas
              </Label>
              <Select 
                value={formData.party_size.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, party_size: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,10,12,15,20].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} personas</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mesa (opcional)</Label>
              <Select 
                value={formData.pos_table_id || 'none'}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  pos_table_id: value === 'none' ? null : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {availableTables.map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.table_number} ({table.seats} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="special_requests">Peticiones especiales</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, special_requests: e.target.value || null }))}
              placeholder="Alergias, celebraciones, preferencias..."
              rows={2}
            />
          </div>

          {/* Email notification info */}
          {formData.guest_email && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              📧 Se enviará confirmación por email a {formData.guest_email}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Crear Reserva'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
