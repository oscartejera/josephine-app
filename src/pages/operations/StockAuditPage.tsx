import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStockAudit } from '@/hooks/useStockAudit';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { Search, AlertTriangle, TrendingDown, Package, ClipboardCheck, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

function useLocations() {
    const { group } = useApp();
    return useQuery({
        queryKey: ['locations-list'],
        queryFn: async () => {
            if (!group?.id) return [];
            const { data } = await supabase
                .from('locations')
                .select('id, name')
                .eq('org_id', group.id)
                .order('name');
            return data ?? [];
        },
        enabled: !!group?.id,
    });
}

function useInventoryItemsForAudit(locationId: string | null) {
    return useQuery({
        queryKey: ['items-for-audit', locationId],
        queryFn: async () => {
            if (!locationId) return [];
            const { data } = await supabase
                .from('inventory_item_location')
                .select('item_id, on_hand, inventory_items(id, name, base_unit, last_cost)')
                .eq('location_id', locationId)
                .order('on_hand', { ascending: false });
            return (data ?? []).map((row: any) => ({
                id: row.item_id,
                name: row.inventory_items?.name ?? 'Unknown',
                base_unit: row.inventory_items?.base_unit ?? 'ud',
                last_cost: row.inventory_items?.last_cost ?? 0,
                on_hand: row.on_hand ?? 0,
            }));
        },
        enabled: !!locationId,
    });
}

export default function StockAuditPage() {
    const { toast } = useToast();
    const { data: locations } = useLocations();
    const [locationId, setLocationId] = useState('');
    const [search, setSearch] = useState('');
    const [showCountDialog, setShowCountDialog] = useState(false);
    const [countItemId, setCountItemId] = useState('');
    const [countActual, setCountActual] = useState('');

    // Auto-select first location
    if (locations?.length === 1 && !locationId) {
        setLocationId(locations[0].id);
    }

    const {
        variance,
        deadStock,
        isLoading,
        totalFinancialLoss,
        criticalItems,
        totalDeadStockValue,
        submitCount,
    } = useStockAudit(locationId || null);

    const { data: auditItems } = useInventoryItemsForAudit(locationId || null);

    const selectedCountItem = useMemo(
        () => auditItems?.find(i => i.id === countItemId),
        [auditItems, countItemId]
    );

    const filteredVariance = useMemo(() => {
        if (!search) return variance;
        const q = search.toLowerCase();
        return variance.filter(v => v.item_name.toLowerCase().includes(q));
    }, [variance, search]);

    const handleSubmitCount = async () => {
        if (!countItemId || !selectedCountItem) return;
        try {
            await submitCount.mutateAsync({
                item_id: countItemId,
                stock_expected: selectedCountItem.on_hand,
                stock_actual: parseFloat(countActual) || 0,
                unit_cost: selectedCountItem.last_cost,
            });
            toast({ title: '✅ Conteo registrado' });
            setShowCountDialog(false);
            setCountItemId('');
            setCountActual('');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <ClipboardCheck className="h-6 w-6 text-primary" />
                        Auditoría de Stock
                    </h1>
                    <p className="text-muted-foreground">Dashboard de varianza y dead stock</p>
                </div>
                <div className="flex gap-2">
                    {(locations?.length ?? 0) > 1 && (
                        <Select value={locationId} onValueChange={setLocationId}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Ubicación" />
                            </SelectTrigger>
                            <SelectContent>
                                {(locations ?? []).map(l => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button onClick={() => setShowCountDialog(true)} disabled={!locationId}>
                        <Plus className="h-4 w-4 mr-2" /> Nuevo Conteo
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <TrendingDown className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pérdida Financiera</p>
                                <p className="text-2xl font-bold font-mono text-red-500">
                                    €{totalFinancialLoss.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Ítems Críticos (&gt;5% varianza)</p>
                                <p className="text-2xl font-bold">{criticalItems.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-gray-400">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-400/10">
                                <Package className="h-5 w-5 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Dead Stock (30 días)</p>
                                <p className="text-2xl font-bold font-mono">€{totalDeadStockValue.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">{deadStock.length} ítems</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Variance Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Varianza de Inventario</CardTitle>
                            <CardDescription>Stock teórico vs real — rojo = varianza negativa &gt;5%</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar producto..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Teórico</TableHead>
                                <TableHead className="text-right">Real</TableHead>
                                <TableHead className="text-right">Varianza</TableHead>
                                <TableHead className="text-right">Varianza %</TableHead>
                                <TableHead className="text-right">Pérdida €</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : filteredVariance.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No hay datos de varianza. Registra conteos físicos para ver resultados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredVariance.map(v => {
                                    const isCritical = v.variance_pct < -5;
                                    return (
                                        <TableRow key={`${v.item_id}-${v.count_date}`} className={cn(isCritical && "bg-red-50 dark:bg-red-950/20")}>
                                            <TableCell className="font-medium">
                                                {v.item_name}
                                                {isCritical && <Badge variant="destructive" className="ml-2 text-xs">CRÍTICO</Badge>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{v.category}</TableCell>
                                            <TableCell className="text-right font-mono">{v.stock_expected.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{v.stock_actual.toFixed(2)}</TableCell>
                                            <TableCell className={cn("text-right font-mono font-medium", v.variance < 0 ? "text-red-600" : "text-emerald-600")}>
                                                {v.variance >= 0 ? '+' : ''}{v.variance.toFixed(2)}
                                            </TableCell>
                                            <TableCell className={cn("text-right font-mono font-bold", isCritical ? "text-red-600" : v.variance_pct < 0 ? "text-amber-600" : "text-emerald-600")}>
                                                {v.variance_pct >= 0 ? '+' : ''}{v.variance_pct.toFixed(1)}%
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {v.variance < 0 ? <span className="text-red-600">€{v.financial_loss.toFixed(2)}</span> : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Dead Stock Section */}
            {deadStock.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4" /> Dead Stock — Sin rotación 30+ días
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">En stock</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-right">Días inactivo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deadStock.map(d => (
                                    <TableRow key={d.item_id}>
                                        <TableCell className="font-medium">{d.item_name}</TableCell>
                                        <TableCell className="text-muted-foreground">{d.category}</TableCell>
                                        <TableCell className="text-right font-mono">{d.on_hand.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono font-medium">€{d.stock_value.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={d.days_idle > 60 ? "destructive" : "outline"}>
                                                {d.days_idle} días
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Count Dialog */}
            <Dialog open={showCountDialog} onOpenChange={setShowCountDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Conteo Físico</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <Select value={countItemId} onValueChange={setCountItemId}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                                <SelectContent>
                                    {(auditItems ?? []).map(item => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} — Stock actual: {item.on_hand} {item.base_unit}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedCountItem && (
                            <>
                                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span>Stock teórico (sistema)</span>
                                        <span className="font-mono font-bold">{selectedCountItem.on_hand} {selectedCountItem.base_unit}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Stock real (contado)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Cantidad real..."
                                        value={countActual}
                                        onChange={e => setCountActual(e.target.value)}
                                        className="h-12 text-lg font-mono"
                                        autoFocus
                                    />
                                </div>
                                {countActual && (
                                    <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                                        <div className="flex justify-between">
                                            <span>Varianza</span>
                                            <span className={cn(
                                                "font-mono font-bold",
                                                (parseFloat(countActual) - selectedCountItem.on_hand) < 0 ? "text-red-600" : "text-emerald-600"
                                            )}>
                                                {(parseFloat(countActual) - selectedCountItem.on_hand) >= 0 ? '+' : ''}
                                                {(parseFloat(countActual) - selectedCountItem.on_hand).toFixed(2)} {selectedCountItem.base_unit}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Impacto económico</span>
                                            <span className="font-mono">
                                                €{(Math.abs(parseFloat(countActual) - selectedCountItem.on_hand) * selectedCountItem.last_cost).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCountDialog(false)}>Cancelar</Button>
                        <Button onClick={handleSubmitCount} disabled={submitCount.isPending || !countItemId || !countActual}>
                            {submitCount.isPending ? 'Guardando...' : 'Registrar Conteo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
