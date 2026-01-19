import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Timesheet {
  id: string;
  employee_id: string;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  minutes: number;
  labor_cost: number;
  approved: boolean;
}

interface LaborByDay {
  date: string;
  cost: number;
  sales: number;
  colPercent: number;
}

export default function Labor() {
  const { selectedLocationId, locations } = useApp();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [laborByDay, setLaborByDay] = useState<LaborByDay[]>([]);
  const [hourlyPlanning, setHourlyPlanning] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLaborData();
  }, [selectedLocationId]);

  const fetchLaborData = async () => {
    setLoading(true);
    
    // Fetch timesheets with employee names
    let query = supabase
      .from('timesheets')
      .select(`
        id, clock_in, clock_out, minutes, labor_cost, approved, employee_id,
        employees!inner(full_name)
      `)
      .order('clock_in', { ascending: false })
      .limit(50);
    
    if (selectedLocationId && selectedLocationId !== 'all') {
      query = query.eq('location_id', selectedLocationId);
    }
    
    const { data } = await query;
    
    const mappedTimesheets: Timesheet[] = (data || []).map((t: any) => ({
      id: t.id,
      employee_id: t.employee_id,
      employee_name: t.employees?.full_name || 'Desconocido',
      clock_in: t.clock_in,
      clock_out: t.clock_out,
      minutes: t.minutes || 0,
      labor_cost: Number(t.labor_cost) || 0,
      approved: t.approved
    }));
    
    setTimesheets(mappedTimesheets);
    
    // Generate labor by day (last 7 days)
    const days: LaborByDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTimesheets = mappedTimesheets.filter(t => t.clock_in.startsWith(dateStr));
      const dayCost = dayTimesheets.reduce((sum, t) => sum + t.labor_cost, 0);
      const mockSales = 2000 + Math.random() * 3000;
      days.push({
        date: format(date, 'EEE dd', { locale: es }),
        cost: dayCost || Math.random() * 500 + 300,
        sales: mockSales,
        colPercent: dayCost > 0 ? (dayCost / mockSales) * 100 : Math.random() * 10 + 20
      });
    }
    setLaborByDay(days);
    
    // Generate hourly planning data
    const hourly = Array.from({ length: 14 }, (_, i) => ({
      hour: `${10 + i}:00`,
      recommended: Math.floor(Math.random() * 3 + 2),
      actual: Math.floor(Math.random() * 4 + 1),
      cost: Math.random() * 50 + 30
    }));
    setHourlyPlanning(hourly);
    
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('timesheets')
      .update({ approved: true })
      .eq('id', id);
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo aprobar" });
    } else {
      toast({ title: "Aprobado", description: "Timesheet aprobado correctamente" });
      setTimesheets(prev => prev.map(t => t.id === id ? { ...t, approved: true } : t));
    }
  };

  const totalLaborCost = timesheets.reduce((sum, t) => sum + t.labor_cost, 0);
  const pendingCount = timesheets.filter(t => !t.approved).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Labor</h1>
        <p className="text-muted-foreground">Gestión de personal y costes laborales</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Coste Total</p>
                <p className="text-xl font-bold">€{totalLaborCost.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Empleados Activos</p>
                <p className="text-xl font-bold">{new Set(timesheets.map(t => t.employee_id)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">COL% Medio</p>
                <p className="text-xl font-bold">{(laborByDay.reduce((s, d) => s + d.colPercent, 0) / laborByDay.length).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="planning">
        <TabsList>
          <TabsTrigger value="planning">Planificación</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="cost">Coste Laboral</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff por Hora (Hoy)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyPlanning}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="recommended" fill="hsl(var(--muted-foreground))" name="Recomendado" opacity={0.5} />
                    <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-center">Recomendado</TableHead>
                    <TableHead className="text-center">Actual</TableHead>
                    <TableHead className="text-right">Coste Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourlyPlanning.map((row) => (
                    <TableRow key={row.hour}>
                      <TableCell className="font-medium">{row.hour}</TableCell>
                      <TableCell className="text-center">{row.recommended}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={row.actual >= row.recommended ? "default" : "destructive"}>
                          {row.actual}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">€{row.cost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets">
          <Card>
            <CardHeader>
              <CardTitle>Timesheets Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Coste</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((ts) => (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">{ts.employee_name}</TableCell>
                      <TableCell>{format(new Date(ts.clock_in), 'dd/MM HH:mm')}</TableCell>
                      <TableCell>{ts.clock_out ? format(new Date(ts.clock_out), 'HH:mm') : '-'}</TableCell>
                      <TableCell className="text-right">{(ts.minutes / 60).toFixed(1)}h</TableCell>
                      <TableCell className="text-right">€{ts.labor_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={ts.approved ? "default" : "secondary"}>
                          {ts.approved ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!ts.approved && (
                          <Button size="sm" variant="outline" onClick={() => handleApprove(ts.id)}>
                            Aprobar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>COL% por Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={laborByDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'COL%']} />
                    <Bar dataKey="colPercent" fill="hsl(var(--primary))" name="COL%" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranking por Local</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Labor</TableHead>
                    <TableHead className="text-right">COL%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc, i) => {
                    const mockSales = 5000 + Math.random() * 5000;
                    const mockLabor = mockSales * (0.2 + Math.random() * 0.1);
                    const col = (mockLabor / mockSales) * 100;
                    return (
                      <TableRow key={loc.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell className="text-right">€{mockSales.toFixed(0)}</TableCell>
                        <TableCell className="text-right">€{mockLabor.toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={col <= 25 ? "default" : "destructive"}>{col.toFixed(1)}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
