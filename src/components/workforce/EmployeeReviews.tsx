/**
 * EmployeeReviews — Performance review tab for Workforce
 * Quick 5-star rating with category breakdown
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Star, TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Review {
    id: string;
    employee_id: string;
    overall_rating: number;
    categories: Record<string, number>;
    strengths: string | null;
    improvements: string | null;
    goals: string | null;
    status: string;
    review_date: string;
    created_at: string;
}

interface Employee {
    id: string;
    full_name: string;
    role_name: string;
}

const REVIEW_CATEGORIES = [
    { key: 'punctuality', label: 'Puntualidad' },
    { key: 'teamwork', label: 'Trabajo en Equipo' },
    { key: 'quality', label: 'Calidad' },
    { key: 'initiative', label: 'Iniciativa' },
    { key: 'attitude', label: 'Actitud' },
];

function StarRating({ value, onChange, size = 'md' }: {
    value: number;
    onChange?: (v: number) => void;
    size?: 'sm' | 'md';
}) {
    const sz = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange?.(n)}
                    disabled={!onChange}
                    className={`transition-colors ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                    <Star
                        className={`${sz} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                </button>
            ))}
        </div>
    );
}

export function EmployeeReviews({ locationId }: { locationId: string | null }) {
  const { t } = useTranslation();
    const { group } = useApp();
    const { user } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [overallRating, setOverallRating] = useState(3);
    const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>(
        Object.fromEntries(REVIEW_CATEGORIES.map(c => [c.key, 3]))
    );
    const [strengths, setStrengths] = useState('');
    const [improvements, setImprovements] = useState('');
    const [goals, setGoals] = useState('');

    const loadData = useCallback(async () => {
        if (!group?.id) return;
        setLoading(true);
        try {
            // Load employees
            let empQuery = supabase
                .from('employees')
                .select('id, full_name, role_name')
                .eq('org_id', group.id)
                .eq('is_active', true) as any;
            if (locationId) empQuery = empQuery.eq('location_id', locationId);
            const { data: emps } = await empQuery;
            setEmployees(emps || []);

            // Load reviews
            const { data: revs } = await supabase
                .from('employee_reviews')
                .select('*')
                .eq('org_id', group.id)
                .order('review_date', { ascending: false })
                .limit(100);
            setReviews((revs || []).map((r: any) => ({
                ...r,
                categories: (r.categories || {}) as Record<string, number>,
            })));
        } catch (err) {
            console.error('Reviews load error:', err);
        } finally {
            setLoading(false);
        }
    }, [group?.id, locationId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSubmit = async () => {
        if (!selectedEmployee || !group?.id || !user?.id) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('employee_reviews').insert({
                org_id: group.id,
                employee_id: selectedEmployee,
                reviewer_id: user.id,
                location_id: locationId || null,
                overall_rating: overallRating,
                categories: categoryRatings,
                strengths: strengths.trim() || null,
                improvements: improvements.trim() || null,
                goals: goals.trim() || null,
                status: 'submitted',
            });
            if (error) throw error;
            toast.success('Evaluación guardada');
            setDialogOpen(false);
            resetForm();
            loadData();
        } catch (err: any) {
            toast.error('Error al guardar', { description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedEmployee('');
        setOverallRating(3);
        setCategoryRatings(Object.fromEntries(REVIEW_CATEGORIES.map(c => [c.key, 3])));
        setStrengths('');
        setImprovements('');
        setGoals('');
    };

    // Compute averages per employee
    const employeeAvgs = new Map<string, { avg: number; count: number }>();
    for (const r of reviews) {
        const ex = employeeAvgs.get(r.employee_id);
        if (ex) {
            ex.avg = (ex.avg * ex.count + r.overall_rating) / (ex.count + 1);
            ex.count++;
        } else {
            employeeAvgs.set(r.employee_id, { avg: r.overall_rating, count: 1 });
        }
    }

    // Team average
    const teamAvg = reviews.length > 0
        ? reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length
        : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Rendimiento del Equipo</h3>
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva Evaluación
                </Button>
            </div>

            {/* Team Summary */}
            <div className="grid grid-cols-3 gap-3">
                <Card>
                    <CardContent className="py-3 px-4 text-center">
                        <p className="text-2xl font-bold">{teamAvg > 0 ? teamAvg.toFixed(1) : '—'}</p>
                        <p className="text-xs text-muted-foreground">Promedio Equipo</p>
                        {teamAvg > 0 && <StarRating value={Math.round(teamAvg)} size="sm" />}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-4 text-center">
                        <p className="text-2xl font-bold">{reviews.length}</p>
                        <p className="text-xs text-muted-foreground">Evaluaciones</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-4 text-center">
                        <p className="text-2xl font-bold">{employeeAvgs.size}</p>
                        <p className="text-xs text-muted-foreground">Evaluados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Employee Cards */}
            {employees.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-muted-foreground">Sin empleados en este local</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employees.map(emp => {
                        const stats = employeeAvgs.get(emp.id);
                        const empReviews = reviews.filter(r => r.employee_id === emp.id);
                        const initials = emp.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || '?';
                        return (
                            <Card key={emp.id}>
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{emp.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{emp.role_name}</p>
                                        </div>
                                        <div className="text-right">
                                            {stats ? (
                                                <>
                                                    <StarRating value={Math.round(stats.avg)} size="sm" />
                                                    <p className="text-xs text-muted-foreground">{stats.count} eval{stats.count > 1 ? 's' : ''}</p>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">Sin evaluar</Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* New Review Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nueva Evaluación</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar empleado" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(e => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Puntuación General</label>
                            <StarRating value={overallRating} onChange={setOverallRating} />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Categorías</label>
                            {REVIEW_CATEGORIES.map(cat => (
                                <div key={cat.key} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{cat.label}</span>
                                    <StarRating
                                        value={categoryRatings[cat.key] || 3}
                                        onChange={v => setCategoryRatings(prev => ({ ...prev, [cat.key]: v }))}
                                        size="sm"
                                    />
                                </div>
                            ))}
                        </div>

                        <Textarea placeholder="Fortalezas" value={strengths} onChange={e => setStrengths(e.target.value)} rows={2} />
                        <Textarea placeholder={t("workforce.areasOfImprovement")} value={improvements} onChange={e => setImprovements(e.target.value)} rows={2} />
                        <Textarea placeholder="Objetivos" value={goals} onChange={e => setGoals(e.target.value)} rows={2} />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                        <Button onClick={handleSubmit} disabled={submitting || !selectedEmployee}>
                            {submitting ? 'Guardando...' : 'Guardar Evaluación'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
