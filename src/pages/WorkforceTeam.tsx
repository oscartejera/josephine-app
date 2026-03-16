import { useState, useEffect, useMemo } from 'react';
import { ManagerLogbook } from '@/components/workforce/ManagerLogbook';
import { EmployeeReviews } from '@/components/workforce/EmployeeReviews';
import { TrainingTracker } from '@/components/workforce/TrainingTracker';
import { EmploymentContracts } from '@/components/workforce/EmploymentContracts';
import {
    Users,
    UserPlus,
    Search,
    MapPin,
    Clock,
    Megaphone,
    MoreHorizontal,
    Filter,
    CheckCircle2,
    XCircle,
    Timer,
    AlertCircle,
    Pin,
    Trash2,
    Edit,
    Plus,
    RefreshCw,
    BookOpen,
    TrendingUp,
    GraduationCap,
    FileText,
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────
interface Employee {
    id: string;
    full_name: string;
    role_name: string | null;
    location_id: string;
    hourly_cost: number | null;
    active: boolean;
    user_id: string | null;
    location_name?: string;
}

interface ClockRecord {
    id: string;
    employee_id: string;
    clock_in: string;
    clock_out: string | null;
    location_id: string;
    employee_name?: string;
    employee_role?: string;
    location_name?: string;
}

interface Announcement {
    id: string;
    title: string;
    body: string;
    type: string;
    pinned: boolean;
    location_id: string | null;
    created_at: string;
}

interface LocationOption {
    id: string;
    name: string;
}

// ─── Helpers ────────────────────────────────────────────
const ROLE_OPTIONS = [
    { value: 'owner', label: 'Propietario' },
    { value: 'admin', label: 'Administrador' },
    { value: 'ops_manager', label: 'Gerente Operaciones' },
    { value: 'store_manager', label: 'Gerente Local' },
    { value: 'manager', label: 'Encargado/a' },
    { value: 'waiter', label: 'Camarero/a' },
    { value: 'cook', label: 'Cocinero/a' },
    { value: 'bartender', label: 'Barista' },
    { value: 'host', label: 'Hostess' },
    { value: 'dishwasher', label: 'Friegaplatos' },
    { value: 'delivery', label: 'Repartidor/a' },
    { value: 'employee', label: 'Empleado' },
];

const getRoleLabel = (role: string | null) => {
    const found = ROLE_OPTIONS.find((r) => r.value === role);
    return found ? found.label : role || 'Empleado';
};

const getRoleBadgeColor = (role: string | null) => {
    if (!role) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (['owner', 'admin', 'ops_manager'].includes(role))
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    if (['store_manager', 'manager'].includes(role))
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (['cook', 'dishwasher'].includes(role))
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    if (['waiter', 'host', 'bartender'].includes(role))
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const getInitials = (name: string) =>
    name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];
const getAvatarColor = (name: string) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// ─── Main Component ─────────────────────────────────────
export default function WorkforceTeam() {
  const { t } = useTranslation();
    const { accessibleLocations, selectedLocationId } = useApp();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [clockedIn, setClockedIn] = useState<ClockRecord[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
    const [showInactive, setShowInactive] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Modals
    const [addOpen, setAddOpen] = useState(false);
    const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
    const [announcementOpen, setAnnouncementOpen] = useState(false);

    // Form state
    const [form, setForm] = useState({
        full_name: '',
        role_name: 'employee',
        location_id: '',
        hourly_cost: '',
    });
    const [announcementForm, setAnnouncementForm] = useState({
        title: '',
        body: '',
        type: 'info',
        pinned: false,
        location_id: '',
    });
    const [saving, setSaving] = useState(false);

    // Live clock
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch data
    useEffect(() => {
        fetchAll();
    }, [selectedLocationId]);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchEmployees(), fetchClockedIn(), fetchAnnouncements(), fetchLocations()]);
        setLoading(false);
    };

    const fetchEmployees = async () => {
        const locationIds = accessibleLocations.map((l) => l.id);
        let query = supabase
            .from('employees')
            .select('id, full_name, role_name, location_id, hourly_cost, active, user_id')
            .in('location_id', locationIds)
            .order('full_name');

        const { data } = await query;
        if (data) {
            const withLocation = data.map((e) => ({
                ...e,
                location_name: accessibleLocations.find((l) => l.id === e.location_id)?.name || 'Desconocido',
            }));
            setEmployees(withLocation);
        }
    };

    const fetchClockedIn = async () => {
        const locationIds = accessibleLocations.map((l) => l.id);
        const { data } = await (supabase as any)
            .from('employee_clock_records')
            .select('id, employee_id, clock_in, clock_out, location_id')
            .in('location_id', locationIds)
            .is('clock_out', null)
            .order('clock_in', { ascending: false });

        if (data) {
            // Enrich with employee names
            const employeeIds = [...new Set(data.map((r) => r.employee_id))];
            const { data: emps } = await supabase
                .from('employees')
                .select('id, full_name, role_name')
                .in('id', employeeIds);

            const empMap = new Map(emps?.map((e) => [e.id, e]) || []);
            setClockedIn(
                data.map((r) => ({
                    ...r,
                    employee_name: empMap.get(r.employee_id)?.full_name || 'Desconocido',
                    employee_role: empMap.get(r.employee_id)?.role_name || null,
                    location_name: accessibleLocations.find((l) => l.id === r.location_id)?.name || '',
                }))
            );
        }
    };

    const fetchAnnouncements = async () => {
        const { data } = await supabase
            .from('announcements')
            .select('id, title, body, type, pinned, location_id, created_at')
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50);

        setAnnouncements(data || []);
    };

    const fetchLocations = async () => {
        setLocations(accessibleLocations.map((l) => ({ id: l.id, name: l.name })));
        // Get org_id from first location for announcements
        if (accessibleLocations.length > 0 && !orgId) {
            const { data } = await supabase
                .from('locations')
                .select('org_id')
                .eq('id', accessibleLocations[0].id)
                .single();
            if (data?.org_id) setOrgId(data.org_id);
        }
    };

    // ─── Filtered employees ───
    const filteredEmployees = useMemo(() => {
        return employees.filter((e) => {
            if (!showInactive && !e.active) return false;
            if (search && !e.full_name.toLowerCase().includes(search.toLowerCase())) return false;
            if (roleFilter !== 'all' && e.role_name !== roleFilter) return false;
            if (locationFilter !== 'all' && e.location_id !== locationFilter) return false;
            if (selectedLocationId !== 'all' && e.location_id !== selectedLocationId) return false;
            return true;
        });
    }, [employees, search, roleFilter, locationFilter, showInactive, selectedLocationId]);

    const activeCount = employees.filter((e) => e.active).length;

    // ─── Add Employee ───
    const handleAddEmployee = async () => {
        if (!form.full_name.trim() || !form.location_id) {
            toast.error('Nombre y local son obligatorios');
            return;
        }
        setSaving(true);
        const { error } = await supabase.from('employees').insert({
            full_name: form.full_name.trim(),
            role_name: form.role_name,
            location_id: form.location_id,
            hourly_cost: form.hourly_cost ? parseFloat(form.hourly_cost) : null,
            active: true,
        });
        if (error) {
            toast.error('Error al añadir empleado');
        } else {
            toast.success(`${form.full_name} añadido al equipo`);
            setForm({ full_name: '', role_name: 'employee', location_id: '', hourly_cost: '' });
            setAddOpen(false);
            fetchEmployees();
        }
        setSaving(false);
    };

    // ─── Edit Employee ───
    const handleEditEmployee = async () => {
        if (!editEmployee) return;
        setSaving(true);
        const { error } = await supabase
            .from('employees')
            .update({
                full_name: form.full_name.trim(),
                role_name: form.role_name,
                location_id: form.location_id,
                hourly_cost: form.hourly_cost ? parseFloat(form.hourly_cost) : null,
            })
            .eq('id', editEmployee.id);

        if (error) {
            toast.error('Error al actualizar');
        } else {
            toast.success('Empleado actualizado');
            setEditEmployee(null);
            fetchEmployees();
        }
        setSaving(false);
    };

    const handleToggleActive = async (emp: Employee) => {
        const { error } = await supabase
            .from('employees')
            .update({ active: !emp.active })
            .eq('id', emp.id);

        if (error) {
            toast.error('Error al cambiar estado');
        } else {
            toast.success(emp.active ? `${emp.full_name} desactivado` : `${emp.full_name} reactivado`);
            fetchEmployees();
        }
    };

    const openEdit = (emp: Employee) => {
        setForm({
            full_name: emp.full_name,
            role_name: emp.role_name || 'employee',
            location_id: emp.location_id,
            hourly_cost: emp.hourly_cost?.toString() || '',
        });
        setEditEmployee(emp);
    };

    // ─── Announcements ───
    const handleCreateAnnouncement = async () => {
        if (!announcementForm.title.trim()) {
            toast.error('El título es obligatorio');
            return;
        }
        setSaving(true);
        const { error } = await supabase.from('announcements').insert({
            title: announcementForm.title.trim(),
            body: announcementForm.body.trim(),
            type: announcementForm.type,
            pinned: announcementForm.pinned,
            location_id: announcementForm.location_id || null,
            org_id: orgId,
        });
        if (error) {
            toast.error('Error al crear anuncio');
        } else {
            toast.success('Anuncio publicado');
            setAnnouncementForm({ title: '', body: '', type: 'info', pinned: false, location_id: '' });
            setAnnouncementOpen(false);
            fetchAnnouncements();
        }
        setSaving(false);
    };

    const handleDeleteAnnouncement = async (id: string) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) {
            toast.error('Error al eliminar');
        } else {
            toast.success('Anuncio eliminado');
            fetchAnnouncements();
        }
    };

    const handleTogglePin = async (a: Announcement) => {
        await supabase.from('announcements').update({ pinned: !a.pinned }).eq('id', a.id);
        fetchAnnouncements();
    };

    // ─── Announcement type helpers ───
    const getAnnouncementStyle = (type: string) => {
        switch (type) {
            case 'important': return { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-l-red-500', label: 'Importante' };
            case 'celebration': return { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-l-amber-500', label: 'Celebración' };
            case 'schedule': return { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-l-blue-500', label: 'Horarios' };
            default: return { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-l-gray-400', label: 'Info' };
        }
    };

    // ─── Render ───────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
                    <p className="text-muted-foreground">
                        {activeCount} empleados activos · {clockedIn.length} trabajando ahora
                    </p>
                </div>
                <Button onClick={() => { setForm({ full_name: '', role_name: 'employee', location_id: locations[0]?.id || '', hourly_cost: '' }); setAddOpen(true); }}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Añadir empleado
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="roster" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="roster" className="gap-2">
                        <Users className="h-4 w-4" />
                        Directorio
                    </TabsTrigger>
                    <TabsTrigger value="working" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Quién trabaja
                        {clockedIn.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                                {clockedIn.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="news" className="gap-2">
                        <Megaphone className="h-4 w-4" />
                        Anuncios
                    </TabsTrigger>
                    <TabsTrigger value="logbook" className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Logbook
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Rendimiento
                    </TabsTrigger>
                    <TabsTrigger value="training" className="gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Formación
                    </TabsTrigger>
                    <TabsTrigger value="contracts" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Contratos
                    </TabsTrigger>
                </TabsList>

                {/* ═══ TAB 1: ROSTER ═══ */}
                <TabsContent value="roster" className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t("common.searchByName")}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los roles</SelectItem>
                                {ROLE_OPTIONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {locations.length > 1 && (
                            <Select value={locationFilter} onValueChange={setLocationFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Local" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los locales</SelectItem>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <div className="flex items-center gap-2">
                            <Switch
                                id="show-inactive"
                                checked={showInactive}
                                onCheckedChange={setShowInactive}
                            />
                            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
                                Inactivos
                            </Label>
                        </div>
                    </div>

                    {/* Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[280px]">Empleado</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Local</TableHead>
                                        <TableHead className="text-right">Coste/h</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={6}>
                                                    <div className="animate-pulse h-10 bg-muted rounded" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredEmployees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12">
                                                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-muted-foreground">
                                                    {search || roleFilter !== 'all'
                                                        ? 'No se encontraron empleados con esos filtros'
                                                        : 'No hay empleados registrados'}
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredEmployees.map((emp) => (
                                            <TableRow
                                                key={emp.id}
                                                className={cn(
                                                    'cursor-pointer hover:bg-accent/50 transition-colors',
                                                    !emp.active && 'opacity-50'
                                                )}
                                                onClick={() => openEdit(emp)}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarFallback className={cn(getAvatarColor(emp.full_name), 'text-white text-xs font-semibold')}>
                                                                {getInitials(emp.full_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{emp.full_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getRoleBadgeColor(emp.role_name))}>
                                                        {getRoleLabel(emp.role_name)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        {emp.location_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    {emp.hourly_cost ? `${emp.hourly_cost.toFixed(2)}€` : '—'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {emp.active ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(emp); }}>
                                                                <Edit className="mr-2 h-4 w-4" /> Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(emp); }}>
                                                                {emp.active ? (
                                                                    <><XCircle className="mr-2 h-4 w-4" /> Desactivar</>
                                                                ) : (
                                                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Reactivar</>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(() => {
                            const grouped = employees.filter(e => e.active).reduce<Record<string, number>>((acc, e) => {
                                const loc = e.location_name || 'Otro';
                                acc[loc] = (acc[loc] || 0) + 1;
                                return acc;
                            }, {});
                            return Object.entries(grouped).map(([loc, count]) => (
                                <Card key={loc}>
                                    <CardContent className="p-4">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />{loc}
                                        </p>
                                        <p className="text-2xl font-bold mt-1">{count}</p>
                                    </CardContent>
                                </Card>
                            ));
                        })()}
                    </div>
                </TabsContent>

                {/* ═══ TAB 2: WHO'S WORKING ═══ */}
                <TabsContent value="working" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {format(currentTime, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                        </p>
                        <Button variant="outline" size="sm" onClick={fetchClockedIn}>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Actualizar
                        </Button>
                    </div>

                    {clockedIn.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-lg font-medium text-muted-foreground">Nadie fichado ahora</p>
                                <p className="text-sm text-muted-foreground/60">Los empleados aparecerán aquí al fichar entrada</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {clockedIn.map((record) => {
                                const elapsed = differenceInMinutes(currentTime, new Date(record.clock_in));
                                const hours = Math.floor(elapsed / 60);
                                const mins = elapsed % 60;
                                const isLong = elapsed > 480; // > 8h
                                return (
                                    <Card
                                        key={record.id}
                                        className={cn(
                                            'border-l-4',
                                            isLong ? 'border-l-amber-500' : 'border-l-emerald-500'
                                        )}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className={cn(getAvatarColor(record.employee_name || ''), 'text-white text-sm font-semibold')}>
                                                        {getInitials(record.employee_name || '?')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold truncate">{record.employee_name}</p>
                                                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full', getRoleBadgeColor(record.employee_role || null))}>
                                                        {getRoleLabel(record.employee_role || null)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Timer className="h-3.5 w-3.5" />
                                                    Desde {format(new Date(record.clock_in), 'HH:mm')}
                                                </div>
                                                <Badge variant={isLong ? 'destructive' : 'secondary'} className="font-mono">
                                                    {hours}h {mins}m
                                                </Badge>
                                            </div>
                                            {record.location_name && (
                                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />{record.location_name}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ═══ TAB 3: ANNOUNCEMENTS ═══ */}
                <TabsContent value="news" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{announcements.length} anuncios</p>
                        <Button onClick={() => setAnnouncementOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo anuncio
                        </Button>
                    </div>

                    {announcements.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Megaphone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-lg font-medium text-muted-foreground">Sin anuncios</p>
                                <p className="text-sm text-muted-foreground/60">Crea el primer anuncio para tu equipo</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {announcements.map((a) => {
                                const style = getAnnouncementStyle(a.type);
                                return (
                                    <Card key={a.id} className={cn('border-l-4', style.border)}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {a.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                                                        <h3 className="font-semibold text-sm">{a.title}</h3>
                                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', style.bg, style.text)}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                    {a.body && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground/60 mt-2">
                                                        {format(new Date(a.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                                    </p>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleTogglePin(a)}>
                                                            <Pin className="mr-2 h-4 w-4" />
                                                            {a.pinned ? 'Desfijar' : 'Fijar'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => handleDeleteAnnouncement(a.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ═══ TAB 4: MANAGER LOGBOOK ═══ */}
                <TabsContent value="logbook" className="space-y-4">
                    <ManagerLogbook locationId={selectedLocationId} />
                </TabsContent>

                {/* ═══ TAB 5: EMPLOYEE REVIEWS ═══ */}
                <TabsContent value="reviews" className="space-y-4">
                    <EmployeeReviews locationId={selectedLocationId} />
                </TabsContent>

                {/* ═══ TAB 6: TRAINING ═══ */}
                <TabsContent value="training" className="space-y-4">
                    <TrainingTracker locationId={selectedLocationId} />
                </TabsContent>

                {/* ═══ TAB 7: CONTRACTS ═══ */}
                <TabsContent value="contracts" className="space-y-4">
                    <EmploymentContracts locationId={selectedLocationId} />
                </TabsContent>
            </Tabs>

            {/* ═══ ADD EMPLOYEE DIALOG ═══ */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            Nuevo empleado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre completo *</Label>
                            <Input
                                value={form.full_name}
                                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                                placeholder="María López García"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Select value={form.role_name} onValueChange={(v) => setForm((f) => ({ ...f, role_name: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ROLE_OPTIONS.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Coste/hora (€)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.hourly_cost}
                                    onChange={(e) => setForm((f) => ({ ...f, hourly_cost: e.target.value }))}
                                    placeholder="12.50"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Local *</Label>
                            <Select value={form.location_id} onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar local" /></SelectTrigger>
                                <SelectContent>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAddEmployee} disabled={saving}>
                            {saving ? 'Guardando...' : 'Añadir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ EDIT EMPLOYEE DIALOG ═══ */}
            <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Editar empleado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre completo</Label>
                            <Input
                                value={form.full_name}
                                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Select value={form.role_name} onValueChange={(v) => setForm((f) => ({ ...f, role_name: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ROLE_OPTIONS.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Coste/hora (€)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.hourly_cost}
                                    onChange={(e) => setForm((f) => ({ ...f, hourly_cost: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Local</Label>
                            <Select value={form.location_id} onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {editEmployee && (
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <p className="text-sm font-medium">Estado del empleado</p>
                                    <p className="text-xs text-muted-foreground">
                                        {editEmployee.active ? 'Activo — aparece en horarios y reportes' : 'Inactivo — no aparece en operaciones'}
                                    </p>
                                </div>
                                <Switch
                                    checked={editEmployee.active}
                                    onCheckedChange={() => handleToggleActive(editEmployee)}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancelar</Button>
                        <Button onClick={handleEditEmployee} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ NEW ANNOUNCEMENT DIALOG ═══ */}
            <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5" />
                            Nuevo anuncio
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Título *</Label>
                            <Input
                                value={announcementForm.title}
                                onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder={t("workforce.announcementTitle")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Contenido</Label>
                            <Textarea
                                value={announcementForm.body}
                                onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                                placeholder="Escribe el mensaje para tu equipo..."
                                rows={4}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={announcementForm.type} onValueChange={(v) => setAnnouncementForm((f) => ({ ...f, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="info">Información</SelectItem>
                                        <SelectItem value="important">Importante</SelectItem>
                                        <SelectItem value="schedule">Horarios</SelectItem>
                                        <SelectItem value="celebration">Celebración</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Local (opcional)</Label>
                                <Select value={announcementForm.location_id} onValueChange={(v) => setAnnouncementForm((f) => ({ ...f, location_id: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Todos los locales</SelectItem>
                                        {locations.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="pin"
                                checked={announcementForm.pinned}
                                onCheckedChange={(v) => setAnnouncementForm((f) => ({ ...f, pinned: v }))}
                            />
                            <Label htmlFor="pin" className="cursor-pointer">Fijar en la parte superior</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateAnnouncement} disabled={saving}>
                            {saving ? 'Publicando...' : 'Publicar anuncio'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
