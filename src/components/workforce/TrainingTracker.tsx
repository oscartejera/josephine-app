/**
 * TrainingTracker — Staff certifications & expiry tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { GraduationCap, Plus, AlertTriangle, CheckCircle2, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface TrainingRecord {
    id: string;
    employee_id: string;
    cert_name: string;
    cert_type: string;
    issued_date: string | null;
    expiry_date: string | null;
    status: string;
}

interface Employee {
    id: string;
    full_name: string;
}

const CERT_TYPES = [
    { value: 'food_safety', label: 'Seguridad Alimentaria' },
    { value: 'alcohol', label: 'Servicio de Alcohol' },
    { value: 'first_aid', label: 'Primeros Auxilios' },
    { value: 'fire', label: 'Prevención de Incendios' },
    { value: 'allergen', label: 'Alérgenos' },
    { value: 'haccp', label: 'HACCP/APPCC' },
    { value: 'custom', label: 'Otro' },
];

function getStatusBadge(status: string, expiryDate: string | null) {
    if (!expiryDate) return <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Sin caducidad</Badge>;
    const daysLeft = differenceInDays(new Date(expiryDate), new Date());
    if (daysLeft < 0) return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Caducado</Badge>;
    if (daysLeft < 30) return <Badge className="bg-amber-500"><Clock className="h-3 w-3 mr-1" />Caduca en {daysLeft}d</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Válido</Badge>;
}

export function TrainingTracker({ locationId }: { locationId: string | null }) {
    const { group } = useApp();
    const [records, setRecords] = useState<TrainingRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [certName, setCertName] = useState('');
    const [certType, setCertType] = useState('food_safety');
    const [issuedDate, setIssuedDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');

    const loadData = useCallback(async () => {
        if (!group?.id) return;
        setLoading(true);
        try {
            const { data: emps } = await (supabase
                .from('employees')
                .select('id, full_name')
                .eq('org_id', group.id)
                .eq('is_active', true)
                .order('full_name') as any);
            setEmployees(emps || []);

            const { data: recs } = await supabase
                .from('training_records')
                .select('*')
                .eq('org_id', group.id)
                .order('expiry_date', { ascending: true });
            setRecords(recs || []);
        } catch (err) {
            console.error('Training load error:', err);
        } finally {
            setLoading(false);
        }
    }, [group?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSubmit = async () => {
        if (!selectedEmployee || !certName.trim() || !group?.id) return;
        setSubmitting(true);
        try {
            //  Auto-compute status
            let status = 'valid';
            if (expiryDate) {
                const daysLeft = differenceInDays(new Date(expiryDate), new Date());
                if (daysLeft < 0) status = 'expired';
                else if (daysLeft < 30) status = 'expiring';
            }

            const { error } = await supabase.from('training_records').insert({
                org_id: group.id,
                employee_id: selectedEmployee,
                cert_name: certName.trim(),
                cert_type: certType,
                issued_date: issuedDate || null,
                expiry_date: expiryDate || null,
                status,
            });
            if (error) throw error;
            toast.success('Certificado añadido');
            setDialogOpen(false);
            resetForm();
            loadData();
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedEmployee('');
        setCertName('');
        setCertType('food_safety');
        setIssuedDate('');
        setExpiryDate('');
    };

    // Stats
    const expiredCount = records.filter(r => {
        if (!r.expiry_date) return false;
        return differenceInDays(new Date(r.expiry_date), new Date()) < 0;
    }).length;
    const expiringCount = records.filter(r => {
        if (!r.expiry_date) return false;
        const d = differenceInDays(new Date(r.expiry_date), new Date());
        return d >= 0 && d < 30;
    }).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Formación y Certificados</h3>
                    {(expiredCount + expiringCount) > 0 && (
                        <Badge variant="destructive" className="rounded-full">
                            {expiredCount + expiringCount} atención
                        </Badge>
                    )}
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir Certificado
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <Card><CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold">{records.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{records.length - expiredCount - expiringCount}</p>
                    <p className="text-xs text-muted-foreground">Válidos</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{expiringCount}</p>
                    <p className="text-xs text-muted-foreground">Caducando</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
                    <p className="text-xs text-muted-foreground">Caducados</p>
                </CardContent></Card>
            </div>

            {/* Records list */}
            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : records.length === 0 ? (
                <Card><CardContent className="py-8 text-center">
                    <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-muted-foreground">Sin certificados registrados</p>
                </CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {records.map(rec => {
                        const emp = employees.find(e => e.id === rec.employee_id);
                        const initials = emp?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?';
                        const typeLabel = CERT_TYPES.find(t => t.value === rec.cert_type)?.label || rec.cert_type;
                        return (
                            <Card key={rec.id}>
                                <CardContent className="py-2 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="font-medium text-sm">{emp?.full_name || 'Desconocido'}</p>
                                            <p className="text-xs text-muted-foreground">{rec.cert_name} · {typeLabel}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {rec.expiry_date && (
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(rec.expiry_date), 'd MMM yyyy', { locale: es })}
                                            </span>
                                        )}
                                        {getStatusBadge(rec.status, rec.expiry_date)}
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
                    <DialogHeader><DialogTitle>Nuevo Certificado</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger><SelectValue placeholder="Empleado" /></SelectTrigger>
                            <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Nombre del certificado" value={certName} onChange={e => setCertName(e.target.value)} />
                        <Select value={certType} onValueChange={setCertType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CERT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Fecha emisión</label>
                                <Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Fecha caducidad</label>
                                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={submitting || !selectedEmployee || !certName.trim()}>
                            {submitting ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
