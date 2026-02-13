import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, CheckCircle, ArrowRight, Upload,
  Building, Calendar, Plus, RotateCcw, FileWarning, Loader2
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface Issue {
  type: 'critical' | 'warning' | 'info';
  message: string;
  action: string;
  count?: number;
}

export default function PayrollHome({
  legalEntities,
  selectedLegalEntity,
  setSelectedLegalEntity,
  currentPeriod,
  setCurrentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
  isSandboxMode,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { group, locations } = useApp();
  const { toast } = useToast();
  const [showNewEntityDialog, setShowNewEntityDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [newEntity, setNewEntity] = useState({ razon_social: '', nif: '', domicilio_fiscal: '', cnae: '' });
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [kpis, setKpis] = useState({ totalGross: 0, totalNet: 0, totalEmployerSS: 0, totalIRPF: 0 });

  // Fetch dynamic issues and KPIs
  useEffect(() => {
    fetchIssuesAndKPIs();
  }, [selectedLegalEntity, currentRun, currentPeriod]);

  const fetchIssuesAndKPIs = async () => {
    const newIssues: Issue[] = [];
    
    // Count employees for this group's locations only
    const locationIds = locations.map(l => l.id);
    const { data: emps } = locationIds.length > 0
      ? await supabase.from('employees').select('id').eq('active', true).in('location_id', locationIds)
      : { data: [] as any[] };
    setEmployeeCount(emps?.length || 0);
    
    if (!selectedLegalEntity) return;
    
    // Check employees without legal data
    const { data: legalData } = await supabase
      .from('employee_legal')
      .select('employee_id, nif, nss, iban')
      .eq('legal_entity_id', selectedLegalEntity.id);
    
    const legalMap = new Map((legalData || []).map((l: any) => [l.employee_id, l]));
    const totalEmps = emps?.length || 0;
    const withNif = (legalData || []).filter((l: any) => l.nif).length;
    const withNss = (legalData || []).filter((l: any) => l.nss).length;
    const withIban = (legalData || []).filter((l: any) => l.iban).length;
    
    if (withNif < totalEmps) {
      newIssues.push({
        type: 'warning',
        message: `${totalEmps - withNif} empleado(s) sin NIF registrado`,
        action: 'employees',
        count: totalEmps - withNif,
      });
    }
    if (withNss < totalEmps) {
      newIssues.push({
        type: 'warning',
        message: `${totalEmps - withNss} empleado(s) sin Nº Seguridad Social`,
        action: 'employees',
        count: totalEmps - withNss,
      });
    }
    if (withIban < totalEmps) {
      newIssues.push({
        type: 'info',
        message: `${totalEmps - withIban} empleado(s) sin IBAN (no se podrá generar SEPA)`,
        action: 'employees',
        count: totalEmps - withIban,
      });
    }
    
    // Check contracts
    const { data: contracts } = await supabase
      .from('employment_contracts')
      .select('employee_id')
      .eq('legal_entity_id', selectedLegalEntity.id)
      .eq('active', true);
    
    const withContract = new Set((contracts || []).map((c: any) => c.employee_id)).size;
    if (withContract < totalEmps) {
      newIssues.push({
        type: 'warning',
        message: `${totalEmps - withContract} empleado(s) sin contrato activo`,
        action: 'employees',
        count: totalEmps - withContract,
      });
    }
    
    // If run exists and is calculated, fetch KPIs
    if (currentRun && ['calculated', 'approved', 'submitted', 'paid'].includes(currentRun.status)) {
      const { data: payslips } = await supabase
        .from('payslips')
        .select('gross_pay, net_pay, employer_ss, irpf_withheld')
        .eq('payroll_run_id', currentRun.id);
      
      if (payslips && payslips.length > 0) {
        setKpis({
          totalGross: payslips.reduce((s: number, p: any) => s + Number(p.gross_pay), 0),
          totalNet: payslips.reduce((s: number, p: any) => s + Number(p.net_pay), 0),
          totalEmployerSS: payslips.reduce((s: number, p: any) => s + Number(p.employer_ss), 0),
          totalIRPF: payslips.reduce((s: number, p: any) => s + Number(p.irpf_withheld), 0),
        });
      }
    } else {
      setKpis({ totalGross: 0, totalNet: 0, totalEmployerSS: 0, totalIRPF: 0 });
    }
    
    setIssues(newIssues);
  };

  const handleCreateEntity = async () => {
    if (!newEntity.razon_social || !newEntity.nif || !newEntity.domicilio_fiscal) {
      toast({ variant: 'destructive', title: 'Error', description: 'Completa los campos obligatorios' });
      return;
    }
    if (!group?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se ha detectado el grupo. Recarga la página.' });
      return;
    }

    setLoading(true);
    try {
      const result = await payrollApi.createEntity(group.id, {
        razon_social: newEntity.razon_social,
        nif: newEntity.nif,
        domicilio_fiscal: newEntity.domicilio_fiscal,
        cnae: newEntity.cnae || undefined,
      });
      
      toast({ title: 'Entidad creada', description: 'La entidad legal se ha creado correctamente' });
      setShowNewEntityDialog(false);
      setNewEntity({ razon_social: '', nif: '', domicilio_fiscal: '', cnae: '' });
      await refreshData();
      if (result.data) setSelectedLegalEntity(result.data);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudo crear la entidad' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartPayroll = async () => {
    if (!selectedLegalEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una entidad legal' });
      return;
    }

    if (currentRun) {
      navigate('/payroll/employees');
      return;
    }

    setLoading(true);
    try {
      await payrollApi.createPayrollRun(
        group?.id || '',
        selectedLegalEntity.id,
        currentPeriod.year,
        currentPeriod.month
      );
      
      toast({ title: 'Nómina iniciada', description: `Período ${format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}` });
      await refreshData();
      navigate('/payroll/employees');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudo iniciar la nómina' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPayroll = async () => {
    if (!currentRun) return;
    
    setLoading(true);
    try {
      // Delete payslips, inputs, submissions for this run
      await supabase.from('payslips').delete().eq('payroll_run_id', currentRun.id);
      await supabase.from('compliance_submissions').delete().eq('payroll_run_id', currentRun.id);
      await supabase.from('payroll_runs').delete().eq('id', currentRun.id);
      
      toast({ title: 'Nómina reseteada', description: 'Se ha eliminado la nómina del período. Puedes empezar de nuevo.' });
      setShowResetDialog(false);
      await refreshData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo resetear la nómina' });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    if (!selectedLegalEntity || !group?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona primero una entidad legal' });
      return;
    }
    setLoading(true);
    try {
      const result = await payrollApi.seedTestData(
        group.id,
        selectedLegalEntity.id,
        currentPeriod.year,
        currentPeriod.month,
      );
      toast({ 
        title: 'Datos de prueba cargados', 
        description: result.message || `${result.employees_count} empleados con contratos y datos legales` 
      });
      await refreshData();
      await fetchIssuesAndKPIs();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Error al cargar datos de prueba' });
    } finally {
      setLoading(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return { year: date.getFullYear(), month: date.getMonth() + 1, label: format(date, 'MMMM yyyy', { locale: es }) };
  });

  return (
    <div className="space-y-6">
      {/* Entity & Period Selection */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" />
              Entidad Legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select 
              value={selectedLegalEntity?.id || ''} 
              onValueChange={(val) => {
                const entity = legalEntities.find(e => e.id === val);
                setSelectedLegalEntity(entity);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona entidad..." />
              </SelectTrigger>
              <SelectContent>
                {legalEntities.map(entity => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.razon_social} ({entity.nif})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isPayrollAdmin && (
              <Dialog open={showNewEntityDialog} onOpenChange={setShowNewEntityDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Entidad
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva Entidad Legal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Razón Social *</Label>
                      <Input value={newEntity.razon_social} onChange={(e) => setNewEntity({...newEntity, razon_social: e.target.value})} placeholder="Restaurantes XYZ S.L." />
                    </div>
                    <div>
                      <Label>NIF *</Label>
                      <Input value={newEntity.nif} onChange={(e) => setNewEntity({...newEntity, nif: e.target.value})} placeholder="B12345678" />
                    </div>
                    <div>
                      <Label>Domicilio Fiscal *</Label>
                      <Input value={newEntity.domicilio_fiscal} onChange={(e) => setNewEntity({...newEntity, domicilio_fiscal: e.target.value})} placeholder="Calle Mayor 1, 28001 Madrid" />
                    </div>
                    <div>
                      <Label>CNAE</Label>
                      <Input value={newEntity.cnae} onChange={(e) => setNewEntity({...newEntity, cnae: e.target.value})} placeholder="5610 - Restaurantes" />
                    </div>
                    <Button onClick={handleCreateEntity} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Crear Entidad
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={`${currentPeriod.year}-${currentPeriod.month}`}
              onValueChange={(val) => {
                const [year, month] = val.split('-').map(Number);
                setCurrentPeriod({ year, month });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Bruto Total</p>
            <p className="text-2xl font-bold">€{kpis.totalGross.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Neto Total</p>
            <p className="text-2xl font-bold text-success">€{kpis.totalNet.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">SS Empresa</p>
            <p className="text-2xl font-bold">€{kpis.totalEmployerSS.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">IRPF Total</p>
            <p className="text-2xl font-bold">€{kpis.totalIRPF.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Empleados</p>
            <p className="text-2xl font-bold">{employeeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status & Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Run Status */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Período</CardTitle>
            <CardDescription>
              {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentRun ? (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant={currentRun.status === 'paid' ? 'default' : 'secondary'} className="text-sm py-1 px-3">
                    {currentRun.status === 'draft' && 'Borrador'}
                    {currentRun.status === 'validated' && 'Validado'}
                    {currentRun.status === 'calculated' && 'Calculado'}
                    {currentRun.status === 'approved' && 'Aprobado'}
                    {currentRun.status === 'submitted' && 'Presentado'}
                    {currentRun.status === 'paid' && 'Pagado'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Creado {format(new Date(currentRun.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleStartPayroll} className="flex-1">
                    Continuar nómina
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" title="Resetear nómina">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resetear Nómina</DialogTitle>
                        <DialogDescription>
                          Se eliminarán todos los datos de esta nómina (nóminas calculadas, presentaciones, etc.) y podrás empezar de nuevo.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleResetPayroll} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                          Resetear
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  No hay nómina iniciada para este período.
                </p>
                <Button 
                  onClick={handleStartPayroll} 
                  disabled={!selectedLegalEntity || loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Iniciar nómina del mes
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Issues Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-warning" />
              Problemas a Resolver
            </CardTitle>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span>Todo listo para procesar</span>
              </div>
            ) : (
              <div className="space-y-2">
                {issues.map((issue, i) => (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      issue.type === 'critical' ? 'bg-destructive/10' : 
                      issue.type === 'warning' ? 'bg-warning/10' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${
                        issue.type === 'critical' ? 'text-destructive' : 
                        issue.type === 'warning' ? 'text-warning' : 'text-muted-foreground'
                      }`} />
                      <span className="text-sm">{issue.message}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/payroll/${issue.action}`)}>
                      Resolver
                    </Button>
                  </div>
                ))}
                {isSandboxMode && (
                  <p className="text-xs text-muted-foreground mt-2">
                    En modo sandbox, puedes continuar sin resolver estos problemas.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Certificate Setup (Sandbox mode) */}
      {isSandboxMode && isPayrollAdmin && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Configurar Certificado Digital</h3>
                <p className="text-sm text-muted-foreground">
                  Sube el certificado de empresa (P12/PFX) para presentar a TGSS/AEAT/SEPE
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Certificado
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Certificado Digital</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arrastra tu certificado P12/PFX aquí
                      </p>
                      <input type="file" className="hidden" accept=".p12,.pfx" />
                      <Button variant="link" className="mt-2">
                        O selecciona un archivo
                      </Button>
                    </div>
                    <div>
                      <Label>Contraseña del certificado</Label>
                      <Input type="password" placeholder="••••••••" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El certificado se almacenará cifrado. Solo payroll_admin puede gestionarlo.
                    </p>
                    <Button className="w-full" disabled>
                      Guardar Certificado
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seed Test Data (sandbox only) */}
      {isSandboxMode && selectedLegalEntity && (
        <Card className="border-dashed border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Datos de Prueba</h3>
                <p className="text-sm text-muted-foreground">
                  Carga 20 empleados con contratos, NIF/NSS/IBAN y variables mensuales para hacer una prueba completa.
                </p>
              </div>
              <Button variant="outline" onClick={handleSeedData} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Cargar datos de prueba
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
