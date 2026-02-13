import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, 
  Edit, FileText, Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface Employee {
  id: string;
  full_name: string;
  role_name: string | null;
  location_id: string;
  employee_legal?: Array<{
    nif: string | null;
    nss: string | null;
    iban: string | null;
  }>;
  employment_contracts?: Array<{
    id: string;
    contract_type: string;
    base_salary_monthly: number;
    active: boolean;
  }>;
}

export default function PayrollEmployees({
  selectedLegalEntity,
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { selectedLocationId, locations } = useApp();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [legalData, setLegalData] = useState({ nif: '', nss: '', iban: '', domicilio: '' });
  const [contractData, setContractData] = useState({
    contract_type: 'indefinido',
    base_salary_monthly: '',
    group_ss: '5',
    category: 'Camarero',
    jornada_pct: '100',
    irpf_rate: '15',
  });

  useEffect(() => {
    fetchEmployees();
  }, [selectedLegalEntity]);

  const fetchEmployees = async () => {
    setLoading(true);
    
    // Only fetch employees from this group's locations
    const locationIds = locations.map(l => l.id);
    if (locationIds.length === 0) { setLoading(false); return; }

    try {
      // Try full query with joins first
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id, full_name, role_name, location_id,
          employee_legal(nif, nss, iban),
          employment_contracts(id, contract_type, base_salary_monthly, active)
        `)
        .eq('active', true)
        .in('location_id', locationIds)
        .order('full_name');

      if (!error && data) {
        setEmployees((data as Employee[]) || []);
      } else {
        // Fallback: fetch employees without joins (tables might not exist yet)
        console.warn('Full query failed, fetching employees without joins:', error?.message);
        const { data: basicData } = await supabase
          .from('employees')
          .select('id, full_name, role_name, location_id')
          .eq('active', true)
          .in('location_id', locationIds)
          .order('full_name');
        
        setEmployees((basicData || []).map(e => ({
          ...e,
          employee_legal: [],
          employment_contracts: [],
        })) as Employee[]);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    }
    
    setLoading(false);
  };

  const getEmployeeStatus = (emp: Employee): 'ok' | 'missing-legal' | 'missing-contract' | 'missing-iban' => {
    const legalArr = emp.employee_legal || [];
    const legal = legalArr[0];
    const contracts = emp.employment_contracts || [];
    const activeContract = contracts.find(c => c.active);
    
    if (!legal?.nif || !legal?.nss) return 'missing-legal';
    if (!activeContract) return 'missing-contract';
    if (!legal?.iban) return 'missing-iban';
    return 'ok';
  };

  const handleSaveLegalData = async () => {
    if (!editingEmployee || !selectedLegalEntity) return;

    try {
      await payrollApi.saveEmployeeLegal(editingEmployee.id, selectedLegalEntity.id, {
        nif: legalData.nif || undefined,
        nss: legalData.nss || undefined,
        iban: legalData.iban || undefined,
        domicilio: legalData.domicilio || undefined,
      });
      toast({ title: 'Guardado', description: 'Datos legales actualizados' });
      fetchEmployees();
      setEditingEmployee(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudieron guardar los datos' });
    }
  };

  const handleCreateContract = async () => {
    if (!editingEmployee || !selectedLegalEntity) return;

    try {
      const result = await payrollApi.createContract(
        editingEmployee.id,
        selectedLegalEntity.id,
        editingEmployee.location_id,
        {
          contract_type: contractData.contract_type,
          base_salary_monthly: contractData.base_salary_monthly,
          group_ss: contractData.group_ss,
          category: contractData.category,
          jornada_pct: contractData.jornada_pct,
          irpf_rate: contractData.irpf_rate,
        }
      );
      const irpfMsg = result.auto_irpf_rate ? ` (IRPF auto: ${result.auto_irpf_rate}%)` : '';
      toast({ title: 'Contrato creado', description: `El contrato se ha creado correctamente${irpfMsg}` });
      fetchEmployees();
      setEditingEmployee(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudo crear el contrato' });
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    ok: employees.filter(e => getEmployeeStatus(e) === 'ok').length,
    issues: employees.filter(e => getEmployeeStatus(e) !== 'ok').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <span>{statusCounts.ok} listos</span>
          </div>
          {statusCounts.issues > 0 && (
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span>{statusCounts.issues} con datos pendientes</span>
            </div>
          )}
        </div>
        
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar empleado..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Empleados y Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>NSS</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Salario</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const status = getEmployeeStatus(emp);
                const legal = (emp.employee_legal || [])[0];
                const contract = emp.employment_contracts?.find(c => c.active);
                
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>{emp.role_name || '-'}</TableCell>
                    <TableCell>
                      {legal?.nif ? (
                        <span className="font-mono text-sm">{legal.nif}</span>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Falta</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {legal?.nss ? (
                        <span className="font-mono text-sm">{legal.nss}</span>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Falta</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {legal?.iban ? (
                        <span className="font-mono text-sm">{legal.iban.slice(-4).padStart(legal.iban.length, '•')}</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Falta</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {contract ? (
                        <Badge variant="outline">{contract.contract_type}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Sin contrato</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {contract ? `€${contract.base_salary_monthly.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {status === 'ok' ? (
                        <CheckCircle className="h-5 w-5 text-success mx-auto" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning mx-auto" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setLegalData({
                                nif: legal?.nif || '',
                                nss: legal?.nss || '',
                                iban: legal?.iban || '',
                                domicilio: '',
                              });
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Editar: {emp.full_name}</DialogTitle>
                          </DialogHeader>
                          
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Legal Data */}
                            <div className="space-y-4">
                              <h4 className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Datos Legales
                              </h4>
                              <div>
                                <Label>NIF *</Label>
                                <Input 
                                  value={legalData.nif}
                                  onChange={(e) => setLegalData({...legalData, nif: e.target.value})}
                                  placeholder="12345678A"
                                />
                              </div>
                              <div>
                                <Label>NSS (Nº Seguridad Social) *</Label>
                                <Input 
                                  value={legalData.nss}
                                  onChange={(e) => setLegalData({...legalData, nss: e.target.value})}
                                  placeholder="281234567890"
                                />
                              </div>
                              <div>
                                <Label>IBAN</Label>
                                <Input 
                                  value={legalData.iban}
                                  onChange={(e) => setLegalData({...legalData, iban: e.target.value})}
                                  placeholder="ES1234567890123456789012"
                                />
                              </div>
                              <div>
                                <Label>Domicilio</Label>
                                <Input 
                                  value={legalData.domicilio}
                                  onChange={(e) => setLegalData({...legalData, domicilio: e.target.value})}
                                  placeholder="Calle Mayor 1, 28001 Madrid"
                                />
                              </div>
                              <Button onClick={handleSaveLegalData} className="w-full" disabled={!isPayrollAdmin}>
                                Guardar Datos Legales
                              </Button>
                            </div>

                            {/* Contract */}
                            <div className="space-y-4">
                              <h4 className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                {contract ? 'Contrato Activo' : 'Crear Contrato'}
                              </h4>
                              <div>
                                <Label>Tipo de Contrato</Label>
                                <Select 
                                  value={contractData.contract_type}
                                  onValueChange={(v) => setContractData({...contractData, contract_type: v})}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="indefinido">Indefinido</SelectItem>
                                    <SelectItem value="temporal">Temporal</SelectItem>
                                    <SelectItem value="formacion">Formación</SelectItem>
                                    <SelectItem value="practicas">Prácticas</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Salario Base Mensual (€)</Label>
                                <Input 
                                  type="number"
                                  value={contractData.base_salary_monthly}
                                  onChange={(e) => setContractData({...contractData, base_salary_monthly: e.target.value})}
                                  placeholder="1500"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Grupo SS</Label>
                                  <Select 
                                    value={contractData.group_ss}
                                    onValueChange={(v) => setContractData({...contractData, group_ss: v})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1,2,3,4,5,6,7,8,9,10,11].map(g => (
                                        <SelectItem key={g} value={g.toString()}>Grupo {g}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>% Jornada</Label>
                                  <Input 
                                    type="number"
                                    value={contractData.jornada_pct}
                                    onChange={(e) => setContractData({...contractData, jornada_pct: e.target.value})}
                                    placeholder="100"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>% IRPF (manual)</Label>
                                <Input 
                                  type="number"
                                  value={contractData.irpf_rate}
                                  onChange={(e) => setContractData({...contractData, irpf_rate: e.target.value})}
                                  placeholder="15"
                                />
                              </div>
                              {!contract && (
                                <Button onClick={handleCreateContract} className="w-full" disabled={!isPayrollAdmin}>
                                  Crear Contrato
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <Button onClick={() => navigate('/payroll/inputs')}>
          Siguiente: Variables del Mes
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
