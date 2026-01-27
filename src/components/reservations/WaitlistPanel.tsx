import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Clock, Users, Phone, Calendar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistEntry {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface WaitlistPanelProps {
  locationId: string | null;
}

// Direct fetch helper to bypass type issues with new tables
async function fetchWaitlistEntries(locationId: string): Promise<WaitlistEntry[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/rest/v1/reservation_waitlist?location_id=eq.${locationId}&status=eq.waiting&order=preferred_date,created_at`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );
  
  if (!response.ok) return [];
  return response.json();
}

export function WaitlistPanel({ locationId }: WaitlistPanelProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntry, setNewEntry] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: 2,
    preferred_date: format(new Date(), 'yyyy-MM-dd'),
    preferred_time_start: '13:00',
    preferred_time_end: '15:00',
    notes: '',
  });

  useEffect(() => {
    if (locationId && locationId !== 'all') {
      fetchWaitlist();
    } else {
      setLoading(false);
    }
  }, [locationId]);

  const fetchWaitlist = async () => {
    if (!locationId || locationId === 'all') return;

    try {
      const data = await fetchWaitlistEntries(locationId);
      setEntries(data);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWaitlist = async () => {
    if (!locationId || locationId === 'all' || !newEntry.guest_name) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/reservation_waitlist`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          location_id: locationId,
          guest_name: newEntry.guest_name,
          guest_phone: newEntry.guest_phone || null,
          guest_email: newEntry.guest_email || null,
          party_size: newEntry.party_size,
          preferred_date: newEntry.preferred_date,
          preferred_time_start: newEntry.preferred_time_start,
          preferred_time_end: newEntry.preferred_time_end,
          notes: newEntry.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to add to waitlist');

      toast.success('Añadido a lista de espera');
      setShowAddDialog(false);
      setNewEntry({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        party_size: 2,
        preferred_date: format(new Date(), 'yyyy-MM-dd'),
        preferred_time_start: '13:00',
        preferred_time_end: '15:00',
        notes: '',
      });
      fetchWaitlist();
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      toast.error('Error al añadir a la lista');
    }
  };

  const convertToReservation = async (entry: WaitlistEntry) => {
    toast.info('Funcionalidad en desarrollo: convertir a reserva');
  };

  const removeFromWaitlist = async (id: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/reservation_waitlist?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'expired' }),
      });

      if (!response.ok) throw new Error('Failed to remove');
      toast.success('Eliminado de la lista');
      fetchWaitlist();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-amber-500/20 text-amber-400';
      case 'notified': return 'bg-blue-500/20 text-blue-400';
      case 'converted': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-muted';
    }
  };

  if (!locationId || locationId === 'all') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecciona un local específico para ver la lista de espera
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Lista de Espera
        </CardTitle>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {entries.length === 0 && !loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No hay clientes en lista de espera</p>
                <Button variant="link" onClick={() => setShowAddDialog(true)}>
                  Añadir el primero
                </Button>
              </div>
            ) : (
              entries.map(entry => (
                <div key={entry.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{entry.guest_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {entry.party_size}
                        </span>
                        {entry.guest_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {entry.guest_phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(entry.status)}>
                      {entry.status === 'waiting' ? 'Esperando' : entry.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(entry.preferred_date), "d 'de' MMMM", { locale: es })}</span>
                    {entry.preferred_time_start && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span>{entry.preferred_time_start} - {entry.preferred_time_end}</span>
                      </>
                    )}
                  </div>

                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                      {entry.notes}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => convertToReservation(entry)}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Convertir a Reserva
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFromWaitlist(entry.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Add to Waitlist Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir a Lista de Espera</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newEntry.guest_name}
                onChange={(e) => setNewEntry({ ...newEntry, guest_name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={newEntry.guest_phone}
                  onChange={(e) => setNewEntry({ ...newEntry, guest_phone: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <Label>Comensales</Label>
                <Select
                  value={String(newEntry.party_size)}
                  onValueChange={(v) => setNewEntry({ ...newEntry, party_size: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fecha preferida</Label>
              <Input
                type="date"
                value={newEntry.preferred_date}
                onChange={(e) => setNewEntry({ ...newEntry, preferred_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora desde</Label>
                <Input
                  type="time"
                  value={newEntry.preferred_time_start}
                  onChange={(e) => setNewEntry({ ...newEntry, preferred_time_start: e.target.value })}
                />
              </div>
              <div>
                <Label>Hora hasta</Label>
                <Input
                  type="time"
                  value={newEntry.preferred_time_end}
                  onChange={(e) => setNewEntry({ ...newEntry, preferred_time_end: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addToWaitlist} disabled={!newEntry.guest_name}>
                Añadir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
