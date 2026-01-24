import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicBooking, ReservationResult } from '@/hooks/usePublicBooking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Users, MapPin, Phone, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

export default function BookingWidget() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const {
    location,
    loading,
    error,
    createReservation,
    fetchOccupiedSlots,
    getAvailableSlots,
    isDateAvailable,
  } = usePublicBooking(locationId);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    party_size: 2,
    reservation_time: '',
    special_requests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationResult | null>(null);

  // Fetch occupied slots when date changes
  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchOccupiedSlots(dateStr);
    }
  }, [selectedDate, fetchOccupiedSlots]);

  // Reset time when date changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, reservation_time: '' }));
  }, [selectedDate]);

  const availableSlots = selectedDate
    ? getAvailableSlots(format(selectedDate, 'yyyy-MM-dd'))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !formData.reservation_time) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createReservation({
        guest_name: formData.guest_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone || undefined,
        party_size: formData.party_size,
        reservation_date: format(selectedDate, 'yyyy-MM-dd'),
        reservation_time: formData.reservation_time,
        special_requests: formData.special_requests || undefined,
      });

      setReservation(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al crear la reserva');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !location) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || 'Restaurante no encontrado'}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (reservation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">¡Reserva Confirmada!</CardTitle>
            <CardDescription>
              Recibirás un email de confirmación en {formData.guest_email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{reservation.location_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <span>
                  {format(new Date(reservation.reservation_date), "EEEE, d 'de' MMMM yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>{reservation.reservation_time.substring(0, 5)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span>
                  {reservation.party_size} {reservation.party_size === 1 ? 'persona' : 'personas'}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Si necesitas modificar o cancelar tu reserva, responde al email de confirmación o
              llámanos directamente.
            </p>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setReservation(null);
                setFormData({
                  guest_name: '',
                  guest_email: '',
                  guest_phone: '',
                  party_size: 2,
                  reservation_time: '',
                  special_requests: '',
                });
                setSelectedDate(undefined);
              }}
            >
              Hacer otra reserva
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{location.public_name || location.name}</CardTitle>
          <CardDescription className="flex flex-col gap-1">
            {location.address && (
              <span className="flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" /> {location.address}
                {location.city && `, ${location.city}`}
              </span>
            )}
            {location.phone && (
              <span className="flex items-center justify-center gap-1">
                <Phone className="h-3 w-3" /> {location.phone}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Fecha
              </Label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={es}
                  disabled={(date) => !isDateAvailable(date)}
                  className="rounded-md border"
                />
              </div>
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Hora
                </Label>
                {availableSlots.length === 0 ? (
                  <Alert>
                    <AlertDescription>No hay horarios disponibles para esta fecha</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        type="button"
                        variant={formData.reservation_time === slot ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData((prev) => ({ ...prev, reservation_time: slot }))}
                      >
                        {slot.substring(0, 5)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Party Size */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Número de personas
              </Label>
              <Select
                value={String(formData.party_size)}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, party_size: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: location.booking_max_party - location.booking_min_party + 1 },
                    (_, i) => location.booking_min_party + i
                  ).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? 'persona' : 'personas'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guest_name">Nombre *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, guest_name: e.target.value }))}
                  placeholder="Tu nombre"
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Teléfono</Label>
                <Input
                  id="guest_phone"
                  type="tel"
                  value={formData.guest_phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, guest_phone: e.target.value }))}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_email">Email *</Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData((prev) => ({ ...prev, guest_email: e.target.value }))}
                placeholder="tu@email.com"
                required
              />
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label htmlFor="special_requests">Peticiones especiales</Label>
              <Textarea
                id="special_requests"
                value={formData.special_requests}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, special_requests: e.target.value }))
                }
                placeholder="Alergias, silla para bebé, celebración especial..."
                rows={3}
                maxLength={500}
              />
            </div>

            {location.booking_notes && (
              <Alert>
                <AlertDescription>{location.booking_notes}</AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || !selectedDate || !formData.reservation_time}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reservando...
                </>
              ) : (
                'Confirmar Reserva'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
