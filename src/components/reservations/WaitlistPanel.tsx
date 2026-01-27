import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Users, Phone, Plus, UserCheck, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WaitlistEntry } from '@/hooks/useReservationsModule';

interface WaitlistPanelProps {
  waitlist: WaitlistEntry[];
  onSeat: (id: string, tableId?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAdd: (data: { guest_name: string; guest_phone?: string; party_size: number; quoted_wait_minutes?: number; notes?: string }) => Promise<void>;
}

export function WaitlistPanel({ waitlist, onSeat, onRemove, onAdd }: WaitlistPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    party_size: '2',
    quoted_wait_minutes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guest_name || !formData.party_size) return;

    setSubmitting(true);
    try {
      await onAdd({
        guest_name: formData.guest_name,
        guest_phone: formData.guest_phone || undefined,
        party_size: parseInt(formData.party_size),
        quoted_wait_minutes: formData.quoted_wait_minutes ? parseInt(formData.quoted_wait_minutes) : undefined,
      });
      setAddDialogOpen(false);
      setFormData({ guest_name: '', guest_phone: '', party_size: '2', quoted_wait_minutes: '' });
    } catch (error) {
      console.error('Error adding to waitlist:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lista de Espera
            {waitlist.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {waitlist.length}
              </Badge>
            )}
          </CardTitle>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir a Lista de Espera</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest_name">Nombre del cliente *</Label>
                  <Input
                    id="guest_name"
                    value={formData.guest_name}
                    onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    placeholder="Nombre"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="party_size">Comensales *</Label>
                    <Input
                      id="party_size"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.party_size}
                      onChange={(e) => setFormData({ ...formData, party_size: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quoted_wait_minutes">Espera estimada (min)</Label>
                    <Input
                      id="quoted_wait_minutes"
                      type="number"
                      min="5"
                      max="120"
                      step="5"
                      value={formData.quoted_wait_minutes}
                      onChange={(e) => setFormData({ ...formData, quoted_wait_minutes: e.target.value })}
                      placeholder="15"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_phone">Teléfono</Label>
                  <Input
                    id="guest_phone"
                    type="tel"
                    value={formData.guest_phone}
                    onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                    placeholder="+34 612 345 678"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Añadiendo...' : 'Añadir'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {waitlist.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin clientes en espera</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {waitlist.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{entry.guest_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {entry.party_size} pax
                        </span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600"
                      onClick={() => onSeat(entry.id)}
                      title="Sentar"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(entry.id)}
                      title="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
