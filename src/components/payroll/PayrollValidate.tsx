import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, AlertTriangle, XCircle, ArrowRight, ArrowLeft, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface ValidationItem {
  id: string;
  category: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'pass' | 'fail';
  details?: string;
  action?: string;
}

export default function PayrollValidate({
  selectedLegalEntity,
  currentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    runValidation();
  }, [currentPeriod, selectedLegalEntity]);

  const runValidation = async () => {
    setLoading(true);
    
    const results: ValidationItem[] = [];
    
    // Check employees without NIF/NSS
    const { data: employeeLegal } = await supabase
      .from('employee_legal')
      .select('employee_id, nif, nss, iban')
      .eq('legal_entity_id', selectedLegalEntity?.id);
    
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('active', true);
    
    const legalMap = new Map((employeeLegal || []).map(l => [l.employee_id, l]));
    const missingNif = (employees || []).filter(e => !legalMap.get(e.id)?.nif);
    const missingNss = (employees || []).filter(e => !legalMap.get(e.id)?.nss);
    const missingIban = (employees || []).filter(e => !legalMap.get(e.id)?.iban);
    
    results.push({
      id: 'nif',
      category: 'Datos Legales',
      description: 'Empleados con NIF',
      severity: 'critical',
      status: missingNif.length === 0 ? 'pass' : 'fail',
      details: missingNif.length > 0 ? `${missingNif.length} empleado(s) sin NIF: ${missingNif.map(e => e.full_name).join(', ')}` : undefined,
      action: 'employees',
    });
    
    results.push({
      id: 'nss',
      category: 'Datos Legales',
      description: 'Empleados con NSS',
      severity: 'critical',
      status: missingNss.length === 0 ? 'pass' : 'fail',
      details: missingNss.length > 0 ? `${missingNss.length} empleado(s) sin NSS` : undefined,
      action: 'employees',
    });
    
    results.push({
      id: 'iban',
      category: 'Datos Bancarios',
      description: 'Empleados con IBAN',
      severity: 'warning',
      status: missingIban.length === 0 ? 'pass' : 'fail',
      details: missingIban.length > 0 ? `${missingIban.length} empleado(s) sin IBAN (no se podrá generar SEPA)` : undefined,
      action: 'employees',
    });
    
    // Check active contracts
    const { data: contracts } = await supabase
      .from('employment_contracts')
      .select('employee_id')
      .eq('legal_entity_id', selectedLegalEntity?.id)
      .eq('active', true);
    
    const contractSet = new Set((contracts || []).map(c => c.employee_id));
    const missingContract = (employees || []).filter(e => !contractSet.has(e.id));
    
    results.push({
      id: 'contracts',
      category: 'Contratos',
      description: 'Contratos activos',
      severity: 'critical',
      status: missingContract.length === 0 ? 'pass' : 'fail',
      details: missingContract.length > 0 ? `${missingContract.length} empleado(s) sin contrato activo` : undefined,
      action: 'employees',
    });
    
    // Check pending timesheets
    const startDate = new Date(currentPeriod.year, currentPeriod.month - 1, 1);
    const endDate = new Date(currentPeriod.year, currentPeriod.month, 0);
    
    const { data: pendingTs } = await supabase
      .from('timesheets')
      .select('id')
      .eq('approved', false)
      .gte('clock_in', startDate.toISOString())
      .lte('clock_in', endDate.toISOString());
    
    results.push({
      id: 'timesheets',
      category: 'Timesheets',
      description: 'Timesheets aprobados',
      severity: 'warning',
      status: (pendingTs?.length || 0) === 0 ? 'pass' : 'fail',
      details: (pendingTs?.length || 0) > 0 ? `${pendingTs?.length} timesheet(s) pendientes de aprobar` : undefined,
      action: 'inputs',
    });
    
    // Check payroll inputs exist
    const { data: inputs } = await supabase
      .from('payroll_inputs')
      .select('id')
      .eq('period_year', currentPeriod.year)
      .eq('period_month', currentPeriod.month);
    
    results.push({
      id: 'inputs',
      category: 'Variables',
      description: 'Variables del mes cargadas',
      severity: 'warning',
      status: (inputs?.length || 0) > 0 ? 'pass' : 'fail',
      details: (inputs?.length || 0) === 0 ? 'No hay variables cargadas para este período' : undefined,
      action: 'inputs',
    });
    
    // Check entity has CCC
    results.push({
      id: 'ccc',
      category: 'Entidad',
      description: 'Código Cuenta Cotización',
      severity: 'critical',
      status: (selectedLegalEntity?.social_security_accounts?.length || 0) > 0 ? 'pass' : 'fail',
      details: (selectedLegalEntity?.social_security_accounts?.length || 0) === 0 ? 'La entidad no tiene CCC configurado' : undefined,
    });
    
    setValidations(results);
    setLoading(false);
  };

  const handleValidate = async () => {
    const criticalFails = validations.filter(v => v.severity === 'critical' && v.status === 'fail');
    
    if (criticalFails.length > 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Validación fallida', 
        description: 'Hay errores críticos que deben resolverse antes de continuar' 
      });
      return;
    }
    
    setValidating(true);
    
    // Update run status to validated
    if (currentRun) {
      await supabase
        .from('payroll_runs')
        .update({ status: 'validated' })
        .eq('id', currentRun.id);
    }
    
    await refreshData();
    setValidating(false);
    
    toast({ title: 'Validación completada', description: 'Puedes proceder al cálculo' });
    navigate('/payroll/calculate');
  };

  const passCount = validations.filter(v => v.status === 'pass').length;
  const progress = validations.length > 0 ? (passCount / validations.length) * 100 : 0;
  const criticalFails = validations.filter(v => v.severity === 'critical' && v.status === 'fail');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Validación Pre-Cálculo</h2>
              <p className="text-sm text-muted-foreground">
                {passCount} de {validations.length} comprobaciones pasadas
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={runValidation}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Revalidar
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Validation Items */}
      <div className="space-y-4">
        {['critical', 'warning', 'info'].map(severity => {
          const items = validations.filter(v => v.severity === severity);
          if (items.length === 0) return null;
          
          return (
            <Card key={severity}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {severity === 'critical' && <XCircle className="h-5 w-5 text-destructive" />}
                  {severity === 'warning' && <AlertTriangle className="h-5 w-5 text-warning" />}
                  {severity === 'info' && <CheckCircle className="h-5 w-5 text-info" />}
                  {severity === 'critical' && 'Crítico'}
                  {severity === 'warning' && 'Advertencias'}
                  {severity === 'info' && 'Información'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map(item => (
                    <div 
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        item.status === 'pass' ? 'bg-success/5' : 
                        item.severity === 'critical' ? 'bg-destructive/5' : 'bg-warning/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.status === 'pass' ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : item.severity === 'critical' ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-warning" />
                        )}
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.details && (
                            <p className="text-sm text-muted-foreground">{item.details}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.status === 'pass' ? 'default' : 'secondary'}>
                          {item.category}
                        </Badge>
                        {item.action && item.status === 'fail' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/payroll/${item.action}`)}
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/inputs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Variables
        </Button>
        <Button 
          onClick={handleValidate}
          disabled={criticalFails.length > 0 || validating}
        >
          {criticalFails.length > 0 ? 'Resolver errores críticos' : 'Validar y Continuar'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
