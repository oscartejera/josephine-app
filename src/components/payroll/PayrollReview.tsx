import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Shield, AlertTriangle, Building, MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface LocationSummary {
  location_id: string;
  location_name: string;
  employee_count: number;
  total_gross: number;
  total_net: number;
  total_employer_ss: number;
}

export default function PayrollReview({
  selectedLegalEntity,
  currentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locations } = useApp();
  const { toast } = useToast();
  
  const [summaryByLocation, setSummaryByLocation] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [currentRun]);

  const fetchSummary = async () => {
    if (!currentRun) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const { data: payslips } = await supabase
      .from('payslips')
      .select(`
        gross_pay, net_pay, employer_ss, employee_id,
        employees(location_id)
      `)
      .eq('payroll_run_id', currentRun.id);
    
    // Group by location
    const locationMap = new Map<string, LocationSummary>();
    
    (payslips || []).forEach((p: any) => {
      const locId = p.employees?.location_id || 'unknown';
      const existing = locationMap.get(locId) || {
        location_id: locId,
        location_name: locations.find(l => l.id === locId)?.name || 'Sin asignar',
        employee_count: 0,
        total_gross: 0,
        total_net: 0,
        total_employer_ss: 0,
      };
      
      existing.employee_count++;
      existing.total_gross += Number(p.gross_pay);
      existing.total_net += Number(p.net_pay);
      existing.total_employer_ss += Number(p.employer_ss);
      
      locationMap.set(locId, existing);
    });
    
    setSummaryByLocation(Array.from(locationMap.values()));
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!currentRun || !user) return;
    
    setApproving(true);
    
    try {
      const { payrollApi } = await import('@/lib/payroll-api');
      await payrollApi.updateStatus(currentRun.id, 'approved', user.id);
      
      await refreshData();
      setApproving(false);
      setShowApproveDialog(false);
      
      toast({ title: 'Nóminas aprobadas', description: 'Puedes proceder a la presentación' });
      navigate('/payroll/submit');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudo aprobar' });
      setApproving(false);
    }
  };

  const totals = {
    employees: summaryByLocation.reduce((s, l) => s + l.employee_count, 0),
    gross: summaryByLocation.reduce((s, l) => s + l.total_gross, 0),
    net: summaryByLocation.reduce((s, l) => s + l.total_net, 0),
    employerSS: summaryByLocation.reduce((s, l) => s + l.total_employer_ss, 0),
  };

  const isApproved = currentRun?.status === 'approved' || currentRun?.status === 'submitted' || currentRun?.status === 'paid';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Revisión y Aprobación</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        
        {isApproved && (
          <Badge variant="default" className="flex items-center gap-1 text-sm py-1 px-3">
            <CheckCircle className="h-4 w-4" />
            Aprobado
          </Badge>
        )}
      </div>

      {/* Entity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Resumen por Entidad
          </CardTitle>
          <CardDescription>{selectedLegalEntity?.razon_social}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{totals.employees}</p>
              <p className="text-sm text-muted-foreground">Empleados</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{totals.gross.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Bruto</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{totals.net.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Neto</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{totals.employerSS.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">SS Empresa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Desglose por Local
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead className="text-center">Empleados</TableHead>
                <TableHead className="text-right">Total Bruto</TableHead>
                <TableHead className="text-right">Total Neto</TableHead>
                <TableHead className="text-right">SS Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryByLocation.map((loc) => (
                <TableRow key={loc.location_id}>
                  <TableCell className="font-medium">{loc.location_name}</TableCell>
                  <TableCell className="text-center">{loc.employee_count}</TableCell>
                  <TableCell className="text-right">€{loc.total_gross.toLocaleString()}</TableCell>
                  <TableCell className="text-right">€{loc.total_net.toLocaleString()}</TableCell>
                  <TableCell className="text-right">€{loc.total_employer_ss.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approval */}
      {!isApproved && isPayrollAdmin && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-medium">Aprobar Nóminas</h3>
                  <p className="text-sm text-muted-foreground">
                    Una vez aprobadas, podrás proceder a la presentación oficial.
                  </p>
                </div>
              </div>
              
              <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprobar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Aprobación</DialogTitle>
                    <DialogDescription>
                      ¿Estás seguro de que deseas aprobar las nóminas de {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}?
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-3 py-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empleados:</span>
                      <span className="font-medium">{totals.employees}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Bruto:</span>
                      <span className="font-medium">€{totals.gross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Neto:</span>
                      <span className="font-medium">€{totals.net.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleApprove} disabled={approving}>
                      Confirmar Aprobación
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {!isPayrollAdmin && !isApproved && (
        <Card className="border-warning">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <h3 className="font-medium">Aprobación Pendiente</h3>
                <p className="text-sm text-muted-foreground">
                  Solo un payroll_admin puede aprobar las nóminas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/calculate')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Calcular
        </Button>
        <Button 
          onClick={() => navigate('/payroll/submit')}
          disabled={!isApproved}
        >
          Siguiente: Presentar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
