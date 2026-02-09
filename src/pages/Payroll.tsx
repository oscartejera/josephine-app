import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, Users, FileText, AlertTriangle, CheckCircle, 
  Clock, Send, CreditCard, ArrowRight, Building, Calendar
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Sub-pages
import PayrollHome from '@/components/payroll/PayrollHome';
import PayrollEmployees from '@/components/payroll/PayrollEmployees';
import PayrollInputs from '@/components/payroll/PayrollInputs';
import PayrollValidate from '@/components/payroll/PayrollValidate';
import PayrollCalculate from '@/components/payroll/PayrollCalculate';
import PayrollReview from '@/components/payroll/PayrollReview';
import PayrollSubmit from '@/components/payroll/PayrollSubmit';
import PayrollPay from '@/components/payroll/PayrollPay';

export interface PayrollContextData {
  legalEntities: any[];
  selectedLegalEntity: any;
  setSelectedLegalEntity: (entity: any) => void;
  currentPeriod: { year: number; month: number };
  setCurrentPeriod: (period: { year: number; month: number }) => void;
  currentRun: any;
  refreshData: () => Promise<void>;
  isPayrollAdmin: boolean;
  isSandboxMode: boolean;
}

const PAYROLL_STEPS = [
  { key: 'home', label: 'Inicio', icon: Building },
  { key: 'employees', label: 'Empleados', icon: Users },
  { key: 'inputs', label: 'Variables', icon: FileText },
  { key: 'validate', label: 'Validar', icon: CheckCircle },
  { key: 'calculate', label: 'Calcular', icon: DollarSign },
  { key: 'review', label: 'Revisar', icon: Clock },
  { key: 'submit', label: 'Presentar', icon: Send },
  { key: 'pay', label: 'Pagar', icon: CreditCard },
];

export default function Payroll() {
  const { group } = useApp();
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [selectedLegalEntity, setSelectedLegalEntity] = useState<any>(null);
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  
  // Grant payroll access to owners, admins, and ops managers
  const isPayrollAdmin = hasRole('owner_admin') || hasRole('owner') || hasRole('admin');
  const hasPayrollAccess = true; // All authenticated users can view payroll (role checks inside for editing)
  
  const currentStep = location.pathname.split('/payroll/')[1] || 'home';
  const stepIndex = PAYROLL_STEPS.findIndex(s => s.key === currentStep);
  
  useEffect(() => {
    if (group?.id) {
      fetchData();
    }
  }, [group?.id, currentPeriod]);
  
  const fetchData = async () => {
    setLoading(true);
    
    // Fetch legal entities
    const { data: entities } = await supabase
      .from('legal_entities')
      .select('*, social_security_accounts(*), tax_accounts(*)')
      .eq('group_id', group?.id);
    
    setLegalEntities(entities || []);
    
    if (entities && entities.length > 0 && !selectedLegalEntity) {
      setSelectedLegalEntity(entities[0]);
    }
    
    // Check if we have compliance tokens (sandbox mode check)
    if (selectedLegalEntity) {
      const { data: tokens } = await supabase
        .from('compliance_tokens')
        .select('id')
        .eq('legal_entity_id', selectedLegalEntity?.id)
        .limit(1);
      
      setIsSandboxMode(!tokens || tokens.length === 0);
      
      // Fetch current payroll run
      const { data: run } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('legal_entity_id', selectedLegalEntity.id)
        .eq('period_year', currentPeriod.year)
        .eq('period_month', currentPeriod.month)
        .maybeSingle();
      
      setCurrentRun(run);
    }
    
    setLoading(false);
  };
  
  const refreshData = async () => {
    await fetchData();
  };
  
  const navigateToStep = (step: string) => {
    navigate(`/payroll/${step === 'home' ? '' : step}`);
  };
  
  const getStepStatus = (stepKey: string): 'complete' | 'current' | 'upcoming' => {
    const stepIdx = PAYROLL_STEPS.findIndex(s => s.key === stepKey);
    const currentIdx = stepIndex;
    
    if (!currentRun) {
      return stepIdx === 0 ? 'current' : 'upcoming';
    }
    
    const statusOrder = ['draft', 'validated', 'calculated', 'approved', 'submitted', 'paid'];
    const runStatusIdx = statusOrder.indexOf(currentRun.status);
    
    // Map status to step
    const statusToStep: Record<string, number> = {
      'draft': 3, // validate
      'validated': 4, // calculate
      'calculated': 5, // review
      'approved': 6, // submit
      'submitted': 7, // pay
      'paid': 8, // done
    };
    
    const completedUpTo = statusToStep[currentRun.status] || 0;
    
    if (stepIdx < completedUpTo) return 'complete';
    if (stepIdx === currentIdx) return 'current';
    return 'upcoming';
  };
  
  if (!hasPayrollAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">
              No tienes permisos para acceder al módulo de nóminas.
              Contacta con un administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const contextData: PayrollContextData = {
    legalEntities,
    selectedLegalEntity,
    setSelectedLegalEntity,
    currentPeriod,
    setCurrentPeriod,
    currentRun,
    refreshData,
    isPayrollAdmin,
    isSandboxMode,
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Nóminas</h1>
          <p className="text-muted-foreground">
            Gestión de nóminas y presentaciones oficiales (España)
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {isSandboxMode && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
              Modo Sandbox
            </Badge>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
            </span>
          </div>
        </div>
      </div>
      
      {/* Sandbox Alert */}
      {isSandboxMode && (
        <Alert className="border-warning bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Modo Sandbox activo:</strong> No hay certificados configurados. 
            Las presentaciones se simularán sin envío real a TGSS/AEAT/SEPE.
            <Button 
              variant="link" 
              className="text-warning p-0 h-auto ml-2"
              onClick={() => navigateToStep('home')}
            >
              Configurar certificados →
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Progress Steps */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {PAYROLL_STEPS.map((step, idx) => {
              const status = getStepStatus(step.key);
              const isClickable = idx <= stepIndex + 1 || status === 'complete';
              
              return (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => isClickable && navigateToStep(step.key)}
                    disabled={!isClickable}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all
                      ${status === 'complete' ? 'bg-success text-success-foreground' : ''}
                      ${status === 'current' ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' : ''}
                      ${status === 'upcoming' ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      {status === 'complete' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      status === 'current' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </button>
                  
                  {idx < PAYROLL_STEPS.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 ${
                      status === 'complete' ? 'bg-success' : 'bg-muted'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Content */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Routes>
            <Route index element={<PayrollHome {...contextData} />} />
            <Route path="employees" element={<PayrollEmployees {...contextData} />} />
            <Route path="inputs" element={<PayrollInputs {...contextData} />} />
            <Route path="validate" element={<PayrollValidate {...contextData} />} />
            <Route path="calculate" element={<PayrollCalculate {...contextData} />} />
            <Route path="review" element={<PayrollReview {...contextData} />} />
            <Route path="submit" element={<PayrollSubmit {...contextData} />} />
            <Route path="pay" element={<PayrollPay {...contextData} />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
