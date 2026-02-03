/**
 * POS Floor Map
 * Mapa de mesas con covers selector integrado
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { usePOSData } from '@/hooks/usePOSData';
import { POSSession } from '@/lib/pos/session';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut } from 'lucide-react';
import { CoversSelector } from '@/components/pos/CoversSelector';
import { FaceUnlockModal } from '@/components/pos/FaceUnlockModal';
import { POSFloorPlan } from '@/components/pos/POSFloorPlan';
import { supabase } from '@/integrations/supabase/client';

export default function POSFloorMap() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { locations } = useApp();
  const { floorMaps, tables, products, refetch } = usePOSData(locationId || '');
  
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [showCoversSelector, setShowCoversSelector] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const location = locations.find(l => l.id === locationId);
  const session = POSSession.get();

  const handleTableClick = async (table: any) => {
    if (table.status === 'occupied' && table.current_ticket_id) {
      // Mesa ya ocupada, ir directo
      navigate(`/pos/${locationId}/table/${table.id}`);
    } else {
      // Mesa disponible, pedir covers
      setSelectedTable(table);
      setShowCoversSelector(true);
    }
  };

  const handleCoversConfirm = async (covers: number) => {
    if (!selectedTable || !session) return;

    try {
      // Crear ticket nuevo
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          location_id: locationId,
          pos_table_id: selectedTable.id,
          server_id: session.staff_id,
          created_by_staff_id: session.staff_id,
          status: 'open',
          covers,
          service_type: 'dine_in',
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar estado de mesa
      await supabase
        .from('pos_tables')
        .update({
          status: 'occupied',
          current_ticket_id: ticket.id,
        })
        .eq('id', selectedTable.id);

      // Navegar a order screen
      navigate(`/pos/${locationId}/table/${selectedTable.id}`);
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    POSSession.end();
    navigate(`/pos/${locationId}/login`);
  };

  if (!session) {
    navigate(`/pos/${locationId}/login`);
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{location?.name}</h1>
            <p className="text-sm text-muted-foreground">{session.staff_name}</p>
          </div>
        </div>

        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </Button>
      </header>

      {/* Floor Plan */}
      <div className="flex-1 overflow-auto p-6">
        <POSFloorPlan
          locationId={locationId!}
          floorMaps={floorMaps}
          tables={tables}
          products={products}
          openTickets={[]}
          onRefresh={refetch}
          onTableClick={handleTableClick}
          hideReservationButtons={true}
        />
      </div>

      {/* Covers Selector */}
      {selectedTable && (
        <CoversSelector
          open={showCoversSelector}
          tableName={selectedTable.table_number}
          onConfirm={handleCoversConfirm}
          onCancel={() => {
            setShowCoversSelector(false);
            setSelectedTable(null);
          }}
        />
      )}

      {/* Logout Confirmation */}
      {session && (
        <FaceUnlockModal
          open={showLogoutConfirm}
          staffName={session.staff_name}
          onSuccess={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
