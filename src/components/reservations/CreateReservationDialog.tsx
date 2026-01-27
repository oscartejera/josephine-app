import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  defaultDate?: Date;
  onSuccess: () => void;
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  locationId,
  defaultDate,
  onSuccess,
}: CreateReservationDialogProps) {
  const { groupId } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: 2,
    reservation_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    reservation_time: '13:00',
    duration_minutes: 90,
    source: 'manual',
    special_requests: '',
    require_deposit: false,
    deposit_amount: 0,
  });

  const timeSlots = [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      toast.error('Selecciona una ubicación');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('reservations').insert({
        location_id: locationId,
        group_id: groupId,
        guest_name: formData.guest_name,
        guest_phone: formData.guest_phone || null,
        guest_email: formData.guest_email || null,
        party_size: formData.party_size,
        reservation_date: formData.reservation_date,
        reservation_time: formData.reservation_time,
        duration_minutes: formData.duration_minutes,
        source: formData.source,
        special_requests: formData.special_requests || null,
        deposit_required: formData.require_deposit,
        deposit_amount: formData.require_deposit ? formData.deposit_amount : null,
        status: 'confirmed',
      });

      if (error) throw error;

      toast.success('Reserva creada correctamente');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        party_size: 2,
        reservation_date: format(new Date(), 'yyyy-MM-dd'),
        reservation_time: '13:00',
        duration_minutes: 90,
        source: 'manual',
        special_requests: '',
        require_deposit: false,
        deposit_amount: 0,
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nombre del cliente *</Label>
              <Input
                value={formData.guest_name}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div>
              <Label>Teléfono</Label>
              <Input
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                placeholder="+34 600 000 000"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={formData.reservation_date}
                onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Hora *</Label>
              <Select
                value={formData.reservation_time}
                onValueChange={(value) => setFormData({ ...formData, reservation_time: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(slot => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Comensales *</Label>
              <Select
                value={String(formData.party_size)}
                onValueChange={(value) => setFormData({ ...formData, party_size: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'persona' : 'personas'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Origen</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="phone">Teléfono</SelectItem>
                  <SelectItem value="widget">Web</SelectItem>
                  <SelectItem value="walk_in">De paso</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Notas / Peticiones especiales</Label>
              <Textarea
                value={formData.special_requests}
                onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                placeholder="Alergias, preferencias, ocasión especial..."
                rows={2}
              />
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Requerir señal</Label>
                <p className="text-xs text-muted-foreground">Cobrar depósito para confirmar</p>
              </div>
              <Switch
                checked={formData.require_deposit}
                onCheckedChange={(checked) => setFormData({ ...formData, require_deposit: checked })}
              />
            </div>

            {formData.require_deposit && (
              <div className="col-span-2">
                <Label>Importe de la señal (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Reserva'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
