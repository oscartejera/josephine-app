import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, Users, FileText, AlertTriangle, CheckCircle, 
  Clock, Send, CreditCard, Building, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
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
  const { hasRole } = useAuth();
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
  const [schemaReady, setSchemaReady] = useState(false);
  
  const isPayrollAdmin = hasRole('owner_admin') || hasRole('owner') || hasRole('admin');
  const hasPayrollAccess = true;
  
  const currentStep = location.pathname.split('/payroll/')[1] || 'home';
  const stepIndex = PAYROLL_STEPS.findIndex(s => s.key === currentStep);
  
  // Core data fetching - uses explicit error checking (supabase-js doesn't throw)
  const fetchData = useCallback(async () => {
    if (!group?.id) return;
    setLoading(true);
    
    // 1. Fetch legal entities - CRITICAL: check error explicitly, not try/catch
    let entities: any[] = [];
    const { data: entitiesData, error: entitiesError } = await supabase
      .from('legal_entities')
      .select('*')
      .eq('group_id', group.id);
    
    if (entitiesError) {
      console.error('Error fetching entities:', entitiesError.message);
    } else {
      entities = entitiesData || [];
    }
    
    // Try to enrich with SSA data (non-blocking)
    if (entities.length > 0) {
      const { data: enriched, error: enrichErr } = await supabase
        .from('legal_entities')
        .select('*, social_security_accounts(*)')
        .eq('group_id', group.id);
      if (!enrichErr && enriched) {
        entities = enriched;
      }
    }
    
    setLegalEntities(entities);
    console.log(`[Payroll] Fetched ${entities.length} entities`);
    
    // 2. Determine active entity (use local var to avoid stale closure)
    let activeEntity = selectedLegalEntity;
    if (entities.length > 0 && !activeEntity) {
      activeEntity = entities[0];
      setSelectedLegalEntity(activeEntity);
    }
    // If selectedLegalEntity was set but might be stale, update it
    if (activeEntity && entities.length > 0) {
      const fresh = entities.find((e: any) => e.id === activeEntity.id);
      if (fresh) activeEntity = fresh;
    }
    
    // 3. Fetch payroll run for current entity + period
    if (activeEntity) {
      // Sandbox mode check
      const { data: tokens, error: tokErr } = await supabase
        .from('compliance_tokens')
        .select('id')
        .eq('legal_entity_id', activeEntity.id)
        .limit(1);
      setIsSandboxMode(tokErr || !tokens || tokens.length === 0);
      
      // Fetch current payroll run
      const { data: run, error: runErr } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('legal_entity_id', activeEntity.id)
        .eq('period_year', currentPeriod.year)
        .eq('period_month', currentPeriod.month)
        .maybeSingle();
      
      if (runErr) {
        console.error('[Payroll] Run fetch error:', runErr.message);
      }
      
      console.log(`[Payroll] Run for ${activeEntity.razon_social} ${currentPeriod.month}/${currentPeriod.year}:`, run ? `${run.id} (${run.status})` : 'none');
      setCurrentRun(run);
    } else {
      console.warn('[Payroll] No active entity, skipping run fetch');
      setCurrentRun(null);
    }
    
    setLoading(false);
  }, [group?.id, currentPeriod, selectedLegalEntity]);
  
  // Init: setup schema + fetch data
  useEffect(() => {
    if (!group?.id) return;
    
    const init = async () => {
      if (!schemaReady) {
        try {
          const { payrollApi } = await import('@/lib/payroll-api');
          await payrollApi.setup();
        } catch (err) {
          console.warn('Schema setup warning:', err);
        }
        setSchemaReady(true);
      }
      await fetchData();
    };
    init();
  }, [group?.id, currentPeriod, schemaReady]);
  
  const refreshData = async () => {
    await fetchData();
  };
  
  const navigateToStep = (step: string) => {
    navigate(`/payroll/${step === 'home' ? '' : step}`);
  };
  
  const getStepStatus = (stepKey: string): 'complete' | 'current' | 'upcoming' => {
    const stepIdx = PAYROLL_STEPS.findIndex(s => s.key === stepKey);
    
    if (!currentRun) {
      return stepIdx === 0 ? 'current' : 'upcoming';
    }
    
    const statusToStep: Record<string, number> = {
      'draft': 3,
      'validated': 4,
      'calculated': 5,
      'approved': 6,
      'submitted': 7,
      'paid': 8,
    };
    
    const completedUpTo = statusToStep[currentRun.status] || 0;
    
    if (stepIdx < completedUpTo) return 'complete';
    if (stepIdx === stepIndex) return 'current';
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
            <Button variant="link" className="text-warning p-0 h-auto ml-2" onClick={() => navigateToStep('home')}>
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
              const isClickable = currentRun || idx === 0;
              
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
