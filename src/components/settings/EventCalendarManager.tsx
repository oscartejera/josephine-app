/**
 * EventCalendarManager — Manage dynamic events for forecast impact
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Plus, Trophy, Music, Landmark, Sun, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarEvent {
    id: string;
    event_date: string;
    name: string;
    event_type: string;
    impact_multiplier: number;
    recurrence: string;
    city: string | null;
    source: string;
    is_active: boolean;
}

const EVENT_TYPES = [
    { value: 'holiday', label: 'Festivo', icon: Landmark, color: 'bg-red-100 text-red-700' },
    { value: 'sports', label: 'Deportes', icon: Trophy, color: 'bg-blue-100 text-blue-700' },
    { value: 'concert', label: 'Concierto', icon: Music, color: 'bg-purple-100 text-purple-700' },
    { value: 'festival', label: 'Festival', icon: Star, color: 'bg-amber-100 text-amber-700' },
    { value: 'local', label: 'Evento Local', icon: CalendarDays, color: 'bg-green-100 text-green-700' },
    { value: 'weather', label: 'Clima', icon: Sun, color: 'bg-cyan-100 text-cyan-700' },
    { value: 'custom', label: 'Custom', icon: CalendarDays, color: 'bg-gray-100 text-gray-700' },
];

export function EventCalendarManager({ locationId }: { locationId: string | null }) {
    const { group } = useApp();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventType, setEventType] = useState('local');
    const [impactMultiplier, setImpactMultiplier] = useState('1.0');
    const [city, setCity] = useState('');
    const [recurrence, setRecurrence] = useState('none');

    const loadEvents = useCallback(async () => {
        if (!group?.id) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('event_calendar')
                .select('*')
                .eq('is_active', true)
                .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
                .order('event_date')
                .limit(100);
            setEvents(data || []);
        } catch (err) {
            console.error('Events load error:', err);
        } finally {
            setLoading(false);
        }
    }, [group?.id]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    const handleSubmit = async () => {
        if (!eventName.trim() || !eventDate || !group?.id) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('event_calendar').insert({
                org_id: group.id,
                location_id: locationId || null,
                event_date: eventDate,
                name: eventName.trim(),
                event_type: eventType,
                impact_multiplier: parseFloat(impactMultiplier) || 1.0,
                recurrence,
                city: city.trim() || null,
                source: 'manual',
            });
            if (error) throw error;
            toast.success('Evento añadido');
            setDialogOpen(false);
            resetForm();
            loadEvents();
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const deleteEvent = async (id: string) => {
        await supabase.from('event_calendar').update({ is_active: false }).eq('id', id);
        loadEvents();
        toast.success('Evento eliminado');
    };

    const resetForm = () => {
        setEventName('');
        setEventDate('');
        setEventType('local');
        setImpactMultiplier('1.0');
        setCity('');
        setRecurrence('none');
    };

    // Impact color
    const getImpactColor = (m: number) => {
        if (m >= 1.2) return 'text-green-600';
        if (m <= 0.8) return 'text-red-600';
        return 'text-muted-foreground';
    };

    const getImpactLabel = (m: number) => {
        if (m >= 1.2) return `+${Math.round((m - 1) * 100)}%`;
        if (m <= 0.95) return `${Math.round((m - 1) * 100)}%`;
        return 'Normal';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Calendario de Eventos</h3>
                    <Badge variant="outline">{events.length} próximos</Badge>
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir Evento
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">
                Los eventos afectan automáticamente al forecast de ventas. Un impacto de +20% significa que se espera un 20% más de ventas ese día.
            </p>

            {/* Events list */}
            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando eventos...</div>
            ) : events.length === 0 ? (
                <Card><CardContent className="py-8 text-center">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-muted-foreground">Sin eventos próximos</p>
                </CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {events.map(event => {
                        const typeInfo = EVENT_TYPES.find(t => t.value === event.event_type);
                        const TypeIcon = typeInfo?.icon || CalendarDays;
                        return (
                            <Card key={event.id}>
                                <CardContent className="py-2 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-full p-1.5 ${typeInfo?.color || 'bg-gray-100'}`}>
                                            <TypeIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{event.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(event.event_date), "d MMM yyyy", { locale: es })}
                                                {event.city && ` · ${event.city}`}
                                                {event.recurrence !== 'none' && ` · ${event.recurrence === 'yearly' ? 'Anual' : event.recurrence}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium ${getImpactColor(Number(event.impact_multiplier))}`}>
                                            {getImpactLabel(Number(event.impact_multiplier))}
                                        </span>
                                        {event.source === 'manual' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEvent(event.id)}>
                                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Nuevo Evento</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input placeholder="Nombre del evento" value={eventName} onChange={e => setEventName(e.target.value)} />
                        <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                        <Select value={eventType} onValueChange={setEventType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Impacto en ventas</label>
                                <Select value={impactMultiplier} onValueChange={setImpactMultiplier}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.50">-50% (cerrado/mínimo)</SelectItem>
                                        <SelectItem value="0.70">-30%</SelectItem>
                                        <SelectItem value="0.80">-20%</SelectItem>
                                        <SelectItem value="0.90">-10%</SelectItem>
                                        <SelectItem value="1.00">Normal (0%)</SelectItem>
                                        <SelectItem value="1.10">+10%</SelectItem>
                                        <SelectItem value="1.20">+20%</SelectItem>
                                        <SelectItem value="1.30">+30%</SelectItem>
                                        <SelectItem value="1.40">+40%</SelectItem>
                                        <SelectItem value="1.50">+50%</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Recurrencia</label>
                                <Select value={recurrence} onValueChange={setRecurrence}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Una vez</SelectItem>
                                        <SelectItem value="weekly">Semanal</SelectItem>
                                        <SelectItem value="monthly">Mensual</SelectItem>
                                        <SelectItem value="yearly">Anual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Input placeholder="Ciudad (opcional)" value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={submitting || !eventName.trim() || !eventDate}>
                            {submitting ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
