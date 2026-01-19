import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: { id: string; name: string }[];
  onComplete: () => void;
}

interface CsvMapping {
  ticket_id: string;
  closed_at: string;
  gross_total: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  payment_method: string;
  payment_amount: string;
  category?: string;
  channel?: string;
  table_name?: string;
  covers?: string;
  discount?: string;
  tax_rate?: string;
}

const REQUIRED_FIELDS = [
  { key: 'ticket_id', label: 'Ticket ID / External ID', required: true },
  { key: 'closed_at', label: 'Fecha/hora cierre', required: true },
  { key: 'gross_total', label: 'Total bruto', required: true },
  { key: 'item_name', label: 'Nombre producto', required: true },
  { key: 'quantity', label: 'Cantidad', required: true },
  { key: 'unit_price', label: 'Precio unitario', required: true },
  { key: 'payment_method', label: 'Método de pago', required: true },
  { key: 'payment_amount', label: 'Importe pago', required: true },
] as const;

const OPTIONAL_FIELDS = [
  { key: 'category', label: 'Categoría' },
  { key: 'channel', label: 'Canal (dinein/takeaway/delivery)' },
  { key: 'table_name', label: 'Mesa' },
  { key: 'covers', label: 'Comensales' },
  { key: 'discount', label: 'Descuento' },
  { key: 'tax_rate', label: 'Tasa IVA (%)' },
] as const;

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
  
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): Partial<CsvMapping> {
  const mapping: Partial<CsvMapping> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Auto-detect common column names
  const patterns: Record<string, RegExp[]> = {
    ticket_id: [/ticket.*id/i, /external.*id/i, /order.*id/i, /venta.*id/i, /id.*venta/i, /^id$/i],
    closed_at: [/close/i, /fecha/i, /date/i, /timestamp/i, /cierre/i],
    gross_total: [/gross.*total/i, /total.*bruto/i, /^total$/i, /importe/i],
    item_name: [/item.*name/i, /product/i, /producto/i, /nombre/i, /articulo/i],
    quantity: [/quantity/i, /qty/i, /cantidad/i, /unidades/i],
    unit_price: [/unit.*price/i, /price/i, /precio/i, /pvp/i],
    payment_method: [/payment.*method/i, /method/i, /forma.*pago/i, /metodo/i],
    payment_amount: [/payment.*amount/i, /amount/i, /importe.*pago/i],
    category: [/category/i, /categoria/i, /tipo/i],
    channel: [/channel/i, /canal/i, /source/i],
    table_name: [/table/i, /mesa/i],
    covers: [/covers/i, /pax/i, /comensales/i],
    discount: [/discount/i, /descuento/i],
    tax_rate: [/tax.*rate/i, /iva/i, /impuesto/i],
  };
  
  for (const [field, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const matchIdx = lowerHeaders.findIndex(h => regex.test(h));
      if (matchIdx !== -1 && !Object.values(mapping).includes(headers[matchIdx])) {
        (mapping as any)[field] = headers[matchIdx];
        break;
      }
    }
  }
  
  return mapping;
}

export function CsvImportDialog({ open, onOpenChange, locations, onComplete }: CsvImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing'>('upload');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] }>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<Partial<CsvMapping>>({});
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const parsed = parseCsv(text);
    setCsvData(parsed);
    const autoMapping = autoDetectMapping(parsed.headers);
    setMapping(autoMapping);
    setStep('map');
  };

  const updateMapping = (field: string, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value || undefined }));
  };

  const isValidMapping = useMemo(() => {
    return REQUIRED_FIELDS.every(f => mapping[f.key]);
  }, [mapping]);

  const previewRows = useMemo(() => {
    return csvData.rows.slice(0, 20);
  }, [csvData.rows]);

  const handleImport = async () => {
    if (!selectedLocation || !isValidMapping) return;
    
    setStep('importing');
    setImporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('pos_import_csv', {
        body: {
          location_id: selectedLocation,
          data: csvData.rows,
          mapping: mapping as CsvMapping,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: 'Importación completada',
        description: `${data.results.tickets.inserted + data.results.tickets.updated} tickets, ${data.results.lines.inserted} líneas, ${data.results.payments.inserted} pagos`,
      });
      
      onComplete();
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Import error:', err);
      toast({
        variant: 'destructive',
        title: 'Error de importación',
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setCsvData({ headers: [], rows: [] });
    setMapping({});
    setSelectedLocation('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV Import
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sube un archivo CSV con tus datos de ventas'}
            {step === 'map' && 'Mapea las columnas del CSV a los campos internos'}
            {step === 'preview' && 'Revisa los datos antes de importar'}
            {step === 'importing' && 'Importando datos...'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" disabled={step !== 'upload'}>1. Upload</TabsTrigger>
            <TabsTrigger value="map" disabled={step === 'upload'}>2. Map</TabsTrigger>
            <TabsTrigger value="preview" disabled={step !== 'preview' && step !== 'importing'}>3. Preview</TabsTrigger>
            <TabsTrigger value="importing" disabled>4. Import</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-2">
              <Label>Local de destino</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar local" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              } ${!selectedLocation ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Arrastra tu archivo CSV aquí</p>
              <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={!selectedLocation}
              />
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Archivo: <span className="font-medium">{file?.name}</span> ({csvData.rows.length} filas)
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Campos requeridos
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {REQUIRED_FIELDS.map(field => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          <Select 
                            value={mapping[field.key] || ''} 
                            onValueChange={(v) => updateMapping(field.key, v)}
                          >
                            <SelectTrigger className={!mapping[field.key] ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Seleccionar columna" />
                            </SelectTrigger>
                            <SelectContent>
                              {csvData.headers.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Campos opcionales</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {OPTIONAL_FIELDS.map(field => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          <Select 
                            value={mapping[field.key] || ''} 
                            onValueChange={(v) => updateMapping(field.key, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">—</SelectItem>
                              {csvData.headers.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
              <Button onClick={() => setStep('preview')} disabled={!isValidMapping}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{csvData.rows.length} filas totales</Badge>
              <p className="text-sm text-muted-foreground">Mostrando primeras 20 filas</p>
            </div>
            
            <div className="border rounded-lg overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {REQUIRED_FIELDS.map(f => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {REQUIRED_FIELDS.map(f => (
                        <TableCell key={f.key} className="text-xs">
                          {mapping[f.key] ? row[mapping[f.key]!] || '—' : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar importación
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="importing">
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Importando datos...</p>
              <p className="text-muted-foreground">Esto puede tardar unos segundos</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
