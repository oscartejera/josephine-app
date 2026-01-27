import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/hooks/useReservationsModule';

interface Table {
  id: string;
  table_number: string;
  seats: number;
  floor_map_id: string;
  status: string;
  position_x: number;
  position_y: number;
  shape: string;
}

interface FloorMap {
  id: string;
  name: string;
  location_id: string;
}

interface ReservationFloorPlanProps {
  locationId: string;
  reservations: Reservation[];
  selectedReservation: Reservation | null;
  onAssignTable: (reservationId: string, tableId: string) => Promise<void>;
}

export function ReservationFloorPlan({
  locationId,
  reservations,
  selectedReservation,
  onAssignTable,
}: ReservationFloorPlanProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [floorMaps, setFloorMaps] = useState<FloorMap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      setLoading(true);
      
      // First get floor maps for this location
      const { data: maps, error: mapsError } = await supabase
        .from('pos_floor_maps')
        .select('id, name, location_id')
        .eq('location_id', locationId);

      if (mapsError) {
        console.error('Error fetching floor maps:', mapsError);
        setLoading(false);
        return;
      }

      setFloorMaps(maps || []);

      if (!maps || maps.length === 0) {
        setTables([]);
        setLoading(false);
        return;
      }

      // Then get tables for those floor maps
      const floorMapIds = maps.map(m => m.id);
      const { data, error } = await supabase
        .from('pos_tables')
        .select('*')
        .in('floor_map_id', floorMapIds)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('Error fetching tables:', error);
      } else {
        setTables((data || []) as Table[]);
      }
      setLoading(false);
    };

    fetchTables();
  }, [locationId]);

  // Map reservations to tables
  const tableReservations = new Map<string, Reservation>();
  reservations.forEach((res) => {
    if (res.pos_table_id && (res.status === 'confirmed' || res.status === 'seated')) {
      tableReservations.set(res.pos_table_id, res);
    }
  });

  const handleTableClick = async (table: Table) => {
    if (!selectedReservation) return;
    
    // Don't assign if table is already occupied
    if (tableReservations.has(table.id)) return;
    
    // Check capacity
    if (table.seats < selectedReservation.party_size) return;

    await onAssignTable(selectedReservation.id, table.id);
  };

  const getTableStatus = (table: Table) => {
    const reservation = tableReservations.get(table.id);
    if (!reservation) return 'available';
    return reservation.status;
  };

  const getTableColor = (status: string, isSelectable: boolean) => {
    if (isSelectable) return 'border-primary bg-primary/10';
    switch (status) {
      case 'seated':
        return 'bg-green-500/20 border-green-500';
      case 'confirmed':
        return 'bg-blue-500/20 border-blue-500';
      case 'available':
        return 'bg-muted border-border hover:border-primary/50';
      default:
        return 'bg-muted border-border';
    }
  };

  // Group tables by floor map
  const tablesByFloor = tables.reduce<Record<string, Table[]>>((acc, table) => {
    const floorId = table.floor_map_id;
    if (!acc[floorId]) acc[floorId] = [];
    acc[floorId].push(table);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Plano de Mesas
        </CardTitle>
        {selectedReservation && (
          <p className="text-sm text-muted-foreground">
            Selecciona una mesa para <strong>{selectedReservation.guest_name}</strong> ({selectedReservation.party_size} pax)
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay mesas configuradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(tablesByFloor).map(([floorId, floorTables]) => {
                const floorMap = floorMaps.find(f => f.id === floorId);
                return (
                  <div key={floorId}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {floorMap?.name || 'Principal'}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {floorTables.map((table) => {
                        const status = getTableStatus(table);
                        const reservation = tableReservations.get(table.id);
                        const isAvailable = status === 'available';
                        const isSelectable =
                          selectedReservation &&
                          isAvailable &&
                          table.seats >= selectedReservation.party_size;

                        return (
                          <button
                            key={table.id}
                            onClick={() => handleTableClick(table)}
                            disabled={!isSelectable && selectedReservation !== null}
                            className={cn(
                              'relative p-2 rounded-lg border-2 text-center transition-all',
                              getTableColor(status, !!isSelectable),
                              isSelectable && 'cursor-pointer hover:scale-105',
                              !isSelectable && selectedReservation && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <p className="font-bold text-sm">{table.table_number}</p>
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {table.seats}
                            </div>
                            {reservation && (
                              <Badge
                                variant="outline"
                                className="absolute -top-2 -right-2 text-[10px] px-1.5"
                              >
                                {reservation.guest_name.split(' ')[0]}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted border" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500/20 border-blue-500 border" />
            <span>Reservada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/20 border-green-500 border" />
            <span>Ocupada</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
