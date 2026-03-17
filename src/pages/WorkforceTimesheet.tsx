import { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    Calendar,
    ChevronLeft,
    ChevronRight,
    MapPin,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Download,
    Filter,
    MoreHorizontal,
    Edit,
    Timer,
    Repeat,
    ArrowRightLeft,
    FileText,
} from 'lucide-react';
import {
    format,
    startOfWeek,
    endOfWeek,
    addWeeks,
    subWeeks,
    differenceInMinutes,
    parseISO,
    isToday,
    eachDayOfInterval,
    isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────
interface TimesheetRecord {
    id: string;
    employee_id: string;
    clock_in: string;
    clock_out: string | null;
    location_id: string;
    source: string;
    employee_name: string;
    employee_role: string | null;
    location_name: string;
    hourly_cost: number | null;
}

interface PlannedShift {
    id: string;
    employee_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    planned_hours: number;
    role: string;
    status: string;
}

interface SwapRequest {
    id: string;
    requester_id: string;
    target_id: string;
    requester_shift_id: string;
    target_shift_id: string | null;
    status: string;
    reason: string;
    created_at: string;
    requester_name?: string;
    target_name?: string;
    requester_shift?: PlannedShift;
    target_shift?: PlannedShift;
}

// ─── Helpers ────────────────────────────────────────────
const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];
const getAvatarColor = (name: string) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const getRoleBadgeColor = (role: string | null) => {
    if (!role) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (['owner', 'admin', 'ops_manager'].includes(role))
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    if (['store_manager', 'manager'].includes(role))
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (['cook', 'dishwasher'].includes(role))
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
};

const ROLE_LABELS: Record<string, string> = {
    owner: 'Propietario', admin: 'Administrador', ops_manager: 'Gerente Ops',
    store_manager: 'Gerente Local', manager: 'Encargado/a', waiter: 'Camarero/a',
    cook: 'Cocinero/a', bartender: 'Barista', host: 'Hostess',
    dishwasher: 'Friegaplatos', delivery: 'Repartidor/a', employee: 'Empleado',
};

