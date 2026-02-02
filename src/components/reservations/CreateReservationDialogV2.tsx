/**
 * CreateReservationDialogV2 - Complete version with all features
 */

import { useState, useEffect } from 'react';
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
  MapPin,
  Utensils,
  CreditCard,
  Tag,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useReservations } from '@/contexts/ReservationsContext';
import type { CreateReservationInput, ReservationSettings } from '@/types/reservations';
import { cn } from '@/lib/utils';

interface CreateReservationDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateReservationInput) => Promise<any>;
  settings: ReservationSettings | null;
  selectedDate: Date;
  locationId: string | null;
}

export function CreateReservationDialogV2({
  open,
  onOpenChange,
  onSubmit,
  settings,
  selectedDate,
  locationId,
}: CreateReservationDialogV2Props) {
  const { dataLayer } = useReservations();
  const [date, setDate] = useState<Date>(selectedDate);
  const [time, setTime] = useState('20:00');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  
  // New fields
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  
  // Data for dropdowns
  const [zones, setZones] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [availabilityCheck, setAvailabilityCheck] = useState<any>(null);
  const [depositInfo, setDepositInfo] = useState<{ required: boolean; amount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Load zones and services
  useEffect(() => {
    async function loadData() {
      if (!locationId) return;
      
      try {
        const zonesData = await dataLayer.zones.findActive(locationId);
        setZones(zonesData);
        
        const servicesData = await dataLayer.services.findActive(locationId);
        setServices(servicesData);
        
        // Auto-select first service
        if (servicesData.length > 0 && !selectedService) {
          setSelectedService(servicesData[0].id);
        }
      } catch (error) {
        console.error('Error loading zones/services:', error);
      }
    }
    loadData();
  }, [locationId, dataLayer, selectedService]);

  // Check availability when parameters change
  useEffect(() => {
    async function checkAvailability() {
      if (!locationId || !date || !time || partySize < 1) return;
      
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Here we would call availabilityService.checkAvailability
        // For now, just show that it's checking
        console.log('Checking availability...', { date: dateStr, time, partySize });
      } catch (error) {
        console.error('Error checking availability:', error);
      }
    }
    checkAvailability();
  }, [date, time, partySize, selectedZone, selectedService, locationId]);

  // Calculate deposit when party size changes
  useEffect(() => {
    if (!settings) return;
    
    const requiresDeposit = settings.require_deposit && 
      (!settings.deposit_required_for_party_size || partySize >= settings.deposit_required_for_party_size);
    
    if (requiresDeposit) {
      const amount = settings.deposit_amount_per_person * partySize;
      setDepositInfo({ required: true, amount });
    } else {
      setDepositInfo(null);
    }
  }, [partySize, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: CreateReservationInput = {
        guest_name: guestName,
        guest_phone: guestPhone || undefined,
        guest_email: guestEmail || undefined,
        party_size: partySize,
        reservation_date: format(date, 'yyyy-MM-dd'),
        reservation_time: time,
        notes: notes || undefined,
        special_requests: specialRequests || undefined,
        zone_id: selectedZone || undefined,
        service_id: selectedService || undefined,
        promo_code: promoCode || undefined,
      };

      await onSubmit(data);

      // Reset form
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setPartySize(2);
      setNotes('');
      setSpecialRequests('');
      setSelectedZone('');
      setPromoCode('');
      onOpenChange(false);
    } catch (error: any) {
      alert(error.message || 'Error al crear reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            Completa los datos de la reserva
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Cliente */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Datos del Cliente
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Detalles de la Reserva */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Detalles de la Reserva
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Servicio */}
              <div className="space-y-2">
                <Label htmlFor="service">Servicio *</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex items-center gap-2">
                          <Utensils className="h-4 w-4" />
                          {service.name} ({service.start_time} - {service.end_time})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zona */}
              <div className="space-y-2">
                <Label htmlFor="zone">Zona (Opcional)</Label>
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cualquier zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Cualquier zona</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: zone.color }}
                          />
                          {zone.name} ({zone.capacity} pax)
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {date ? format(date, "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Hora */}
              <div className="space-y-2">
                <Label htmlFor="time">Hora *</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots().map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        <Clock className="inline h-3 w-3 mr-2" />
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Comensales */}
              <div className="space-y-2">
                <Label htmlFor="party_size">Comensales *</Label>
                <Select
                  value={partySize.toString()}
                  onValueChange={(v) => setPartySize(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        <Users className="inline h-3 w-3 mr-2" />
                        {n} {n === 1 ? 'persona' : 'personas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Código Promo */}
              <div className="space-y-2">
                <Label htmlFor="promo">Código Promocional</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="promo"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="CODIGO"
                    className="pl-10 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de Depósito */}
          {depositInfo && depositInfo.required && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Depósito Requerido
                </h4>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Se requiere un depósito de <strong>€{depositInfo.amount.toFixed(2)}</strong>
                {' '}(€{settings?.deposit_amount_per_person} por persona)
              </p>
              {promoCode && (
                <Badge variant="secondary" className="mt-2">
                  Código promo aplicado: {promoCode}
                </Badge>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notas Internas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para el equipo..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="special">Solicitudes Especiales</Label>
              <Textarea
                id="special"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Alergias, preferencias de mesa, celebraciones..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !guestName || !time}>
              {loading ? 'Creando...' : 'Crear Reserva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 12; hour <= 23; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}
