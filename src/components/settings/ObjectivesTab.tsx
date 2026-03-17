import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';

interface LocationSetting {
    id: string;
    location_id: string;
    location_name: string;
    target_gp_percent: number;
    target_col_percent: number;
    default_cogs_percent: number;
}

export function ObjectivesTab() {
    const { locations } = useApp();
    const { isOwner, hasPermission } = usePermissions();
    const { toast } = useToast();
    const [settings, setSettings] = useState<LocationSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({ target_gp: '', target_col: '', default_cogs: '', hourly_cost: '' });

    const isAdmin = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);

    useEffect(() => {
        fetchSettings();
    }, [locations]);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('location_settings')
            .select(`
        id, location_id, target_gp_percent, target_col_percent, default_cogs_percent, default_hourly_cost,
        locations(name)
      `);

        const mapped: LocationSetting[] = (data || []).map((s: any) => ({
            id: s.id,
            location_id: s.location_id,
            location_name: s.locations?.name || 'Desconocido',
            target_gp_percent: s.target_gp_percent,
            target_col_percent: s.target_col_percent,
            default_cogs_percent: s.default_cogs_percent,
            default_hourly_cost: s.default_hourly_cost ?? 14.5,
        }));
        setSettings(mapped);
        setLoading(false);
    };

    const handleEdit = (setting: LocationSetting) => {
        setEditingId(setting.id);
        setEditValues({
            target_gp: setting.target_gp_percent.toString(),
            target_col: setting.target_col_percent.toString(),
            default_cogs: setting.default_cogs_percent.toString(),
            hourly_cost: (setting as any).default_hourly_cost?.toString() || '14.5',
        });
    };

    const handleSave = async (id: string) => {
        const { error } = await supabase
            .from('location_settings')
            .update({
                target_gp_percent: parseFloat(editValues.target_gp),
                target_col_percent: parseFloat(editValues.target_col),
                default_cogs_percent: parseFloat(editValues.default_cogs),
                default_hourly_cost: parseFloat(editValues.hourly_cost),
            })
            .eq('id', id);

        if (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar" });
        } else {
            toast({ title: "Guardado", description: "Objetivos actualizados" });
            setEditingId(null);
            fetchSettings();
        }
    };

    return (
        <div className="space-y-6">
            {/* P&L Objectives */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Objetivos P&L por Local
                    </CardTitle>
                    <CardDescription>Define los KPIs objetivo para cada local. Estos valores se usan en el scheduling y forecast.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Local</TableHead>
                                <TableHead className="text-right">Target GP%</TableHead>
                                <TableHead className="text-right">Target COL%</TableHead>
                                <TableHead className="text-right">COGS %</TableHead>
                                <TableHead className="text-right">€/h Medio</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {settings.map((setting) => (
                                <TableRow key={setting.id}>
                                    <TableCell className="font-medium">{setting.location_name}</TableCell>
                                    <TableCell className="text-right">
                                        {editingId === setting.id ? (
                                            <Input
                                                type="number"
                                                className="w-20 text-right"
                                                value={editValues.target_gp}
                                                onChange={(e) => setEditValues({ ...editValues, target_gp: e.target.value })}
                                            />
                                        ) : (
                                            `${setting.target_gp_percent}%`
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {editingId === setting.id ? (
                                            <Input
                                                type="number"
                                                className="w-20 text-right"
                                                value={editValues.target_col}
                                                onChange={(e) => setEditValues({ ...editValues, target_col: e.target.value })}
                                            />
                                        ) : (
                                            <span className="font-medium text-emerald-600">{setting.target_col_percent}%</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {editingId === setting.id ? (
                                            <Input
                                                type="number"
                                                className="w-20 text-right"
                                                value={editValues.default_cogs}
                                                onChange={(e) => setEditValues({ ...editValues, default_cogs: e.target.value })}
                                            />
                                        ) : (
                                            `${setting.default_cogs_percent}%`
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {editingId === setting.id ? (
                                            <Input
                                                type="number"
                                                step="0.5"
                                                className="w-20 text-right"
                                                value={editValues.hourly_cost}
                                                onChange={(e) => setEditValues({ ...editValues, hourly_cost: e.target.value })}
                                            />
                                        ) : (
                                            `€${(setting as any).default_hourly_cost?.toFixed(1) || '14.5'}`
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isAdmin && (
                                            editingId === setting.id ? (
                                                <Button size="sm" onClick={() => handleSave(setting.id)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="ghost" onClick={() => handleEdit(setting)}>
                                                    Editar
                                                </Button>
                                            )
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Scheduling Impact Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <span className="text-lg">📊</span>
                        Impacto en Scheduling
                    </CardTitle>
                    <CardDescription>Cómo los objetivos afectan la generación automática de turnos</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {settings.map((s) => {
                            const weeklyBudget = Math.round(3500 * 7 * (s.target_col_percent / 100));
                            const hourlyCost = (s as any).default_hourly_cost || 14.5;
                            const maxHours = Math.round(weeklyBudget / hourlyCost);
                            const splhTarget = Math.round((3500 * 7) / maxHours);
                            return (
                                <div key={s.id} className="p-4 bg-muted/30 rounded-lg border space-y-3">
                                    <div className="font-medium text-sm">{s.location_name}</div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Target COL%</span>
                                            <span className="font-semibold text-emerald-600">{s.target_col_percent}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Budget semanal (est.)</span>
                                            <span className="font-medium">~€{weeklyBudget.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Max horas/semana</span>
                                            <span className="font-medium">~{maxHours}h</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SPLH objetivo</span>
                                            <span className="font-medium">€{splhTarget}/h</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        * Estimaciones basadas en ventas promedio de ~€3,500/día. El AI Scheduler usa el forecast real de cada día para calcular los turnos óptimos.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
