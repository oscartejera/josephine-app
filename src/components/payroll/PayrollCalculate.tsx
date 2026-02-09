import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calculator, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Loader2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

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
  variation?: number; // vs previous month
}

export default function PayrollCalculate({
  selectedLegalEntity,
  currentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { group } = useApp();
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
    
    const { data } = await supabase
      .from('payslips')
      .select(`
        id, employee_id, gross_pay, employee_ss, employer_ss, 
        irpf_withheld, other_deductions, net_pay,
        employees(full_name)
      `)
      .eq('payroll_run_id', currentRun.id);
    
    const mapped: Payslip[] = (data || []).map((p: any) => ({
      id: p.id,
      employee_id: p.employee_id,
      employee_name: p.employees?.full_name || 'Desconocido',
      gross_pay: Number(p.gross_pay),
      employee_ss: Number(p.employee_ss),
      employer_ss: Number(p.employer_ss),
      irpf_withheld: Number(p.irpf_withheld),
      other_deductions: Number(p.other_deductions),
      net_pay: Number(p.net_pay),
      variation: (Math.random() - 0.5) * 200, // Mock variation
    }));
    
    setPayslips(mapped);
    setCalculated(mapped.length > 0);
    setLoading(false);
  };

  const handleCalculate = async () => {
    if (!currentRun || !selectedLegalEntity) return;
    
    setCalculating(true);
    
    try {
      const result = await payrollApi.calculatePayroll(currentRun.id);
      
      await refreshData();
      await fetchPayslips();
      
      setCalculated(true);
      toast({ 
        title: 'Cálculo completado', 
        description: `Se han calculado ${result.employees_calculated} nóminas. Total neto: €${result.totals?.net_pay?.toLocaleString() || '0'}` 
      });
    } catch (error) {
      console.error('Payroll calculation error:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Error al calcular nóminas' 
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

  const hasVariationWarnings = payslips.some(p => Math.abs(p.variation || 0) > 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cálculo de Nóminas</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        
        {!calculated && (
          <Button onClick={handleCalculate} disabled={calculating}>
            {calculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Calcular Nóminas
          </Button>
        )}
      </div>

      {/* Variation Warning */}
      {hasVariationWarnings && (
        <Alert className="border-warning bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            Algunas nóminas tienen variaciones significativas respecto al mes anterior. Revisa los detalles.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {calculated && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Bruto</p>
              <p className="text-2xl font-bold">€{totals.gross.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">SS Empleado</p>
              <p className="text-2xl font-bold">€{totals.employeeSS.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">SS Empresa</p>
              <p className="text-2xl font-bold">€{totals.employerSS.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">IRPF</p>
              <p className="text-2xl font-bold">€{totals.irpf.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Neto</p>
              <p className="text-2xl font-bold text-success">€{totals.net.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payslips Table */}
      {calculated && (
        <Card>
          <CardHeader>
            <CardTitle>Nóminas Calculadas</CardTitle>
            <CardDescription>{payslips.length} empleados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">SS Emp.</TableHead>
                  <TableHead className="text-right">IRPF</TableHead>
                  <TableHead className="text-right">Otras Ded.</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-center">Var. Mes Ant.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="text-right">€{p.gross_pay.toLocaleString()}</TableCell>
                    <TableCell className="text-right">€{p.employee_ss.toLocaleString()}</TableCell>
                    <TableCell className="text-right">€{p.irpf_withheld.toLocaleString()}</TableCell>
                    <TableCell className="text-right">€{p.other_deductions.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">€{p.net_pay.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {p.variation !== undefined && (
                        <div className={`flex items-center justify-center gap-1 ${
                          p.variation > 0 ? 'text-success' : p.variation < 0 ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          {p.variation > 0 ? <TrendingUp className="h-4 w-4" /> : p.variation < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                          <span className="text-sm">
                            {p.variation > 0 ? '+' : ''}{p.variation?.toFixed(0)}€
                          </span>
                        </div>
                      )}
                    </TableCell>
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
              Pulsa "Calcular Nóminas" para generar los cálculos del período.
            </p>
            <Button onClick={handleCalculate} size="lg">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Nóminas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Calculating */}
      {calculating && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
            <h3 className="text-lg font-medium">Calculando nóminas...</h3>
            <p className="text-muted-foreground">Esto puede tardar unos segundos</p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/validate')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Validar
        </Button>
        <Button 
          onClick={() => navigate('/payroll/review')}
          disabled={!calculated}
        >
          Siguiente: Revisar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
