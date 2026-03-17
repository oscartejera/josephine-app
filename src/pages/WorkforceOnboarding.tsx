import { useState, useEffect, useMemo } from 'react';
import {
    Users,
    FileText,
    UserPlus,
    CheckCircle2,
    Clock,
    AlertCircle,
    Briefcase,
    FileCheck,
    ChevronRight,
    MapPin,
    Upload,
    Eye,
    Download,
    MoreHorizontal,
    Trash2,
    Calendar,
    Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────
interface Employee {
    id: string;
    full_name: string;
    role_name: string | null;
    location_id: string;
    active: boolean;
    created_at?: string;
    hourly_cost: number | null;
    location_name?: string;
}

interface OnboardingTask {
    id: string;
    label: string;
    completed: boolean;
    category: 'docs' | 'training' | 'setup';
}

// ─── Onboarding template ────────────────────────────────
const ONBOARDING_TEMPLATE: Omit<OnboardingTask, 'id'>[] = [
    { label: 'Contrato de trabajo firmado', completed: false, category: 'docs' },
    { label: 'Copia DNI / NIE', completed: false, category: 'docs' },
    { label: 'Número de Seguridad Social', completed: false, category: 'docs' },
    { label: 'Cuenta bancaria (IBAN)', completed: false, category: 'docs' },
    { label: 'Foto para ficha empleado', completed: false, category: 'docs' },
    { label: 'Formación PRL recibida', completed: false, category: 'training' },
    { label: 'Carné de manipulador de alimentos', completed: false, category: 'training' },
    { label: 'Tour del establecimiento', completed: false, category: 'training' },
    { label: 'Protocolo de alérgenos', completed: false, category: 'training' },
    { label: 'Uniforme entregado', completed: false, category: 'setup' },
    { label: 'Acceso al sistema configurado', completed: false, category: 'setup' },
    { label: 'Turno de prueba completado', completed: false, category: 'setup' },
];

// ─── Helpers ────────────────────────────────────────────
const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];
const getAvatarColor = (name: string) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const ROLE_LABELS: Record<string, string> = {
    owner: 'Propietario', admin: 'Administrador', ops_manager: 'Gerente Ops',
    store_manager: 'Gerente Local', manager: 'Encargado/a', waiter: 'Camarero/a',
    cook: 'Cocinero/a', bartender: 'Barista', host: 'Hostess',
    dishwasher: 'Friegaplatos', delivery: 'Repartidor/a', employee: 'Empleado',
};

