import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FileText, Plus, Edit, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Contract {
    id: string;
    employee_id: string;
    employee_name?: string;
    contract_type: string;
    base_salary_monthly: number | null;
    hourly_rate: number | null;
    jornada_pct: number | null;
    irpf_rate: number | null;
    active: boolean;
    created_at: string;
}

const CONTRACT_TYPES = [
    { value: 'indefinido', label: 'Indefinido' },
    { value: 'temporal', label: 'Temporal' },
    { value: 'practicas', label: 'Prácticas' },
    { value: 'formacion', label: 'Formación' },
    { value: 'fijo_discontinuo', label: 'Fijo Discontinuo' },
    { value: 'por_obra', label: 'Por Obra' },
    { value: 'interinidad', label: 'Interinidad' },
    { value: 'autonomo', label: 'Autónomo' },
];

const getContractLabel = (type: string) =>
    CONTRACT_TYPES.find(c => c.value === type)?.label || type;

const getContractBadgeColor = (type: string) => {
    if (type === 'indefinido') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (type === 'temporal') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    if (type === 'practicas' || type === 'formacion') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

interface Props {
    locationId: string;
}

export function EmploymentContracts({ locationId }: Props) {
    const { accessibleLocations } = useApp();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        employee_id: '',
        contract_type: 'indefinido',
        base_salary_monthly: '',
        hourly_rate: '',
        jornada_pct: '100',
        irpf_rate: '',
        active: true,
    });

    useEffect(() => {
        fetchData();
    }, [locationId]);

    const fetchData = async () => {
        setLoading(true);
        const locationIds = accessibleLocations.map(l => l.id);

        // Fetch employees for this location
        const { data: emps } = await supabase
            .from('employees')
            .select('id, full_name')
            .in('location_id', locationIds)
            .eq('active', true)
            .order('full_name');

        setEmployees(emps || []);

        // Fetch contracts with employee names
        const { data: contractsData } = await (supabase as any)
            .from('employment_contracts')
            .select('id, employee_id, contract_type, base_salary_monthly, hourly_rate, jornada_pct, irpf_rate, active, created_at')
            .order('created_at', { ascending: false });

        if (contractsData) {
            const empMap = new Map((emps || []).map(e => [e.id, e.full_name]));
            const enriched = contractsData
                .filter((c: Contract) => empMap.has(c.employee_id))
                .map((c: Contract) => ({
                    ...c,
                    employee_name: empMap.get(c.employee_id) || 'Desconocido',
                }));
            setContracts(enriched);
        }

        setLoading(false);
    };

    const resetForm = () => {
        setForm({
            employee_id: '',
            contract_type: 'indefinido',
            base_salary_monthly: '',
            hourly_rate: '',
            jornada_pct: '100',
            irpf_rate: '',
            active: true,
        });
        setEditingId(null);
    };

    const openAdd = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEdit = (c: Contract) => {
        setForm({
            employee_id: c.employee_id,
            contract_type: c.contract_type || 'indefinido',
            base_salary_monthly: c.base_salary_monthly?.toString() || '',
            hourly_rate: c.hourly_rate?.toString() || '',
            jornada_pct: c.jornada_pct?.toString() || '100',
            irpf_rate: c.irpf_rate?.toString() || '',
            active: c.active,
        });
        setEditingId(c.id);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.employee_id) {
            toast.error('Selecciona un empleado');
            return;
        }
        setSaving(true);

        const payload = {
            employee_id: form.employee_id,
            contract_type: form.contract_type,
            base_salary_monthly: form.base_salary_monthly ? parseFloat(form.base_salary_monthly) : null,
            hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
            jornada_pct: form.jornada_pct ? parseFloat(form.jornada_pct) : 100,
            irpf_rate: form.irpf_rate ? parseFloat(form.irpf_rate) : null,
            active: form.active,
        };

        if (editingId) {
            const { error } = await (supabase as any)
                .from('employment_contracts')
                .update(payload)
                .eq('id', editingId);
            if (error) {
                toast.error('Error al actualizar contrato');
            } else {
                toast.success('Contrato actualizado');
            }
        } else {
            const { error } = await (supabase as any)
                .from('employment_contracts')
                .insert(payload);
            if (error) {
                toast.error('Error al crear contrato');
            } else {
                toast.success('Contrato creado');
            }
        }

        setSaving(false);
        setDialogOpen(false);
        resetForm();
        fetchData();
    };

    const toggleActive = async (c: Contract) => {
        const { error } = await (supabase as any)
            .from('employment_contracts')
            .update({ active: !c.active })
            .eq('id', c.id);

        if (error) {
            toast.error('Error al cambiar estado');
        } else {
            toast.success(c.active ? 'Contrato desactivado' : 'Contrato reactivado');
            fetchData();
        }
    };

    // Stats
    const activeContracts = contracts.filter(c => c.active);
    const avgSalary = activeContracts.length > 0
        ? activeContracts.reduce((sum, c) => sum + (c.base_salary_monthly || 0), 0) / activeContracts.length
        : 0;
    const avgJornada = activeContracts.length > 0
        ? activeContracts.reduce((sum, c) => sum + (c.jornada_pct || 100), 0) / activeContracts.length
        : 0;
    const typeCounts = activeContracts.reduce<Record<string, number>>((acc, c) => {
        acc[c.contract_type] = (acc[c.contract_type] || 0) + 1;
        return acc;
    }, {});
    const topType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0];

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Contratos activos</p>
                        <p className="text-2xl font-bold mt-1">{activeContracts.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Salario medio</p>
                        <p className="text-2xl font-bold mt-1">€{avgSalary.toFixed(0)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Jornada media</p>
                        <p className="text-2xl font-bold mt-1">{avgJornada.toFixed(0)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Tipo más común</p>
                        <p className="text-2xl font-bold mt-1">
                            {topType ? getContractLabel(topType[0]) : '—'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{contracts.length} contratos registrados</p>
                <Button onClick={openAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo contrato
                </Button>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[220px]">Empleado</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Salario/mes</TableHead>
                                <TableHead className="text-right">€/hora</TableHead>
                                <TableHead className="text-right">Jornada</TableHead>
                                <TableHead className="text-right">IRPF</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={8}>
                                            <div className="animate-pulse h-10 bg-muted rounded" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : contracts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-muted-foreground">No hay contratos registrados</p>
                                        <p className="text-xs text-muted-foreground/60">Crea el primer contrato para tu equipo</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contracts.map(c => (
                                    <TableRow
                                        key={c.id}
                                        className={cn(
                                            'cursor-pointer hover:bg-accent/50 transition-colors',
                                            !c.active && 'opacity-50'
                                        )}
                                        onClick={() => openEdit(c)}
                                    >
                                        <TableCell className="font-medium">{c.employee_name}</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                'text-xs px-2 py-1 rounded-full font-medium',
                                                getContractBadgeColor(c.contract_type)
                                            )}>
                                                {getContractLabel(c.contract_type)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {c.base_salary_monthly ? `€${c.base_salary_monthly.toFixed(0)}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {c.hourly_rate ? `€${c.hourly_rate.toFixed(2)}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {c.jornada_pct != null ? `${c.jornada_pct}%` : '100%'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {c.irpf_rate != null ? `${c.irpf_rate}%` : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {c.active ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost" size="icon" className="h-8 w-8"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon" className="h-8 w-8"
                                                    onClick={(e) => { e.stopPropagation(); toggleActive(c); }}
                                                >
                                                    {c.active ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar contrato' : 'Nuevo contrato'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Empleado</Label>
                            <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))} disabled={!!editingId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar empleado" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de contrato</Label>
                            <Select value={form.contract_type} onValueChange={v => setForm(f => ({ ...f, contract_type: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTRACT_TYPES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Salario bruto/mes (€)</Label>
                                <Input
                                    type="number" step="0.01" placeholder="1500"
                                    value={form.base_salary_monthly}
                                    onChange={e => setForm(f => ({ ...f, base_salary_monthly: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Coste/hora (€)</Label>
                                <Input
                                    type="number" step="0.01" placeholder="10.50"
                                    value={form.hourly_rate}
                                    onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Jornada (%)</Label>
                                <Input
                                    type="number" step="1" min="0" max="100" placeholder="100"
                                    value={form.jornada_pct}
                                    onChange={e => setForm(f => ({ ...f, jornada_pct: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>IRPF (%)</Label>
                                <Input
                                    type="number" step="0.1" placeholder="15"
                                    value={form.irpf_rate}
                                    onChange={e => setForm(f => ({ ...f, irpf_rate: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingId ? 'Guardar cambios' : 'Crear contrato'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