// ─── Main Component ─────────────────────────────────────
export default function WorkforceTimesheet() {
    const { accessibleLocations, selectedLocationId } = useApp();
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [records, setRecords] = useState<TimesheetRecord[]>([]);
    const [shifts, setShifts] = useState<PlannedShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [locationFilter, setLocationFilter] = useState('all');
    const [editRecord, setEditRecord] = useState<TimesheetRecord | null>(null);
    const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', notes: '' });

    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // ─── Data fetch ───
    useEffect(() => {
        fetchData();
    }, [weekStart, selectedLocationId]);

    const fetchData = async () => {
        setLoading(true);
        const locationIds = selectedLocationId === 'all'
            ? accessibleLocations.map((l) => l.id)
            : [selectedLocationId];

        // Fetch clock records (table may not exist yet — graceful fallback)
        let clockData: any[] | null = null;
        try {
            const res = await (supabase as any)
                .from('employee_clock_records')
                .select('id, employee_id, clock_in, clock_out, location_id, source')
                .in('location_id', locationIds)
                .gte('clock_in', weekStart.toISOString())
                .lte('clock_in', weekEnd.toISOString())
                .order('clock_in', { ascending: false });
            clockData = res.data;
        } catch { /* table does not exist yet */ }

        // Fetch planned shifts
        const { data: shiftData } = await supabase
            .from('planned_shifts')
            .select('id, employee_id, shift_date, start_time, end_time, planned_hours, role, status')
            .in('location_id', locationIds)
            .gte('shift_date', format(weekStart, 'yyyy-MM-dd'))
            .lte('shift_date', format(weekEnd, 'yyyy-MM-dd'));

        if (shiftData) setShifts(shiftData);

        if (clockData) {
            // Enrich with employee info
            const empIds = [...new Set(clockData.map((r) => r.employee_id))];
            const { data: emps } = await supabase
                .from('employees')
                .select('id, full_name, role_name, hourly_cost')
                .in('id', empIds);

            const empMap = new Map(emps?.map((e) => [e.id, e]) || []);
            setRecords(
                clockData.map((r) => ({
                    ...r,
                    employee_name: empMap.get(r.employee_id)?.full_name || 'Desconocido',
                    employee_role: empMap.get(r.employee_id)?.role_name || null,
                    location_name: accessibleLocations.find((l) => l.id === r.location_id)?.name || '',
                    hourly_cost: empMap.get(r.employee_id)?.hourly_cost || null,
                }))
            );
        }
        setLoading(false);
    };

    // ─── Filter ───
    const filteredRecords = useMemo(() => {
        if (locationFilter === 'all') return records;
        return records.filter((r) => r.location_id === locationFilter);
    }, [records, locationFilter]);

    // ─── Stats ───
    const stats = useMemo(() => {
        let totalMinutes = 0;
        let totalCost = 0;
        let incompleteCount = 0;
        let lateCount = 0;

        filteredRecords.forEach((r) => {
            if (!r.clock_out) {
                incompleteCount++;
                return;
            }
            const mins = differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in));
            totalMinutes += mins;
            if (r.hourly_cost) totalCost += (mins / 60) * r.hourly_cost;
        });

        // Check late arrivals
        filteredRecords.forEach((r) => {
            const shift = shifts.find(
                (s) =>
                    s.employee_id === r.employee_id &&
                    s.shift_date === format(new Date(r.clock_in), 'yyyy-MM-dd')
            );
            if (shift) {
                const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`);
                const clockedIn = new Date(r.clock_in);
                if (differenceInMinutes(clockedIn, shiftStart) > 10) lateCount++;
            }
        });

        return {
            totalHours: (totalMinutes / 60).toFixed(1),
            totalCost: totalCost.toFixed(0),
            records: filteredRecords.length,
            incomplete: incompleteCount,
            late: lateCount,
            plannedHours: shifts
                .filter((s) => locationFilter === 'all' || s.employee_id)
                .reduce((sum, s) => sum + (s.planned_hours || 0), 0)
                .toFixed(1),
        };
    }, [filteredRecords, shifts]);

    // ─── Group by employee ───
    const byEmployee = useMemo(() => {
        const map = new Map<string, TimesheetRecord[]>();
        filteredRecords.forEach((r) => {
            const list = map.get(r.employee_id) || [];
            list.push(r);
            map.set(r.employee_id, list);
        });
        return Array.from(map.entries()).map(([empId, recs]) => ({
            employee_id: empId,
            employee_name: recs[0].employee_name,
            employee_role: recs[0].employee_role,
            hourly_cost: recs[0].hourly_cost,
            location_name: recs[0].location_name,
            records: recs,
            totalMinutes: recs.reduce((sum, r) => {
                if (!r.clock_out) return sum;
                return sum + differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in));
            }, 0),
            cost: recs.reduce((sum, r) => {
                if (!r.clock_out || !recs[0].hourly_cost) return sum;
                const mins = differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in));
                return sum + (mins / 60) * (recs[0].hourly_cost || 0);
            }, 0),
        }));
    }, [filteredRecords]);

    // ─── Edit clock record ───
    const handleEditRecord = async () => {
        if (!editRecord) return;
        const updates: any = {};
        if (editForm.clock_in) updates.clock_in = new Date(editForm.clock_in).toISOString();
        if (editForm.clock_out) updates.clock_out = new Date(editForm.clock_out).toISOString();

        const { error } = await (supabase as any)
            .from('employee_clock_records')
            .update(updates)
            .eq('id', editRecord.id);

        if (error) {
            toast.error('Error al actualizar fichaje');
        } else {
            toast.success('Fichaje actualizado');
            setEditRecord(null);
            fetchData();
        }
    };

    const handleDeleteRecord = async (id: string) => {
        const { error } = await (supabase as any)
            .from('employee_clock_records')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Error al eliminar');
        } else {
            toast.success('Fichaje eliminado');
            fetchData();
        }
    };

    const openEditRecord = (r: TimesheetRecord) => {
        setEditForm({
            clock_in: format(new Date(r.clock_in), "yyyy-MM-dd'T'HH:mm"),
            clock_out: r.clock_out ? format(new Date(r.clock_out), "yyyy-MM-dd'T'HH:mm") : '',
            notes: '',
        });
        setEditRecord(r);
    };

    // ─── Render ───────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Timesheet
                    </h1>
                    <p className="text-muted-foreground">Revisión y control de fichajes</p>
                </div>
                <div className="flex items-center gap-2">
                    {accessibleLocations.length > 1 && (
                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los locales</SelectItem>
                                {accessibleLocations.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                    <p className="font-semibold">
                        {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {isToday(weekStart) || (weekStart <= new Date() && new Date() <= weekEnd)
                            ? 'Semana actual'
                            : format(weekStart, "'Semana del' d 'de' MMMM", { locale: es })}
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Horas reales
                        </p>
                        <p className="text-2xl font-bold mt-1">{stats.totalHours}h</p>
                        <p className="text-xs text-muted-foreground">
                            Planificado: {stats.plannedHours}h
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Coste laboral</p>
                        <p className="text-2xl font-bold mt-1">{stats.totalCost}€</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Fichajes</p>
                        <p className="text-2xl font-bold mt-1">{stats.records}</p>
                    </CardContent>
                </Card>
                <Card className={stats.incomplete > 0 ? 'border-amber-500/50' : ''}>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" /> Incompletos
                        </p>
                        <p className="text-2xl font-bold mt-1">{stats.incomplete}</p>
                    </CardContent>
                </Card>
                <Card className={stats.late > 0 ? 'border-red-500/50' : ''}>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" /> Retrasos
                        </p>
                        <p className="text-2xl font-bold mt-1">{stats.late}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="byEmployee">
                <TabsList>
                    <TabsTrigger value="byEmployee" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        Por empleado
                    </TabsTrigger>
                    <TabsTrigger value="allRecords" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Todos los fichajes
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Alertas
                        {(parseInt(String(stats.incomplete)) + parseInt(String(stats.late))) > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                                {parseInt(String(stats.incomplete)) + parseInt(String(stats.late))}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ═══ BY EMPLOYEE ═══ */}
                <TabsContent value="byEmployee" className="space-y-3 mt-4">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <Card key={i}><CardContent className="p-4"><div className="animate-pulse h-16 bg-muted rounded" /></CardContent></Card>
                        ))
                    ) : byEmployee.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-lg font-medium text-muted-foreground">Sin fichajes esta semana</p>
                            </CardContent>
                        </Card>
                    ) : (
                        byEmployee.map((emp) => {
                            const hours = Math.floor(emp.totalMinutes / 60);
                            const mins = emp.totalMinutes % 60;
                            return (
                                <Card key={emp.employee_id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarFallback className={cn(getAvatarColor(emp.employee_name), 'text-white text-sm font-semibold')}>
                                                    {getInitials(emp.employee_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{emp.employee_name}</p>
                                                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full', getRoleBadgeColor(emp.employee_role))}>
                                                        {ROLE_LABELS[emp.employee_role || ''] || 'Empleado'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{emp.location_name}</span>
                                                    <span>{emp.records.length} fichajes</span>
                                                    {emp.hourly_cost && <span>{emp.hourly_cost.toFixed(2)}€/h</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold">{hours}h {mins}m</p>
                                                {emp.hourly_cost && (
                                                    <p className="text-sm text-muted-foreground">{emp.cost.toFixed(0)}€</p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Day-by-day breakdown */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {weekDays.map((day) => {
                                                const dayRecords = emp.records.filter((r) =>
                                                    isSameDay(new Date(r.clock_in), day)
                                                );
                                                const dayMinutes = dayRecords.reduce((sum, r) => {
                                                    if (!r.clock_out) return sum;
                                                    return sum + differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in));
                                                }, 0);
                                                const hasIncomplete = dayRecords.some((r) => !r.clock_out);
                                                return (
                                                    <div
                                                        key={day.toISOString()}
                                                        className={cn(
                                                            'text-center p-2 rounded-lg text-xs',
                                                            isToday(day) && 'ring-2 ring-primary/30',
                                                            dayRecords.length > 0
                                                                ? hasIncomplete
                                                                    ? 'bg-amber-500/10'
                                                                    : 'bg-emerald-500/10'
                                                                : 'bg-muted/30'
                                                        )}
                                                    >
                                                        <p className="font-medium text-muted-foreground">
                                                            {format(day, 'EEE', { locale: es })}
                                                        </p>
                                                        <p className="font-bold text-sm">
                                                            {dayRecords.length > 0
                                                                ? `${Math.floor(dayMinutes / 60)}h${dayMinutes % 60 > 0 ? ` ${dayMinutes % 60}m` : ''}`
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>

                {/* ═══ ALL RECORDS ═══ */}
                <TabsContent value="allRecords" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Empleado</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Entrada</TableHead>
                                        <TableHead>Salida</TableHead>
                                        <TableHead className="text-right">Duración</TableHead>
                                        <TableHead className="text-right">Coste</TableHead>
                                        <TableHead>Fuente</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={8}><div className="animate-pulse h-8 bg-muted rounded" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredRecords.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                                Sin fichajes esta semana
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRecords.map((r) => {
                                            const duration = r.clock_out
                                                ? differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in))
                                                : null;
                                            const cost = duration && r.hourly_cost
                                                ? ((duration / 60) * r.hourly_cost).toFixed(2)
                                                : null;
                                            return (
                                                <TableRow key={r.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarFallback className={cn(getAvatarColor(r.employee_name), 'text-white text-[10px] font-semibold')}>
                                                                    {getInitials(r.employee_name)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm font-medium">{r.employee_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {format(new Date(r.clock_in), 'dd/MM/yy')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {format(new Date(r.clock_in), 'HH:mm')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : (
                                                            <Badge variant="outline" className="text-amber-600 border-amber-300">Activo</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm">
                                                        {duration ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm">
                                                        {cost ? `${cost}€` : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {r.source === 'geo' ? '📍 GPS' : r.source === 'manual' ? '✍️ Manual' : r.source}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => openEditRecord(r)}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => handleDeleteRecord(r.id)}
                                                                >
                                                                    <XCircle className="mr-2 h-4 w-4" /> Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══ ALERTS ═══ */}
                <TabsContent value="alerts" className="space-y-3 mt-4">
                    {/* Incomplete records */}
                    {filteredRecords.filter((r) => !r.clock_out).length > 0 && (
                        <Card className="border-l-4 border-l-amber-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    Fichajes sin salida ({filteredRecords.filter((r) => !r.clock_out).length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {filteredRecords.filter((r) => !r.clock_out).map((r) => (
                                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className={cn(getAvatarColor(r.employee_name), 'text-white text-[10px]')}>
                                                    {getInitials(r.employee_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium">{r.employee_name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Entrada: {format(new Date(r.clock_in), 'dd/MM HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => openEditRecord(r)}>
                                            Corregir
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Late arrivals */}
                    {(() => {
                        const lateRecords = filteredRecords.filter((r) => {
                            const shift = shifts.find(
                                (s) =>
                                    s.employee_id === r.employee_id &&
                                    s.shift_date === format(new Date(r.clock_in), 'yyyy-MM-dd')
                            );
                            if (!shift) return false;
                            const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`);
                            return differenceInMinutes(new Date(r.clock_in), shiftStart) > 10;
                        });

                        if (lateRecords.length === 0) return null;

                        return (
                            <Card className="border-l-4 border-l-red-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        Retrasos ({lateRecords.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {lateRecords.map((r) => {
                                        const shift = shifts.find(
                                            (s) =>
                                                s.employee_id === r.employee_id &&
                                                s.shift_date === format(new Date(r.clock_in), 'yyyy-MM-dd')
                                        );
                                        const late = shift
                                            ? differenceInMinutes(new Date(r.clock_in), new Date(`${shift.shift_date}T${shift.start_time}`))
                                            : 0;
                                        return (
                                            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className={cn(getAvatarColor(r.employee_name), 'text-white text-[10px]')}>
                                                            {getInitials(r.employee_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">{r.employee_name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Turno: {shift?.start_time?.slice(0, 5)} · Entrada: {format(new Date(r.clock_in), 'HH:mm')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant="destructive">{late} min tarde</Badge>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        );
                    })()}

                    {parseInt(String(stats.incomplete)) === 0 && parseInt(String(stats.late)) === 0 && (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mx-auto mb-3" />
                                <p className="text-lg font-medium text-muted-foreground">Todo en orden</p>
                                <p className="text-sm text-muted-foreground/60">No hay alertas esta semana</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* ═══ EDIT CLOCK RECORD DIALOG ═══ */}
            <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Editar fichaje — {editRecord?.employee_name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Hora de entrada</Label>
                            <Input
                                type="datetime-local"
                                value={editForm.clock_in}
                                onChange={(e) => setEditForm((f) => ({ ...f, clock_in: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Hora de salida</Label>
                            <Input
                                type="datetime-local"
                                value={editForm.clock_out}
                                onChange={(e) => setEditForm((f) => ({ ...f, clock_out: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditRecord(null)}>Cancelar</Button>
                        <Button onClick={handleEditRecord}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
