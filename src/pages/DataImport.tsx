/**
 * DataImport — CSV/Excel bulk data importer
 * Allows restaurants to upload sales data from any POS system.
 */

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ParsedData {
    headers: string[];
    rows: string[][];
}

interface ColumnMapping {
    date: string;
    net_sales: string;
    orders?: string;
    gross_sales?: string;
    taxes?: string;
    discounts?: string;
}

const REQUIRED_FIELDS = ['date', 'net_sales'] as const;
const OPTIONAL_FIELDS = ['orders', 'gross_sales', 'taxes', 'discounts'] as const;

const FIELD_LABELS: Record<string, string> = {
    date: 'Fecha (requerido)',
    net_sales: 'Ventas Netas (requerido)',
    orders: 'Nº Pedidos',
    gross_sales: 'Ventas Brutas',
    taxes: 'Impuestos',
    discounts: 'Descuentos',
};

function parseCSV(text: string): ParsedData {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect separator (comma, semicolon, tab)
    const firstLine = lines[0];
    const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1)
        .filter(l => l.trim())
        .map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')));

    return { headers, rows };
}

export default function DataImport() {
    const [step, setStep] = useState<ImportStep>('upload');
    const [parsed, setParsed] = useState<ParsedData | null>(null);
    const [mapping, setMapping] = useState<ColumnMapping>({ date: '', net_sales: '' });
    const [fileName, setFileName] = useState('');
    const [importCount, setImportCount] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { selectedLocationId } = useApp();
    const { session } = useAuth();

    const handleFile = useCallback((file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const data = parseCSV(text);
            setParsed(data);
            // Auto-map obvious columns
            const autoMap: ColumnMapping = { date: '', net_sales: '' };
            data.headers.forEach(h => {
                const lower = h.toLowerCase();
                if (lower.includes('fecha') || lower.includes('date') || lower === 'day') autoMap.date = h;
                if (lower.includes('net') || lower.includes('neto') || lower.includes('total_sales') || lower.includes('net_sales')) autoMap.net_sales = h;
                if (lower.includes('order') || lower.includes('pedido') || lower.includes('transactions')) autoMap.orders = h;
                if (lower.includes('gross') || lower.includes('brut')) autoMap.gross_sales = h;
                if (lower.includes('tax') || lower.includes('impuesto') || lower.includes('iva')) autoMap.taxes = h;
                if (lower.includes('descuento') || lower.includes('discount')) autoMap.discounts = h;
            });
            setMapping(autoMap);
            setStep('mapping');
        };
        reader.readAsText(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const handleImport = async () => {
        if (!parsed || !selectedLocationId || selectedLocationId === 'all') {
            toast.error('Selecciona una ubicación específica antes de importar');
            return;
        }

        setStep('importing');

        try {
            const rows = parsed.rows.map(row => {
                const idx = (col: string) => parsed.headers.indexOf(col);
                const dateRaw = row[idx(mapping.date)] || '';
                const netSales = parseFloat(row[idx(mapping.net_sales)]?.replace(/[€$,]/g, '') || '0');
                const orders = mapping.orders ? parseInt(row[idx(mapping.orders)] || '0') : 0;
                const grossSales = mapping.gross_sales ? parseFloat(row[idx(mapping.gross_sales)]?.replace(/[€$,]/g, '') || '0') : netSales;
                const taxes = mapping.taxes ? parseFloat(row[idx(mapping.taxes)]?.replace(/[€$,]/g, '') || '0') : 0;
                const discounts = mapping.discounts ? parseFloat(row[idx(mapping.discounts)]?.replace(/[€$,]/g, '') || '0') : 0;

                // Parse date (try multiple formats)
                let date: string;
                try {
                    const d = new Date(dateRaw);
                    if (isNaN(d.getTime())) throw new Error('Invalid date');
                    date = format(d, 'yyyy-MM-dd');
                } catch {
                    // Try DD/MM/YYYY format
                    const parts = dateRaw.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                        const [a, b, c] = parts;
                        if (parseInt(a) > 31) date = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
                        else date = `${c.length === 2 ? '20' + c : c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
                    } else {
                        date = dateRaw;
                    }
                }

                return {
                    location_id: selectedLocationId,
                    date,
                    net_sales: netSales,
                    gross_sales: grossSales,
                    orders,
                    taxes,
                    discounts,
                    source: 'csv_import',
                };
            }).filter(r => r.date && r.net_sales > 0);

            // Insert in batches of 100
            let inserted = 0;
            for (let i = 0; i < rows.length; i += 100) {
                const batch = rows.slice(i, i + 100);
                const { error } = await supabase
                    .from('sales_daily_unified' as any)
                    .upsert(batch, { onConflict: 'location_id,date' });
                if (error) {
                    console.error('Import batch error:', error);
                    toast.error(`Error en lote ${Math.floor(i / 100) + 1}: ${error.message}`);
                } else {
                    inserted += batch.length;
                }
            }

            setImportCount(inserted);
            setStep('done');
            toast.success(`${inserted} registros importados correctamente`);
        } catch (err: any) {
            toast.error('Error inesperado durante la importación');
            console.error(err);
            setStep('preview');
        }
    };

    const canProceedMapping = mapping.date && mapping.net_sales;

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                    <Upload className="h-6 w-6" />
                    Importar Datos
                </h1>
                <p className="text-muted-foreground">
                    Sube un archivo CSV o Excel con tus ventas diarias
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 text-sm">
                {(['upload', 'mapping', 'preview', 'done'] as const).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <Badge variant={step === s ? 'default' : ((['upload', 'mapping', 'preview', 'done'].indexOf(step) > i) ? 'secondary' : 'outline')}>
                            {i + 1}. {s === 'upload' ? 'Subir archivo' : s === 'mapping' ? 'Mapear columnas' : s === 'preview' ? 'Vista previa' : 'Completado'}
                        </Badge>
                        {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                ))}
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Subir Archivo</CardTitle>
                        <CardDescription>Arrastra un CSV con tus ventas diarias o haz click para seleccionar</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                        >
                            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-lg font-medium mb-1">Arrastra tu archivo aquí</p>
                            <p className="text-sm text-muted-foreground mb-4">o haz click para seleccionar</p>
                            <p className="text-xs text-muted-foreground">Formatos soportados: CSV (.csv), separado por comas, punto y coma, o tabulaciones</p>
                            <input ref={inputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                        </div>

                        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm font-medium mb-2">Formato esperado:</p>
                            <code className="text-xs bg-background p-2 rounded block">
                                fecha,ventas_netas,pedidos,ventas_brutas<br />
                                2026-01-01,1500.00,45,1650.00<br />
                                2026-01-02,1320.50,38,1450.00
                            </code>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && parsed && (
                <Card>
                    <CardHeader>
                        <CardTitle>Mapear Columnas</CardTitle>
                        <CardDescription>
                            Archivo: <strong>{fileName}</strong> — {parsed.rows.length} filas detectadas.
                            Asigna cada columna de tu archivo a los campos de Josephine.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(field => (
                            <div key={field} className="flex items-center gap-4">
                                <div className="w-48 text-sm font-medium">
                                    {FIELD_LABELS[field]}
                                    {REQUIRED_FIELDS.includes(field as any) && <span className="text-red-500 ml-1">*</span>}
                                </div>
                                <Select value={(mapping as any)[field] || ''} onValueChange={(v) => setMapping(prev => ({ ...prev, [field]: v }))}>
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder="— Seleccionar columna —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">— No mapear —</SelectItem>
                                        {parsed.headers.map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {(mapping as any)[field] && (
                                    <span className="text-xs text-muted-foreground">
                                        Ej: {parsed.rows[0]?.[parsed.headers.indexOf((mapping as any)[field])] || '—'}
                                    </span>
                                )}
                            </div>
                        ))}

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={() => setStep('upload')}>← Atrás</Button>
                            <Button disabled={!canProceedMapping} onClick={() => setStep('preview')}>
                                Vista Previa →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && parsed && (
                <Card>
                    <CardHeader>
                        <CardTitle>Vista Previa</CardTitle>
                        <CardDescription>Primeras 10 filas — verifica que los datos son correctos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-auto max-h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Ventas Netas</TableHead>
                                        <TableHead>Pedidos</TableHead>
                                        <TableHead>Ventas Brutas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsed.rows.slice(0, 10).map((row, i) => {
                                        const idx = (col: string) => parsed.headers.indexOf(col);
                                        return (
                                            <TableRow key={i}>
                                                <TableCell>{row[idx(mapping.date)]}</TableCell>
                                                <TableCell>€{row[idx(mapping.net_sales)]}</TableCell>
                                                <TableCell>{mapping.orders ? row[idx(mapping.orders)] : '—'}</TableCell>
                                                <TableCell>{mapping.gross_sales ? `€${row[idx(mapping.gross_sales)]}` : '—'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <p className="text-sm text-muted-foreground mt-3">
                            Total: <strong>{parsed.rows.length}</strong> filas a importar
                            {selectedLocationId && selectedLocationId !== 'all' && (
                                <> · Ubicación: <strong>{selectedLocationId.slice(0, 8)}...</strong></>
                            )}
                        </p>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={() => setStep('mapping')}>← Atrás</Button>
                            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700">
                                <Upload className="h-4 w-4 mr-2" /> Importar {parsed.rows.length} registros
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Importing */}
            {step === 'importing' && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                        <p className="text-lg font-medium">Importando datos...</p>
                        <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos</p>
                    </CardContent>
                </Card>
            )}

            {/* Done */}
            {step === 'done' && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                        <p className="text-xl font-bold mb-2">¡Importación Completada!</p>
                        <p className="text-muted-foreground mb-6">{importCount} registros importados correctamente</p>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setStep('upload'); setParsed(null); }}>
                                Importar más datos
                            </Button>
                            <Button onClick={() => window.location.href = '/insights/sales'}>
                                Ver Ventas →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
