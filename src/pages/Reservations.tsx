import { useState } from 'react';
import { useReservationsModule } from '@/hooks/useReservationsModule';
import type { Reservation } from '@/hooks/useReservationsModule';
import {
  ReservationsHeader,
  ReservationsKPICards,
  ReservationsTimeline,
  CreateReservationDialog,
  ReservationFloorPlan,
} from '@/components/reservations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Reservations() {
  const {
    reservations,
    tables,
    stats,
    timeSlots,
    selectedDate,
    setSelectedDate,
    loading,
    createReservation,
    updateReservation,
    cancelReservation,
    seatGuests,
    markNoShow,
    completeReservation,
    isCreating,
    isUpdating,
  } = useReservationsModule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const handleNewReservation = () => {
    setEditingReservation(null);
    setDialogOpen(true);
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <ReservationsHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNewReservation={handleNewReservation}
      />

      {/* KPIs */}
      <ReservationsKPICards stats={stats} loading={loading} />

      {/* Main content: Timeline + Floor Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline - 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationsTimeline
              reservations={reservations}
              timeSlots={timeSlots}
              onEdit={handleEdit}
              onSeat={seatGuests}
              onCancel={cancelReservation}
              onNoShow={markNoShow}
              onComplete={completeReservation}
            />
          </CardContent>
        </Card>

        {/* Floor Plan - 1/3 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plano de Mesas</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationFloorPlan
              tables={tables}
              reservations={reservations}
            />
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <CreateReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDate}
        editingReservation={editingReservation}
        onSubmit={createReservation}
        onUpdate={updateReservation}
        isSubmitting={isCreating || isUpdating}
      />
    </div>
  );
}
