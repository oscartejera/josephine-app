import { useState, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Phone, Users, Calendar, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { POSTable } from '@/hooks/usePOSData';
import { useTableAvailability } from '@/hooks/useTableAvailability';
import { toast } from 'sonner';

interface POSQuickReservationProps {
  locationId: string;
  tables: POSTable[];
  onClose: () => void;
  onConfirm: (data: QuickReservationData) => Promise<void>;
}

export interface QuickReservationData {
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  pos_table_id: string;
}

// Generate time slots from 12:00 to 23:30
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 12;
  const minutes = i % 2 === 0 ? '00' : '30';
  if (hour > 23) return null;
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}).filter(Boolean) as string[];

// Get next available time slot
function getNextTimeSlot(): string {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Round up to next 30-minute slot
  let nextHour = currentHour;
  let nextMinutes = currentMinutes < 30 ? 30 : 0;
  if (currentMinutes >= 30) nextHour++;
  
  // If before opening (12:00), default to 12:00
  if (nextHour < 12) {
    return '12:00';
  }
  
  // If after closing, default to 20:00 (for next day)
  if (nextHour >= 24) {
    return '20:00';
  }
  
  return `${nextHour.toString().padStart(2, '0')}:${nextMinutes === 0 ? '00' : '30'}`;
}

export function POSQuickReservation({ locationId, tables, onClose, onConfirm }: POSQuickReservationProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state with smart defaults
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_surname: '',
    guest_phone: '',
    party_size: 2,
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    reservation_time: getNextTimeSlot(),
  });
  
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Get table availability
  const { availableTables, loading, recommendedTable } = useTableAvailability(
    locationId,
    tables,
    formData.reservation_date,
    formData.reservation_time,
    formData.party_size
  );

  // Auto-focus name input on mount
  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 100);
  }, []);

  // Auto-select recommended table when it changes
  useEffect(() => {
    if (recommendedTable && !selectedTableId) {
      setSelectedTableId(recommendedTable.id);
    }
  }, [recommendedTable, selectedTableId]);

  // Generate date options (today + 7 days)
  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : format(date, 'EEE d', { locale: es }),
    };
  });

  const handleSubmit = async () => {
    if (!formData.guest_name.trim()) {
      toast.error('El nombre es obligatorio');
      nameInputRef.current?.focus();
      return;
    }

    if (!selectedTableId) {
      toast.error('Selecciona una mesa');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = formData.guest_surname 
        ? `${formData.guest_name.trim()} ${formData.guest_surname.trim()}`
        : formData.guest_name.trim();

      await onConfirm({
        guest_name: fullName,
        guest_phone: formData.guest_phone || null,
        party_size: formData.party_size,
        reservation_date: formData.reservation_date,
        reservation_time: formData.reservation_time,
        pos_table_id: selectedTableId,
      });

      toast.success('Reserva confirmada');
      onClose();
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Error al crear la reserva');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = formData.guest_name.trim() && selectedTableId && !isSubmitting;

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Reserva Rápida</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date/Time/Party Size Row */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <Calendar className="h-3 w-3 inline mr-1" />
              Fecha
            </Label>
            <Select
              value={formData.reservation_date}
              onValueChange={(value) => setFormData(prev => ({ ...prev, reservation_date: value }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <Clock className="h-3 w-3 inline mr-1" />
              Hora
            </Label>
            <Select
              value={formData.reservation_time}
              onValueChange={(value) => setFormData(prev => ({ ...prev, reservation_time: value }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(time => (
                  <SelectItem key={time} value={time} className="text-xs">
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <Users className="h-3 w-3 inline mr-1" />
              Pax
            </Label>
            <Select
              value={formData.party_size.toString()}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, party_size: parseInt(value) }));
                setSelectedTableId(null); // Reset table selection
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                  <SelectItem key={n} value={n.toString()} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Name Input */}
        <div>
          <Label htmlFor="guest_name" className="text-xs text-muted-foreground">
            Nombre *
          </Label>
          <Input
            ref={nameInputRef}
            id="guest_name"
            value={formData.guest_name}
            onChange={(e) => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
            placeholder="Nombre del cliente"
            className="h-10 mt-1"
            autoComplete="off"
          />
        </div>

        {/* Surname Input */}
        <div>
          <Label htmlFor="guest_surname" className="text-xs text-muted-foreground">
            Apellido
          </Label>
          <Input
            id="guest_surname"
            value={formData.guest_surname}
            onChange={(e) => setFormData(prev => ({ ...prev, guest_surname: e.target.value }))}
            placeholder="Apellido"
            className="h-10 mt-1"
            autoComplete="off"
          />
        </div>

        {/* Phone Input */}
        <div>
          <Label htmlFor="guest_phone" className="text-xs text-muted-foreground">
            Teléfono
          </Label>
          <Input
            id="guest_phone"
            type="tel"
            value={formData.guest_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, guest_phone: e.target.value }))}
            placeholder="+34 612 345 678"
            className="h-10 mt-1"
            autoComplete="off"
          />
        </div>

        {/* Table Suggestions */}
        <div className="pt-2">
          <Label className="text-xs text-muted-foreground mb-2 block">
            🪑 Mesas disponibles ({formData.party_size} pax)
          </Label>
          
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Cargando mesas...
            </div>
          ) : availableTables.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No hay mesas disponibles para {formData.party_size} personas
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableTables.map(({ table, isAvailable, hasConflict, conflictTime, capacityMatch }) => (
                <button
                  key={table.id}
                  onClick={() => isAvailable && setSelectedTableId(table.id)}
                  disabled={!isAvailable}
                  className={cn(
                    "relative p-2 rounded-lg border-2 transition-all text-center",
                    isAvailable && selectedTableId === table.id
                      ? "border-primary bg-primary/10"
                      : isAvailable
                      ? "border-border hover:border-primary/50 bg-card"
                      : "border-border bg-muted/50 opacity-60 cursor-not-allowed"
                  )}
                >
                  {selectedTableId === table.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="font-medium text-xs">{table.table_number}</div>
                  <div className="text-[10px] text-muted-foreground">{table.seats} pax</div>
                  {capacityMatch === 'exact' && isAvailable && (
                    <div className="text-[10px] text-primary">✓ Perfecto</div>
                  )}
                  {hasConflict && (
                    <div className="text-[10px] text-amber-600">
                      Ocupada {conflictTime}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        {selectedTableId && (
          <div className="text-sm text-center text-muted-foreground">
            Mesa seleccionada: <span className="font-medium text-foreground">
              {tables.find(t => t.id === selectedTableId)?.table_number}
            </span>
          </div>
        )}
        <Button 
          onClick={handleSubmit} 
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          <Check className="h-4 w-4 mr-2" />
          Confirmar Reserva
        </Button>
      </div>
    </div>
  );
}
