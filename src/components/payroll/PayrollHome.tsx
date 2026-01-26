import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, Users, AlertTriangle, CheckCircle, ArrowRight, 
  Building, Calendar, Plus, Upload, FileWarning
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface PayrollHomeProps extends PayrollContextData {}

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
}: PayrollHomeProps) {
  const navigate = useNavigate();
  const { group } = useApp();
  const { toast } = useToast();
  const [showNewEntityDialog, setShowNewEntityDialog] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [newEntity, setNewEntity] = useState({ razon_social: '', nif: '', domicilio_fiscal: '', cnae: '' });
  const [loading, setLoading] = useState(false);

  // Fetch real KPIs from payslips when we have a current run
  const [kpis, setKpis] = useState({
    totalGross: 0,
    totalNet: 0,
    totalEmployerSS: 0,
    totalIRPF: 0,
    employeeCount: 0,
  });

  useEffect(() => {
    async function fetchPayrollKPIs() {
      if (!currentRun) {
        setKpis({ totalGross: 0, totalNet: 0, totalEmployerSS: 0, totalIRPF: 0, employeeCount: 0 });
        return;
      }

      const { data: payslips } = await supabase
        .from('payslips')
        .select('gross_pay, net_pay, employer_ss, irpf_withheld')
        .eq('payroll_run_id', currentRun.id);

      if (payslips && payslips.length > 0) {
        setKpis({
          totalGross: payslips.reduce((sum, p) => sum + Number(p.gross_pay || 0), 0),
          totalNet: payslips.reduce((sum, p) => sum + Number(p.net_pay || 0), 0),
          totalEmployerSS: payslips.reduce((sum, p) => sum + Number(p.employer_ss || 0), 0),
          totalIRPF: payslips.reduce((sum, p) => sum + Number(p.irpf_withheld || 0), 0),
          employeeCount: payslips.length,
        });
      } else {
        // No payslips yet - show zeros
        setKpis({ totalGross: 0, totalNet: 0, totalEmployerSS: 0, totalIRPF: 0, employeeCount: 0 });
      }
    }

    fetchPayrollKPIs();
  }, [currentRun]);

  // Mock issues
  const issues = [
    { type: 'critical', message: '2 empleados sin NIF/NSS', action: 'employees' },
    { type: 'warning', message: '3 timesheets pendientes de aprobar', action: 'inputs' },
  ].filter(() => !currentRun || currentRun.status === 'draft');

  const handleCreateEntity = async () => {
    if (!newEntity.razon_social || !newEntity.nif || !newEntity.domicilio_fiscal) {
      toast({ variant: 'destructive', title: 'Error', description: 'Completa los campos obligatorios' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('legal_entities')
      .insert({
        group_id: group?.id,
        razon_social: newEntity.razon_social,
        nif: newEntity.nif,
        domicilio_fiscal: newEntity.domicilio_fiscal,
        cnae: newEntity.cnae || null,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear la entidad' });
    } else {
      toast({ title: 'Entidad creada', description: 'La entidad legal se ha creado correctamente' });
      setShowNewEntityDialog(false);
      setNewEntity({ razon_social: '', nif: '', domicilio_fiscal: '', cnae: '' });
      refreshData();
      if (data) setSelectedLegalEntity(data);
    }
  };

  const handleStartPayroll = async () => {
    if (!selectedLegalEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una entidad legal' });
      return;
    }

    if (currentRun) {
      // Continue existing run
      navigate('/payroll/employees');
      return;
    }

    setLoading(true);

    // Create new payroll run
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({
        group_id: group?.id,
        legal_entity_id: selectedLegalEntity.id,
        period_year: currentPeriod.year,
        period_month: currentPeriod.month,
        status: 'draft',
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo iniciar la nómina' });
    } else {
      toast({ title: 'Nómina iniciada', description: `Período ${format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}` });
      refreshData();
      navigate('/payroll/employees');
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
                      <Input 
                        value={newEntity.razon_social} 
                        onChange={(e) => setNewEntity({...newEntity, razon_social: e.target.value})}
                        placeholder="Restaurantes XYZ S.L."
                      />
                    </div>
                    <div>
                      <Label>NIF *</Label>
                      <Input 
                        value={newEntity.nif} 
                        onChange={(e) => setNewEntity({...newEntity, nif: e.target.value})}
                        placeholder="B12345678"
                      />
                    </div>
                    <div>
                      <Label>Domicilio Fiscal *</Label>
                      <Input 
                        value={newEntity.domicilio_fiscal} 
                        onChange={(e) => setNewEntity({...newEntity, domicilio_fiscal: e.target.value})}
                        placeholder="Calle Mayor 1, 28001 Madrid"
                      />
                    </div>
                    <div>
                      <Label>CNAE</Label>
                      <Input 
                        value={newEntity.cnae} 
                        onChange={(e) => setNewEntity({...newEntity, cnae: e.target.value})}
                        placeholder="5610 - Restaurantes"
                      />
                    </div>
                    <Button onClick={handleCreateEntity} disabled={loading} className="w-full">
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
            <p className="text-2xl font-bold">€{kpis.totalGross.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Neto Total</p>
            <p className="text-2xl font-bold text-success">€{kpis.totalNet.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">SS Empresa</p>
            <p className="text-2xl font-bold">€{kpis.totalEmployerSS.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">IRPF Total</p>
            <p className="text-2xl font-bold">€{kpis.totalIRPF.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Empleados</p>
            <p className="text-2xl font-bold">{kpis.employeeCount}</p>
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
                <Button onClick={handleStartPayroll} className="w-full">
                  Continuar con la nómina
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
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
                  Iniciar nómina del mes
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Issues Panel */}
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
                      issue.type === 'critical' ? 'bg-destructive/10' : 'bg-warning/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${
                        issue.type === 'critical' ? 'text-destructive' : 'text-warning'
                      }`} />
                      <span className="text-sm">{issue.message}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => navigate(`/payroll/${issue.action}`)}
                    >
                      Resolver
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Certificate Setup (for Sandbox mode) */}
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
              <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
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
    </div>
  );
}
