import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calculator, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Loader2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';
import { useTranslation } from 'react-i18next';

interface Payslip {
  id: string;
  employee_id: string;
  employee_name: string;
  gross_pay: number;
  employee_ss: number;
  employer_ss: number;
  irpf_withheld: number;
  other_deductions: number;
  net_pay: number;
  variation?: number;
}

export default function PayrollCalculate({
  
  currentPeriod,
  currentRun,
  refreshData,
}: PayrollContextData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);

  useEffect(() => {
    fetchPayslips();
  }, [currentRun]);

  const fetchPayslips = async () => {
    if (!currentRun) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Fetch payslips WITHOUT join (no FK guarantee)
    const { data: rawPayslips, error } = await supabase
      .from('payslips')
      .select('id, employee_id, gross_pay, employee_ss, employer_ss, irpf_withheld, other_deductions, net_pay')
      .eq('payroll_run_id', currentRun.id);
    
    if (error || !rawPayslips || rawPayslips.length === 0) {
      if (error) console.warn('Error fetching payslips:', error.message);
      setPayslips([]);
      setCalculated(false);
      setLoading(false);
      return;
    }
    
    // Fetch employee names separately
    const empIds = rawPayslips.map((p: any) => p.employee_id);
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name')
      .in('id', empIds);
    const empMap = new Map((employees || []).map((e: any) => [e.id, e.full_name]));
    
    const mapped: Payslip[] = rawPayslips.map((p: any) => ({
      id: p.id,
      employee_id: p.employee_id,
      employee_name: empMap.get(p.employee_id) || 'Desconocido',
      gross_pay: Number(p.gross_pay),
      employee_ss: Number(p.employee_ss),
      employer_ss: Number(p.employer_ss),
      irpf_withheld: Number(p.irpf_withheld),
      other_deductions: Number(p.other_deductions),
      net_pay: Number(p.net_pay),
      variation: 0,
    }));
    
    setPayslips(mapped);
    setCalculated(mapped.length > 0);
    setLoading(false);
  };

  const handleCalculate = async () => {
    if (!currentRun) {
      toast({ 
        variant: 'destructive', 
        title: t("common.error"), 
        description: 'No hay nómina iniciada para este período. Vuelve a Inicio y pulsa "Iniciar nómina del mes".' 
      });
      return;
    }
    
    setCalculating(true);
    
    try {
      const result = await payrollApi.calculatePayroll(currentRun.id);
      
      await refreshData();
      await fetchPayslips();
      
      setCalculated(true);
      toast({ 
        title: t('payroll.calculoCompletado'), 
        description: `Se han calculado ${result.employees_calculated || 0} nóminas. Total neto: €${result.totals?.net_pay?.toLocaleString('es-ES') || '0'}` 
      });
    } catch (error) {
      console.error('Payroll calculation error:', error);
      toast({ 
        variant: 'destructive', 
        title: t('payroll.errorAlCalcular'), 
        description: error instanceof Error ? error.message : t('payroll.calculateError') 
      });
    } finally {
      setCalculating(false);
    }
  };

  const totals = {
    gross: payslips.reduce((s, p) => s + p.gross_pay, 0),
    employeeSS: payslips.reduce((s, p) => s + p.employee_ss, 0),
    employerSS: payslips.reduce((s, p) => s + p.employer_ss, 0),
    irpf: payslips.reduce((s, p) => s + p.irpf_withheld, 0),
    net: payslips.reduce((s, p) => s + p.net_pay, 0),
  };

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('payroll.calculoDeNominas')}</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        
        {!calculated && !calculating && (
          <Button onClick={handleCalculate}>
            <Calculator className="h-4 w-4 mr-2" />{t('payroll.calcularNominas')}</Button>
        )}
        {calculated && (
          <Button onClick={handleCalculate} variant="outline">
            <Calculator className="h-4 w-4 mr-2" />
            Recalcular
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {calculated && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('payroll.totalBruto')}</p>
              <p className="text-2xl font-bold">€{fmt(totals.gross)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('payroll.ssEmpleado')}</p>
              <p className="text-2xl font-bold">€{fmt(totals.employeeSS)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">SS Empresa</p>
              <p className="text-2xl font-bold">€{fmt(totals.employerSS)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">IRPF</p>
              <p className="text-2xl font-bold">€{fmt(totals.irpf)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('payroll.totalNeto')}</p>
              <p className="text-2xl font-bold text-success">€{fmt(totals.net)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payslips Table */}
      {calculated && (
        <Card>
          <CardHeader>
            <CardTitle>{t('payroll.nominasCalculadas')}</CardTitle>
            <CardDescription>{payslips.length} empleados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payroll.empleado')}</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">SS Emp.</TableHead>
                  <TableHead className="text-right">IRPF</TableHead>
                  <TableHead className="text-right">Otras Ded.</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="text-right">€{fmt(p.gross_pay)}</TableCell>
                    <TableCell className="text-right">€{fmt(p.employee_ss)}</TableCell>
                    <TableCell className="text-right">€{fmt(p.irpf_withheld)}</TableCell>
                    <TableCell className="text-right">€{fmt(p.other_deductions)}</TableCell>
                    <TableCell className="text-right font-semibold">€{fmt(p.net_pay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Not calculated yet */}
      {!calculated && !calculating && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Listo para calcular</h3>
            <p className="text-muted-foreground mb-4">
              Pulsa "{t('payroll.calculatePayrolls')}" para generar los cálculos del período.
            </p>
            <Button onClick={handleCalculate} size="lg">
              <Calculator className="h-4 w-4 mr-2" />{t('payroll.calcularNominas')}</Button>
          </CardContent>
        </Card>
      )}

      {calculating && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
            <h3 className="text-lg font-medium">{t('payroll.calculandoNominas')}</h3>
            <p className="text-muted-foreground">{t('payroll.aplicandoLegislacionEspanolaVigente')}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/validate')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Validar
        </Button>
        <Button onClick={() => navigate('/payroll/review')} disabled={!calculated}>
          Siguiente: Revisar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