// ─── Main Component ─────────────────────────────────────
export default function WorkforceOnboarding() {
    const { accessibleLocations } = useApp();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);
    const [contractOpen, setContractOpen] = useState(false);
    const [contractForm, setContractForm] = useState({
        type: 'indefinido',
        start_date: '',
        hours_per_week: '40',
        salary_type: 'hourly',
        notes: '',
    });

    // Fetch employees
    useEffect(() => {
        fetchEmployees();
    }, [accessibleLocations]);

    const fetchEmployees = async () => {
        setLoading(true);
        const locationIds = accessibleLocations.map((l) => l.id);
        const { data } = await supabase
            .from('employees')
            .select('id, full_name, role_name, location_id, active, hourly_cost, created_at')
            .in('location_id', locationIds)
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (data) {
            setEmployees(
                data.map((e) => ({
                    ...e,
                    location_name: accessibleLocations.find((l) => l.id === e.location_id)?.name || 'Desconocido',
                }))
            );
        }
        setLoading(false);
    };

    // Recent employees (added in last 30 days)
    const recentEmployees = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return employees.filter((e) => {
            if (!e.created_at) return false;
            return new Date(e.created_at) >= thirtyDaysAgo;
        });
    }, [employees]);

    // Load onboarding tasks for an employee (stored in localStorage for now)
    const loadOnboardingTasks = (emp: Employee) => {
        const stored = localStorage.getItem(`onboarding_${emp.id}`);
        if (stored) {
            setOnboardingTasks(JSON.parse(stored));
        } else {
            setOnboardingTasks(ONBOARDING_TEMPLATE.map((t, i) => ({ ...t, id: `task_${i}` })));
        }
        setSelectedEmployee(emp);
    };

    const toggleTask = (taskId: string) => {
        if (!selectedEmployee) return;
        const updated = onboardingTasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        );
        setOnboardingTasks(updated);
        localStorage.setItem(`onboarding_${selectedEmployee.id}`, JSON.stringify(updated));
    };

    const completedCount = onboardingTasks.filter((t) => t.completed).length;
    const totalTasks = onboardingTasks.length;
    const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    // Group tasks by category
    const docsTasks = onboardingTasks.filter((t) => t.category === 'docs');
    const trainingTasks = onboardingTasks.filter((t) => t.category === 'training');
    const setupTasks = onboardingTasks.filter((t) => t.category === 'setup');

    // ─── Render ───────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-primary" />
                        Onboarding & Documentos
                    </h1>
                    <p className="text-muted-foreground">
                        Gestión de incorporaciones y documentación del equipo
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="onboarding" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="onboarding" className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Onboarding
                        {recentEmployees.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                                {recentEmployees.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="contracts" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Contratos
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Documentos
                    </TabsTrigger>
                </TabsList>

                {/* ═══ TAB 1: ONBOARDING ═══ */}
                <TabsContent value="onboarding" className="space-y-4">
                    {!selectedEmployee ? (
                        <>
                            {/* Employee list for onboarding */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recentEmployees.length > 0 ? (
                                    recentEmployees.map((emp) => {
                                        const stored = localStorage.getItem(`onboarding_${emp.id}`);
                                        const tasks: OnboardingTask[] = stored ? JSON.parse(stored) : ONBOARDING_TEMPLATE.map((t, i) => ({ ...t, id: `task_${i}` }));
                                        const done = tasks.filter((t) => t.completed).length;
                                        const pct = (done / tasks.length) * 100;

                                        return (
                                            <Card
                                                key={emp.id}
                                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                                                onClick={() => loadOnboardingTasks(emp)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarFallback className={cn(getAvatarColor(emp.full_name), 'text-white text-sm font-semibold')}>
                                                                {getInitials(emp.full_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold truncate">{emp.full_name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {ROLE_LABELS[emp.role_name || ''] || 'Empleado'} · {emp.location_name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Progress value={pct} className="h-2 mb-2" />
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>{done}/{tasks.length} completado</span>
                                                        {pct === 100 ? (
                                                            <Badge variant="default" className="text-[10px] bg-emerald-500">✓ Completado</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px]">En proceso</Badge>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                ) : (
                                    <Card className="col-span-full">
                                        <CardContent className="p-12 text-center">
                                            <UserPlus className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                            <p className="text-lg font-medium text-muted-foreground">Sin incorporaciones recientes</p>
                                            <p className="text-sm text-muted-foreground/60">
                                                Los empleados añadidos en los últimos 30 días aparecerán aquí
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* All employees for onboarding */}
                            {employees.length > recentEmployees.length && (
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Todos los empleados</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {employees.filter((e) => !recentEmployees.includes(e)).slice(0, 12).map((emp) => (
                                            <Card
                                                key={emp.id}
                                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                                                onClick={() => loadOnboardingTasks(emp)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback className={cn(getAvatarColor(emp.full_name), 'text-white text-xs')}>
                                                                {getInitials(emp.full_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{emp.full_name}</p>
                                                            <p className="text-xs text-muted-foreground">{emp.location_name}</p>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // Onboarding detail for selected employee
                        <div className="space-y-4">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
                                ← Volver al listado
                            </Button>

                            <div className="flex items-center gap-4">
                                <Avatar className="h-14 w-14">
                                    <AvatarFallback className={cn(getAvatarColor(selectedEmployee.full_name), 'text-white text-lg font-bold')}>
                                        {getInitials(selectedEmployee.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-xl font-bold">{selectedEmployee.full_name}</h2>
                                    <p className="text-muted-foreground">
                                        {ROLE_LABELS[selectedEmployee.role_name || ''] || 'Empleado'} · {selectedEmployee.location_name}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Progress value={progress} className="flex-1 h-3" />
                                <span className="text-sm font-semibold whitespace-nowrap">
                                    {completedCount}/{totalTasks} ({Math.round(progress)}%)
                                </span>
                            </div>

                            {/* Docs section */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        Documentación
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {docsTasks.map((task) => (
                                        <label
                                            key={task.id}
                                            className={cn(
                                                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                                                task.completed ? 'bg-emerald-500/5' : 'bg-muted/30 hover:bg-muted/50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() => toggleTask(task.id)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>
                                                {task.label}
                                            </span>
                                            {task.completed && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                                        </label>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Training section */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-amber-500" />
                                        Formación
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {trainingTasks.map((task) => (
                                        <label
                                            key={task.id}
                                            className={cn(
                                                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                                                task.completed ? 'bg-emerald-500/5' : 'bg-muted/30 hover:bg-muted/50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() => toggleTask(task.id)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>
                                                {task.label}
                                            </span>
                                            {task.completed && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                                        </label>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Setup section */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-purple-500" />
                                        Configuración
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {setupTasks.map((task) => (
                                        <label
                                            key={task.id}
                                            className={cn(
                                                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                                                task.completed ? 'bg-emerald-500/5' : 'bg-muted/30 hover:bg-muted/50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() => toggleTask(task.id)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>
                                                {task.label}
                                            </span>
                                            {task.completed && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                                        </label>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* ═══ TAB 2: CONTRACTS ═══ */}
                <TabsContent value="contracts" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{employees.length} empleados activos</p>
                        <Button onClick={() => setContractOpen(true)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Nuevo contrato
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {employees.slice(0, 10).map((emp) => (
                            <Card key={emp.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback className={cn(getAvatarColor(emp.full_name), 'text-white text-sm font-semibold')}>
                                                {getInitials(emp.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-semibold">{emp.full_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {ROLE_LABELS[emp.role_name || ''] || 'Empleado'} · {emp.location_name}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="text-[10px]">
                                                {emp.hourly_cost ? `${emp.hourly_cost.toFixed(2)}€/h` : 'Sin coste'}
                                            </Badge>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {emp.created_at
                                                    ? `Desde ${format(new Date(emp.created_at), 'MMM yyyy', { locale: es })}`
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* ═══ TAB 3: DOCUMENTS ═══ */}
                <TabsContent value="documents" className="space-y-4">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Upload className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                                Gestión documental
                            </h3>
                            <p className="text-sm text-muted-foreground/60 max-w-md mx-auto mb-4">
                                Sube y gestiona contratos, documentos de identidad, certificados y más.
                                Los documentos se almacenarán de forma segura y solo serán accesibles por los
                                administradores.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                                {[
                                    { icon: FileText, label: 'Contratos', count: employees.length },
                                    { icon: Shield, label: 'Certificados PRL', count: 0 },
                                    { icon: FileCheck, label: 'DNI / NIE', count: 0 },
                                    { icon: Briefcase, label: 'SS', count: 0 },
                                ].map((doc) => (
                                    <Card key={doc.label}>
                                        <CardContent className="p-4 text-center">
                                            <doc.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                                            <p className="text-sm font-medium">{doc.label}</p>
                                            <p className="text-lg font-bold">{doc.count}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ═══ NEW CONTRACT DIALOG ═══ */}
            <Dialog open={contractOpen} onOpenChange={setContractOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Nuevo contrato
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de contrato</Label>
                            <Select value={contractForm.type} onValueChange={(v) => setContractForm((f) => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="indefinido">Indefinido</SelectItem>
                                    <SelectItem value="temporal">Temporal</SelectItem>
                                    <SelectItem value="practicas">Prácticas</SelectItem>
                                    <SelectItem value="formacion">Formación</SelectItem>
                                    <SelectItem value="relevos">Relevos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Fecha inicio</Label>
                                <Input
                                    type="date"
                                    value={contractForm.start_date}
                                    onChange={(e) => setContractForm((f) => ({ ...f, start_date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Horas/semana</Label>
                                <Input
                                    type="number"
                                    value={contractForm.hours_per_week}
                                    onChange={(e) => setContractForm((f) => ({ ...f, hours_per_week: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notas</Label>
                            <Textarea
                                value={contractForm.notes}
                                onChange={(e) => setContractForm((f) => ({ ...f, notes: e.target.value }))}
                                placeholder="Observaciones del contrato..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setContractOpen(false)}>Cancelar</Button>
                        <Button onClick={() => { toast.success('Contrato registrado (demo)'); setContractOpen(false); }}>
                            Guardar contrato
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
