import { useMemo } from 'react';
import { ReservationCard } from './ReservationCard';
import type { Reservation } from '@/hooks/useReservationsModule';

interface ReservationsTimelineProps {
  reservations: Reservation[];
  timeSlots: Record<string, Reservation[]>;
  onEdit: (reservation: Reservation) => void;
  onSeat: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onComplete: (id: string) => void;
}

// Generate time slots from 12:00 to 23:30
const ALL_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 12;
  const minutes = i % 2 === 0 ? '00' : '30';
  if (hour > 23) return null;
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}).filter(Boolean) as string[];

export function ReservationsTimeline({
  reservations,
  timeSlots,
  onEdit,
  onSeat,
  onCancel,
  onNoShow,
  onComplete,
}: ReservationsTimelineProps) {
  // Only show slots that have reservations + surrounding empty slots for context
  const visibleSlots = useMemo(() => {
    if (reservations.length === 0) return ALL_SLOTS;
    const occupiedIndices = new Set<number>();
    ALL_SLOTS.forEach((slot, idx) => {
      if (timeSlots[slot] && timeSlots[slot].length > 0) {
        // Show this slot and one before/after
        if (idx > 0) occupiedIndices.add(idx - 1);
        occupiedIndices.add(idx);
        if (idx < ALL_SLOTS.length - 1) occupiedIndices.add(idx + 1);
      }
    });
    return ALL_SLOTS.filter((_, idx) => occupiedIndices.has(idx));
  }, [reservations, timeSlots]);

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Sin reservas</p>
        <p className="text-sm">No hay reservas para este día</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visibleSlots.map((slot) => {
        const slotReservations = timeSlots[slot] || [];
        const hasReservations = slotReservations.length > 0;

        return (
          <div key={slot} className="flex gap-3">
            {/* Time label */}
            <div className={`text-sm font-mono w-14 shrink-0 pt-3 text-right ${hasReservations ? 'text-foreground font-medium' : 'text-muted-foreground/50'}`}>
              {slot}
            </div>

            {/* Slot content */}
            <div className="flex-1 min-w-0">
              {hasReservations ? (
                <div className="space-y-1">
                  {slotReservations.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onEdit={onEdit}
                      onSeat={onSeat}
                      onCancel={onCancel}
                      onNoShow={onNoShow}
                      onComplete={onComplete}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-8 border-t border-dashed border-border/30" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
