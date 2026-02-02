import { useState } from 'react';
import { useReservationsModuleV2 } from '@/hooks/useReservationsModuleV2';
import { ReservationsProvider } from '@/contexts/ReservationsContext';
import { ReservationsHeader } from '@/components/reservations/ReservationsHeader';
import { ReservationsKPICards } from '@/components/reservations/ReservationsKPICards';
import { ReservationsTimeline } from '@/components/reservations/ReservationsTimeline';
import { ReservationFloorPlan } from '@/components/reservations/ReservationFloorPlan';
import { WaitlistPanel } from '@/components/reservations/WaitlistPanel';
import { CreateReservationDialog } from '@/components/reservations/CreateReservationDialog';
import { EditReservationDialog } from '@/components/reservations/EditReservationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Reservation } from '@/types/reservations';

function ReservationsContent() {
  const module = useReservationsModuleV2();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setEditingReservation(reservation);
  };

  const handleAssignTable = async (reservationId: string, tableId: string) => {
    await module.assignTable(reservationId, tableId);
    setSelectedReservation(null);
  };

  if (!module.locationId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Selecciona una ubicación para ver las reservas</p>
        </div>
      </div>
    );
  }

  if (module.loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ReservationsHeader
        selectedDate={module.selectedDate}
        onDateChange={module.setSelectedDate}
        onCreateNew={() => setCreateDialogOpen(true)}
        totalReservations={module.dayStats.totalReservations}
      />

      <ReservationsKPICards stats={module.dayStats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline - 2/3 width on desktop */}
        <div className="lg:col-span-2">
          <ReservationsTimeline
            reservations={module.reservations}
            timeSlots={module.getTimeSlots()}
            onReservationClick={handleReservationClick}
            selectedReservation={selectedReservation}
            onSeatGuests={module.seatGuests}
            onMarkNoShow={module.markNoShow}
            onCancel={module.cancelReservation}
            onConfirm={module.confirmReservation}
          />
        </div>

        {/* Floor Plan + Waitlist - 1/3 width on desktop */}
        <div className="space-y-6">
          <ReservationFloorPlan
            locationId={module.locationId}
            reservations={module.reservations}
            selectedReservation={selectedReservation}
            onAssignTable={handleAssignTable}
          />

          <WaitlistPanel
            waitlist={module.waitlist}
            onSeat={module.seatFromWaitlist}
            onRemove={module.removeFromWaitlist}
            onAdd={module.addToWaitlist}
          />
        </div>
      </div>

      {/* Create Dialog */}
      <CreateReservationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={module.createReservation}
        settings={module.settings}
        selectedDate={module.selectedDate}
      />

      {/* Edit Dialog */}
      <EditReservationDialog
        reservation={editingReservation}
        onOpenChange={(open) => !open && setEditingReservation(null)}
        onUpdate={module.updateReservation}
        onCancel={module.cancelReservation}
        onConfirm={module.confirmReservation}
        onSeat={module.seatGuests}
        onNoShow={module.markNoShow}
      />
    </div>
  );
}

export default function Reservations() {
  return (
    <ReservationsProvider>
      <ReservationsContent />
    </ReservationsProvider>
  );
}
