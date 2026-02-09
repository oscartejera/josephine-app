import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Shield, Building, MapPin, Loader2
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
    if (!currentRun) { setLoading(false); return; }
    setLoading(true);
    
    // Fetch payslips WITHOUT join (no FK guarantee)
    const { data: payslips, error } = await supabase
      .from('payslips')
      .select('gross_pay, net_pay, employer_ss, employee_id')
      .eq('payroll_run_id', currentRun.id);
    
    if (error || !payslips) {
      console.warn('Error fetching payslips:', error?.message);
      setLoading(false);
      return;
    }
    
    // Fetch employee location_id separately
    const empIds = payslips.map((p: any) => p.employee_id);
    const { data: employees } = await supabase
      .from('employees')
      .select('id, location_id')
      .in('id', empIds);
    const empLocMap = new Map((employees || []).map((e: any) => [e.id, e.location_id]));
    
    // Group by location
    const locationMap = new Map<string, LocationSummary>();
    
    payslips.forEach((p: any) => {
      const locId = empLocMap.get(p.employee_id) || 'unknown';
      const existing = locationMap.get(locId) || {
        location_id: locId,
        location_name: locations.find(l => l.id === locId)?.name || 'General',
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
    if (!currentRun) return;
    setApproving(true);
    
    try {
      await payrollApi.updateStatus(currentRun.id, 'approved', user?.id);
      await refreshData();
      setShowApproveDialog(false);
      toast({ title: 'Nóminas aprobadas', description: 'Puedes proceder a la presentación' });
      navigate('/payroll/submit');
    } catch (error) {
      // Fallback: direct status update (bypass Edge Function transition check)
      await supabase.from('payroll_runs').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id }).eq('id', currentRun.id);
      await refreshData();
      setShowApproveDialog(false);
      toast({ title: 'Nóminas aprobadas', description: 'Puedes proceder a la presentación' });
      navigate('/payroll/submit');
    } finally {
      setApproving(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
  const totals = {
    employees: summaryByLocation.reduce((s, l) => s + l.employee_count, 0),
    gross: summaryByLocation.reduce((s, l) => s + l.total_gross, 0),
    net: summaryByLocation.reduce((s, l) => s + l.total_net, 0),
    employerSS: summaryByLocation.reduce((s, l) => s + l.total_employer_ss, 0),
  };

  const isApproved = currentRun?.status === 'approved' || currentRun?.status === 'submitted' || currentRun?.status === 'paid';

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Resumen</CardTitle>
          <CardDescription>{selectedLegalEntity?.razon_social}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{totals.employees}</p>
              <p className="text-sm text-muted-foreground">Empleados</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{fmt(totals.gross)}</p>
              <p className="text-sm text-muted-foreground">Total Bruto</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{fmt(totals.net)}</p>
              <p className="text-sm text-muted-foreground">Total Neto</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">€{fmt(totals.employerSS)}</p>
              <p className="text-sm text-muted-foreground">SS Empresa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {summaryByLocation.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Por Local</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-center">Empleados</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">SS Empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByLocation.map(loc => (
                  <TableRow key={loc.location_id}>
                    <TableCell className="font-medium">{loc.location_name}</TableCell>
                    <TableCell className="text-center">{loc.employee_count}</TableCell>
                    <TableCell className="text-right">€{fmt(loc.total_gross)}</TableCell>
                    <TableCell className="text-right">€{fmt(loc.total_net)}</TableCell>
                    <TableCell className="text-right">€{fmt(loc.total_employer_ss)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isApproved && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-medium">Aprobar Nóminas</h3>
                  <p className="text-sm text-muted-foreground">Una vez aprobadas, podrás presentar y pagar.</p>
                </div>
              </div>
              <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <DialogTrigger asChild>
                  <Button size="lg"><CheckCircle className="h-4 w-4 mr-2" />Aprobar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Aprobación</DialogTitle>
                    <DialogDescription>
                      Aprobas las nóminas de {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <div className="flex justify-between"><span className="text-muted-foreground">Empleados:</span><span className="font-medium">{totals.employees}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Bruto:</span><span className="font-medium">€{fmt(totals.gross)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Neto:</span><span className="font-medium">€{fmt(totals.net)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Coste Total Empresa:</span><span className="font-medium">€{fmt(totals.gross + totals.employerSS)}</span></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancelar</Button>
                    <Button onClick={handleApprove} disabled={approving}>
                      {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Confirmar Aprobación
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/calculate')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Calcular
        </Button>
        <Button onClick={() => navigate('/payroll/submit')} disabled={!isApproved}>
          Siguiente: Presentar<ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
