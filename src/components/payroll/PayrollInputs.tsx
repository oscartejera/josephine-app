import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Clock, ArrowRight, ArrowLeft, Download, Edit, Plus, Trash2, Save
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

interface PayrollInput {
  id: string;
  employee_id: string;
  employee_name: string;
  hours_regular: number;
  hours_night: number;
  hours_holiday: number;
  hours_overtime: number;
  bonuses: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
}

export default function PayrollInputs({
  selectedLegalEntity,
  currentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { selectedLocationId } = useApp();
  const { toast } = useToast();
  
  const [inputs, setInputs] = useState<PayrollInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInput, setEditingInput] = useState<PayrollInput | null>(null);
  const [pullLoading, setPullLoading] = useState(false);

  useEffect(() => {
    fetchInputs();
  }, [currentPeriod]);

  const fetchInputs = async () => {
    setLoading(true);
    
    // Fetch employees and their inputs for this period
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('active', true);
    
    const { data: existingInputs } = await supabase
      .from('payroll_inputs')
      .select('*')
      .eq('period_year', currentPeriod.year)
      .eq('period_month', currentPeriod.month);
    
    const inputsMap = new Map((existingInputs || []).map(i => [i.employee_id, i]));
    
    const merged: PayrollInput[] = (employees || []).map(emp => {
      const existing = inputsMap.get(emp.id);
      return {
        id: existing?.id || '',
        employee_id: emp.id,
        employee_name: emp.full_name,
        hours_regular: Number(existing?.hours_regular) || 0,
        hours_night: Number(existing?.hours_night) || 0,
        hours_holiday: Number(existing?.hours_holiday) || 0,
        hours_overtime: Number(existing?.hours_overtime) || 0,
        bonuses: (Array.isArray(existing?.bonuses_json) ? existing.bonuses_json : []) as { name: string; amount: number }[],
        deductions: (Array.isArray(existing?.deductions_json) ? existing.deductions_json : []) as { name: string; amount: number }[],
      };
    });
    
    setInputs(merged);
    setLoading(false);
  };

  const handlePullTimesheets = async () => {
    setPullLoading(true);
    
    // Get approved timesheets for this period
    const startDate = new Date(currentPeriod.year, currentPeriod.month - 1, 1);
    const endDate = new Date(currentPeriod.year, currentPeriod.month, 0);
    
    const { data: timesheets } = await supabase
      .from('timesheets')
      .select('employee_id, minutes, clock_in')
      .eq('approved', true)
      .gte('clock_in', startDate.toISOString())
      .lte('clock_in', endDate.toISOString());
    
    // Aggregate by employee
    const hoursMap = new Map<string, number>();
    (timesheets || []).forEach(ts => {
      const hours = (ts.minutes || 0) / 60;
      hoursMap.set(ts.employee_id, (hoursMap.get(ts.employee_id) || 0) + hours);
    });
    
    // Update inputs
    const updatedInputs = inputs.map(input => ({
      ...input,
      hours_regular: hoursMap.get(input.employee_id) || input.hours_regular,
    }));
    
    setInputs(updatedInputs);
    
    toast({ title: 'Horas importadas', description: `Se importaron ${timesheets?.length || 0} registros` });
    setPullLoading(false);
  };

  const handleSaveInput = async (input: PayrollInput) => {
    const payload = {
      employee_id: input.employee_id,
      period_year: currentPeriod.year,
      period_month: currentPeriod.month,
      hours_regular: input.hours_regular,
      hours_night: input.hours_night,
      hours_holiday: input.hours_holiday,
      hours_overtime: input.hours_overtime,
      bonuses_json: input.bonuses,
      deductions_json: input.deductions,
    };

    let error;
    if (input.id) {
      const result = await supabase
        .from('payroll_inputs')
        .update(payload)
        .eq('id', input.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('payroll_inputs')
        .insert(payload);
      error = result.error;
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar' });
    } else {
      toast({ title: 'Guardado', description: 'Variables actualizadas' });
      fetchInputs();
      setEditingInput(null);
    }
  };

  const totalHours = inputs.reduce((sum, i) => sum + i.hours_regular + i.hours_night + i.hours_holiday + i.hours_overtime, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Variables del Mes</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        
        <Button variant="outline" onClick={handlePullTimesheets} disabled={pullLoading}>
          <Download className="h-4 w-4 mr-2" />
          Importar Timesheets Aprobados
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Horas Regulares</p>
            <p className="text-2xl font-bold">{inputs.reduce((s, i) => s + i.hours_regular, 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Horas Nocturnas</p>
            <p className="text-2xl font-bold">{inputs.reduce((s, i) => s + i.hours_night, 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Horas Festivos</p>
            <p className="text-2xl font-bold">{inputs.reduce((s, i) => s + i.hours_holiday, 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Horas Extra</p>
            <p className="text-2xl font-bold">{inputs.reduce((s, i) => s + i.hours_overtime, 0).toFixed(1)}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Inputs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horas y Complementos por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">H. Regulares</TableHead>
                <TableHead className="text-right">H. Nocturnas</TableHead>
                <TableHead className="text-right">H. Festivos</TableHead>
                <TableHead className="text-right">H. Extra</TableHead>
                <TableHead className="text-center">Bonos</TableHead>
                <TableHead className="text-center">Deducciones</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inputs.map((input) => (
                <TableRow key={input.employee_id}>
                  <TableCell className="font-medium">{input.employee_name}</TableCell>
                  <TableCell className="text-right">{input.hours_regular.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{input.hours_night.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{input.hours_holiday.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{input.hours_overtime.toFixed(1)}</TableCell>
                  <TableCell className="text-center">
                    {input.bonuses.length > 0 ? (
                      <Badge variant="secondary">{input.bonuses.length}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {input.deductions.length > 0 ? (
                      <Badge variant="secondary">{input.deductions.length}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditingInput({ ...input })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar: {input.employee_name}</DialogTitle>
                        </DialogHeader>
                        
                        {editingInput && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Horas Regulares</Label>
                                <Input 
                                  type="number"
                                  step="0.5"
                                  value={editingInput.hours_regular}
                                  onChange={(e) => setEditingInput({
                                    ...editingInput,
                                    hours_regular: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div>
                                <Label>Horas Nocturnas</Label>
                                <Input 
                                  type="number"
                                  step="0.5"
                                  value={editingInput.hours_night}
                                  onChange={(e) => setEditingInput({
                                    ...editingInput,
                                    hours_night: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div>
                                <Label>Horas Festivos</Label>
                                <Input 
                                  type="number"
                                  step="0.5"
                                  value={editingInput.hours_holiday}
                                  onChange={(e) => setEditingInput({
                                    ...editingInput,
                                    hours_holiday: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div>
                                <Label>Horas Extra</Label>
                                <Input 
                                  type="number"
                                  step="0.5"
                                  value={editingInput.hours_overtime}
                                  onChange={(e) => setEditingInput({
                                    ...editingInput,
                                    hours_overtime: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                            </div>
                            
                            {/* Bonuses */}
                            <div>
                              <Label className="flex items-center justify-between">
                                Bonos
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setEditingInput({
                                    ...editingInput,
                                    bonuses: [...editingInput.bonuses, { name: '', amount: 0 }]
                                  })}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </Label>
                              {editingInput.bonuses.map((bonus, idx) => (
                                <div key={idx} className="flex gap-2 mt-2">
                                  <Input 
                                    placeholder="Concepto"
                                    value={bonus.name}
                                    onChange={(e) => {
                                      const updated = [...editingInput.bonuses];
                                      updated[idx].name = e.target.value;
                                      setEditingInput({ ...editingInput, bonuses: updated });
                                    }}
                                  />
                                  <Input 
                                    type="number"
                                    placeholder="€"
                                    className="w-24"
                                    value={bonus.amount}
                                    onChange={(e) => {
                                      const updated = [...editingInput.bonuses];
                                      updated[idx].amount = parseFloat(e.target.value) || 0;
                                      setEditingInput({ ...editingInput, bonuses: updated });
                                    }}
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = editingInput.bonuses.filter((_, i) => i !== idx);
                                      setEditingInput({ ...editingInput, bonuses: updated });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            
                            {/* Deductions */}
                            <div>
                              <Label className="flex items-center justify-between">
                                Deducciones
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setEditingInput({
                                    ...editingInput,
                                    deductions: [...editingInput.deductions, { name: '', amount: 0 }]
                                  })}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </Label>
                              {editingInput.deductions.map((ded, idx) => (
                                <div key={idx} className="flex gap-2 mt-2">
                                  <Input 
                                    placeholder="Concepto"
                                    value={ded.name}
                                    onChange={(e) => {
                                      const updated = [...editingInput.deductions];
                                      updated[idx].name = e.target.value;
                                      setEditingInput({ ...editingInput, deductions: updated });
                                    }}
                                  />
                                  <Input 
                                    type="number"
                                    placeholder="€"
                                    className="w-24"
                                    value={ded.amount}
                                    onChange={(e) => {
                                      const updated = [...editingInput.deductions];
                                      updated[idx].amount = parseFloat(e.target.value) || 0;
                                      setEditingInput({ ...editingInput, deductions: updated });
                                    }}
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = editingInput.deductions.filter((_, i) => i !== idx);
                                      setEditingInput({ ...editingInput, deductions: updated });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            
                            <Button 
                              onClick={() => handleSaveInput(editingInput)} 
                              className="w-full"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Guardar
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Empleados
        </Button>
        <Button onClick={() => navigate('/payroll/validate')}>
          Siguiente: Validar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
