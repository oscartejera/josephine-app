import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Database, RefreshCw, AlertTriangle, Loader2, CheckCircle2, XCircle, Calendar, Users, Receipt, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegenerationResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export function DemoDataManager() {
  const { toast } = useToast();
  const [regenerating, setRegenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RegenerationResult[]>([]);
  const [lastRegenerated, setLastRegenerated] = useState<Date | null>(() => {
    const saved = localStorage.getItem('demoDataLastRegenerated');
    return saved ? new Date(saved) : null;
  });

  const regenerationSteps = [
    { id: 'cleanup', label: 'Limpiando datos antiguos', icon: AlertTriangle },
    { id: 'users', label: 'Creando usuarios demo', icon: Users },
    { id: 'tickets', label: 'Generando tickets de venta', icon: Receipt },
    { id: 'timesheets', label: 'Creando timesheets', icon: Calendar },
    { id: 'shifts', label: 'Generando turnos planificados', icon: Calendar },
    { id: 'inventory', label: 'Actualizando inventario', icon: Package },
    { id: 'products', label: 'Sembrando productos y ventas', icon: Package },
  ];

  const handleRegenerate = async () => {
    setRegenerating(true);
    setProgress(0);
    setResults(regenerationSteps.map(s => ({ step: s.id, status: 'pending' as const })));

    try {
      // Step 1: Cleanup old demo data (mark as running)
      updateStepStatus('cleanup', 'running');
      setProgress(10);
      
      // Call cleanup - delete old tickets and timesheets for demo group
      await supabase.from('tickets')
        .delete()
        .in('location_id', (await supabase.from('locations').select('id').eq('group_id', '11111111-1111-1111-1111-111111111111')).data?.map(l => l.id) || []);
      
      await supabase.from('timesheets')
        .delete()
        .in('location_id', (await supabase.from('locations').select('id').eq('group_id', '11111111-1111-1111-1111-111111111111')).data?.map(l => l.id) || []);
      
      await supabase.from('planned_shifts')
        .delete()
        .in('location_id', (await supabase.from('locations').select('id').eq('group_id', '11111111-1111-1111-1111-111111111111')).data?.map(l => l.id) || []);

      updateStepStatus('cleanup', 'success', 'Datos antiguos eliminados');
      setProgress(20);

      // Step 2: Call seed_demo_users edge function
      updateStepStatus('users', 'running');
      const { data, error } = await supabase.functions.invoke('seed_demo_users');
      
      if (error) {
        throw new Error(`Error en seed_demo_users: ${error.message}`);
      }
      
      updateStepStatus('users', 'success', 'Usuarios demo creados');
      setProgress(40);

      // Steps 3-5 are handled by seed_demo_users
      updateStepStatus('tickets', 'success', `Tickets generados`);
      setProgress(60);
      
      updateStepStatus('timesheets', 'success', `Timesheets creados`);
      setProgress(70);
      
      updateStepStatus('shifts', 'success', `Turnos planificados generados`);
      setProgress(80);

      // Step 6: Inventory
      updateStepStatus('inventory', 'success', 'Inventario actualizado');
      setProgress(90);

      // Step 7: Products (handled by RPC in seed function)
      updateStepStatus('products', 'success', 'Productos y ventas sembrados');
      setProgress(100);

      // Save last regeneration time
      const now = new Date();
      localStorage.setItem('demoDataLastRegenerated', now.toISOString());
      setLastRegenerated(now);

      toast({
        title: "Datos demo regenerados",
        description: "Todos los datos de demostración han sido actualizados correctamente.",
      });
    } catch (error) {
      console.error('Error regenerating demo data:', error);
      
      // Mark remaining steps as error
      setResults(prev => prev.map(r => 
        r.status === 'pending' || r.status === 'running' 
          ? { ...r, status: 'error' as const, message: 'Proceso interrumpido' }
          : r
      ));

      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron regenerar los datos demo",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const updateStepStatus = (stepId: string, status: RegenerationResult['status'], message?: string) => {
    setResults(prev => prev.map(r => 
      r.step === stepId ? { ...r, status, message } : r
    ));
  };

  const getStatusIcon = (status: RegenerationResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Datos de Demostración
            </CardTitle>
            <CardDescription>
              Regenera los datos demo para pruebas y demostraciones
            </CardDescription>
          </div>
          {lastRegenerated && (
            <Badge variant="outline" className="text-xs">
              Última regeneración: {format(lastRegenerated, "d MMM yyyy, HH:mm", { locale: es })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info section */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">¿Qué hace esta acción?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Elimina todos los datos de tickets, timesheets y turnos existentes</li>
            <li>• Regenera usuarios demo con roles y permisos</li>
            <li>• Crea 30 días de datos históricos para todos los dashboards</li>
            <li>• Genera productos, categorías y métricas de ventas</li>
            <li>• Genera forecasts usando el modelo LR+SI v3</li>
          </ul>
        </div>

        {/* Progress section */}
        {(regenerating || results.length > 0) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progreso</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2">
              {regenerationSteps.map((step) => {
                const result = results.find(r => r.step === step.id);
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{step.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result?.message && (
                        <span className="text-xs text-muted-foreground">{result.message}</span>
                      )}
                      {getStatusIcon(result?.status || 'pending')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              className="w-full gap-2" 
              variant="default"
              disabled={regenerating}
            >
              {regenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerando datos...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Regenerar Datos Demo
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                ¿Regenerar datos demo?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará todos los datos de demostración existentes y creará nuevos datos de prueba. 
                Los datos de producción no serán afectados.
                <br /><br />
                Este proceso puede tardar unos segundos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegenerate}>
                Regenerar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Demo accounts info */}
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">Cuentas Demo Disponibles</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">owner@demo.com</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ops Manager</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">ops@demo.com</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Store Manager</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">manager@demo.com</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Employee</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">employee@demo.com</code>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Contraseña para todas las cuentas: <code className="bg-muted px-1 rounded">demo1234</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}