import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { getLowStockAlerts, createPurchaseOrderDraftFromAlerts } from '@/data/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Loader2, PackageSearch, Truck, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface LowStockAlert {
    itemId: string;
    itemName: string;
    locationId: string;
    currentStock: number;
    parLevel: number;
    deficit: number;
    unit: string;
}

export function AutoPurchaseOrder() {
  const { t } = useTranslation();
    const { selectedLocationId, accessibleLocations } = useApp();
    const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [lastResult, setLastResult] = useState<{ id: string; totalLines: number } | null>(null);
    const [resolvedOrgId, setResolvedOrgId] = useState<string>('');

    const locationIds = selectedLocationId === 'all'
        ? accessibleLocations.map(l => l.id)
        : [selectedLocationId];

    // Resolve orgId from the first accessible location
    useEffect(() => {
        async function resolveOrg() {
            if (accessibleLocations.length === 0) return;
            const { data } = await supabase
                .from('locations')
                .select('org_id')
                .eq('id', accessibleLocations[0].id)
                .single();
            if (data?.org_id) setResolvedOrgId(data.org_id);
        }
        resolveOrg();
    }, [accessibleLocations]);

    const scanAlerts = async () => {
        setLoading(true);
        setLastResult(null);
        try {
            const ctx = { orgId: resolvedOrgId, locationIds, dataSource: 'pos' as const };
            const result = await getLowStockAlerts(ctx);
            setAlerts(result);
            setScanned(true);
            if (result.length === 0) {
                toast.success(t('autoPurchase.toastNoAlerts'));
            } else {
                toast.info(`${result.length} items por debajo del nivel mínimo`);
            }
        } catch (err) {
            console.error('Error scanning alerts:', err);
            toast.error(t('autoPurchase.toastScanError'));
        }
        setLoading(false);
    };

    const generatePO = async () => {
        if (alerts.length === 0) return;
        setGenerating(true);

        try {
            // Get a supplier for the PO (first supplier in DB)
            const { data: supplierData } = await supabase
                .from('suppliers')
                .select('id')
                .limit(1)
                .single();

            const supplierId = supplierData?.id;
            if (!supplierId) {
                toast.error(t('autoPurchase.toastNoSuppliers'));
                setGenerating(false);
                return;
            }

            const locationId = alerts[0].locationId || locationIds[0];
            const ctx = { orgId: resolvedOrgId, locationIds, dataSource: 'pos' as const };

            const draft = {
                supplierId,
                locationId,
                lines: alerts.map(a => ({
                    itemId: a.itemId,
                    qty: Math.ceil(a.deficit),
                    priceEstimate: 0, // Will be filled from last_cost in DB
                })),
            };

            const result = await createPurchaseOrderDraftFromAlerts(ctx, draft);
            setLastResult({ id: result.id, totalLines: result.totalLines });
            toast.success(`Orden de compra creada con ${result.totalLines} líneas`);
        } catch (err) {
            console.error('Error generating PO:', err);
            toast.error(t('autoPurchase.toastGenOrderError'));
        }
        setGenerating(false);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Auto-Reposición Inteligente
                    </CardTitle>
                    {lastResult && (
                        <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            PO #{lastResult.id.slice(0, 8)}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {!scanned ? (
                    <div className="text-center py-4">
                        <PackageSearch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-3">
                            Escanea el inventario para detectar items bajo mínimos y genera automáticamente una orden de compra
                        </p>
                        <Button onClick={scanAlerts} disabled={loading}>
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Escanear inventario
                        </Button>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-4">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-emerald-600">Todo en orden</p>
                        <p className="text-xs text-muted-foreground">No hay items por debajo del nivel mínimo</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={scanAlerts} disabled={loading}>
                            Volver a escanear
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {alerts.length} alertas
                            </Badge>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={scanAlerts} disabled={loading || generating}>
                                    Reescanear
                                </Button>
                                <Button size="sm" onClick={generatePO} disabled={generating || !!lastResult}>
                                    {generating ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Truck className="mr-2 h-4 w-4" />
                                    )}
                                    {lastResult ? 'PO generada' : 'Generar PO automática'}
                                </Button>
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                        <TableHead className="text-right">Mínimo</TableHead>
                                        <TableHead className="text-right">Déficit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {alerts.slice(0, 15).map(a => (
                                        <TableRow key={a.itemId}>
                                            <TableCell className="font-medium text-sm">{a.itemName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm text-red-500">
                                                {a.currentStock} {a.unit}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                                {a.parLevel} {a.unit}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="destructive" className="font-mono text-xs">
                                                    -{a.deficit} {a.unit}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {alerts.length > 15 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                                                ... y {alerts.length - 15} items más
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
