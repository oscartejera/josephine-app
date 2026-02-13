import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Database, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function DataSourceSettings() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { dsUnified: dataSource, mode, reason, lastSyncedAt, blocked, isLoading: dsLoading, refetch } = useEffectiveDataSource();
  const { toast } = useToast();

  const [localMode, setLocalMode] = useState<'auto' | 'manual'>(mode);
  const [localManualSource, setLocalManualSource] = useState<'demo' | 'pos'>('demo');
  const [saving, setSaving] = useState(false);

  // Sync local state when data source state changes
  useEffect(() => {
    setLocalMode(mode);
    if (mode === 'manual') {
      // Infer from reason what the manual source is
      if (reason === 'manual_demo') setLocalManualSource('demo');
      else setLocalManualSource('pos');
    }
  }, [mode, reason]);

  const handleSave = async () => {
    if (!profile?.group_id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('org_settings')
        .upsert({
          org_id: profile.group_id,
          data_source_mode: localMode,
          manual_data_source: localMode === 'manual' ? localManualSource : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id' });

      if (error) {
        console.error('Failed to save org_settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo guardar la configuración de fuente de datos.',
        });
      } else {
        toast({
          title: 'Guardado',
          description: 'Configuración de fuente de datos actualizada.',
        });
        refetch();
      }
    } catch (err) {
      console.error('Error saving data source settings:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error inesperado al guardar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Nunca';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Hace unos segundos';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const reasonLabels: Record<string, string> = {
    auto_pos_recent: 'Datos POS (sincronización reciente)',
    auto_demo_no_sync: 'Datos Demo (sin sincronización reciente)',
    manual_demo: 'Demo (selección manual)',
    manual_pos_recent: 'Datos POS (selección manual)',
    manual_pos_blocked_no_sync: 'Bloqueado: POS seleccionado pero sin sincronización reciente',
    legacy_pos_connected: 'Datos POS (detección automática legacy)',
    legacy_no_pos: 'Datos Demo (sin conexión POS)',
    legacy_error: 'Datos Demo (error de detección)',
    no_session: 'Datos Demo (sin sesión)',
    loading: 'Cargando...',
  };

  const hasChanged = localMode !== mode ||
    (localMode === 'manual' && (
      (reason === 'manual_demo' && localManualSource !== 'demo') ||
      (reason !== 'manual_demo' && localManualSource !== 'pos')
    ));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Fuente de Datos
        </CardTitle>
        <CardDescription>
          Controla si la aplicación muestra datos reales del POS o datos de demostración.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current status */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Estado actual:</span>
              <Badge variant={dataSource === 'pos' ? 'default' : 'secondary'}>
                {dataSource === 'pos' ? 'POS' : 'Demo'}
              </Badge>
              {blocked && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Bloqueado
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {reasonLabels[reason] || reason}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Última sincronización: {formatSyncTime(lastSyncedAt)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={dsLoading}>
            <RefreshCw className={`h-4 w-4 ${dsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Mode selector */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Modo de selección</Label>
            <Select
              value={localMode}
              onValueChange={(val) => setLocalMode(val as 'auto' | 'manual')}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Automático
                </SelectItem>
                <SelectItem value="manual">
                  Manual
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {localMode === 'auto'
                ? 'Usa datos POS si hay una sincronización en las últimas 24h, si no datos demo.'
                : 'Elige manualmente qué fuente de datos usar.'}
            </p>
          </div>

          {/* Manual source selector */}
          {localMode === 'manual' && (
            <div className="space-y-1 pl-4 border-l-2 border-muted">
              <Label>Fuente de datos</Label>
              <Select
                value={localManualSource}
                onValueChange={(val) => setLocalManualSource(val as 'demo' | 'pos')}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="pos">POS (Square)</SelectItem>
                </SelectContent>
              </Select>

              {localManualSource === 'pos' && !lastSyncedAt && (
                <div className="flex items-start gap-2 mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No hay sincronización POS reciente. Se mostrarán datos Demo hasta que se
                    complete una sincronización exitosa.
                  </p>
                </div>
              )}

              {localManualSource === 'pos' && lastSyncedAt && (
                <div className="flex items-start gap-2 mt-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Última sincronización: {formatSyncTime(lastSyncedAt)}. Datos POS disponibles.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={saving || !hasChanged}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>

        {/* Help text */}
        <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
          <h4 className="text-sm font-medium mb-2">Cómo funciona</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Auto:</strong> Si Square POS se sincronizó en las últimas 24h → datos POS. Si no → datos demo.</li>
            <li><strong>Manual → Demo:</strong> Siempre muestra datos de demostración (para formación, presentaciones, etc.).</li>
            <li><strong>Manual → POS:</strong> Usa datos POS reales. Si la sincronización no es reciente, muestra datos demo con aviso.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
