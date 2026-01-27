import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Target, Download, Save, Loader2, Printer, Truck, Package, Globe, Gift, CalendarDays, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UsersRolesManager } from '@/components/settings/UsersRolesManager';
import { TeamManager } from '@/components/settings/TeamManager';
import { ProductCatalogManager } from '@/components/settings/ProductCatalogManager';
import { PaymentHistoryManager } from '@/components/settings/PaymentHistoryManager';
import { PrinterConfigManager } from '@/components/settings/PrinterConfigManager';
import { LocationManager } from '@/components/settings/LocationManager';
import { SupplierIntegrationManager } from '@/components/settings/SupplierIntegrationManager';
import { BookingSettingsManager } from '@/components/settings/BookingSettingsManager';
import { LoyaltyManager } from '@/components/settings/LoyaltyManager';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { useTranslation } from 'react-i18next';

interface LocationSetting {
  id: string;
  location_id: string;
  location_name: string;
  target_gp_percent: number;
  target_col_percent: number;
  default_cogs_percent: number;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { locations, group } = useApp();
  const { profile } = useAuth();
  const { isOwner, hasPermission } = usePermissions();
  const [settings, setSettings] = useState<LocationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ target_gp: '', target_col: '', default_cogs: '' });
  const { toast } = useToast();
  
  const canManageUsers = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);
  const canManageBilling = isOwner || hasPermission(PERMISSIONS.SETTINGS_BILLING_MANAGE);
  const isAdmin = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);

  useEffect(() => {
    fetchSettings();
  }, [locations]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('location_settings')
      .select(`
        id, location_id, target_gp_percent, target_col_percent, default_cogs_percent,
        locations(name)
      `);
    
    const mapped: LocationSetting[] = (data || []).map((s: any) => ({
      id: s.id,
      location_id: s.location_id,
      location_name: s.locations?.name || 'Desconocido',
      target_gp_percent: s.target_gp_percent,
      target_col_percent: s.target_col_percent,
      default_cogs_percent: s.default_cogs_percent
    }));
    setSettings(mapped);
    setLoading(false);
  };

  const handleEdit = (setting: LocationSetting) => {
    setEditingId(setting.id);
    setEditValues({
      target_gp: setting.target_gp_percent.toString(),
      target_col: setting.target_col_percent.toString(),
      default_cogs: setting.default_cogs_percent.toString()
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('location_settings')
      .update({
        target_gp_percent: parseFloat(editValues.target_gp),
        target_col_percent: parseFloat(editValues.target_col),
        default_cogs_percent: parseFloat(editValues.default_cogs)
      })
      .eq('id', id);
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar" });
    } else {
      toast({ title: "Guardado", description: "Objetivos actualizados" });
      setEditingId(null);
      fetchSettings();
    }
  };

  const handleExport = async (table: string) => {
    let data: any[] = [];
    let filename = '';
    
    switch (table) {
      case 'tickets':
        const { data: tickets } = await supabase.from('tickets').select('*').limit(1000);
        data = tickets || [];
        filename = 'tickets.csv';
        break;
      case 'employees':
        const { data: employees } = await supabase.from('employees').select('*');
        data = employees || [];
        filename = 'employees.csv';
        break;
      case 'inventory':
        const { data: inventory } = await supabase.from('inventory_items').select('*');
        data = inventory || [];
        filename = 'inventory.csv';
        break;
    }
    
    if (data.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "No hay datos para exportar" });
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    toast({ title: "Exportado", description: `${filename} descargado` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('nav.settings')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="h-4 w-4" />
            {t('settings.general')}
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t('settings.locations')}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {t('settings.bookings')}
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-2">
            <Gift className="h-4 w-4" />
            {t('settings.loyalty')}
          </TabsTrigger>
          <TabsTrigger value="objectives" className="gap-2">
            <Target className="h-4 w-4" />
            {t('settings.objectives')}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Truck className="h-4 w-4" />
            {t('settings.suppliers')}
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2">
            <Printer className="h-4 w-4" />
            {t('settings.printers')}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            {t('settings.exportData')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="space-y-6">
            <LanguageSelector />
          </div>
        </TabsContent>

        <TabsContent value="locations">
          <LocationManager />
        </TabsContent>

        <TabsContent value="products">
          <ProductCatalogManager />
        </TabsContent>

        <TabsContent value="booking">
          <BookingSettingsManager />
        </TabsContent>

        <TabsContent value="loyalty">
          <LoyaltyManager />
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierIntegrationManager />
        </TabsContent>

        <TabsContent value="objectives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Objetivos por Local
              </CardTitle>
              <CardDescription>Define los KPIs objetivo para cada local</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Target GP%</TableHead>
                    <TableHead className="text-right">Target COL%</TableHead>
                    <TableHead className="text-right">COGS Default %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium">{setting.location_name}</TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.target_gp}
                            onChange={(e) => setEditValues({...editValues, target_gp: e.target.value})}
                          />
                        ) : (
                          `${setting.target_gp_percent}%`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.target_col}
                            onChange={(e) => setEditValues({...editValues, target_col: e.target.value})}
                          />
                        ) : (
                          `${setting.target_col_percent}%`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === setting.id ? (
                          <Input 
                            type="number" 
                            className="w-20 text-right" 
                            value={editValues.default_cogs}
                            onChange={(e) => setEditValues({...editValues, default_cogs: e.target.value})}
                          />
                        ) : (
                          `${setting.default_cogs_percent}%`
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          editingId === setting.id ? (
                            <Button size="sm" onClick={() => handleSave(setting.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(setting)}>
                              Editar
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printers">
          <PrinterConfigManager />
        </TabsContent>

        <TabsContent value="transactions">
          <PaymentHistoryManager />
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Datos
              </CardTitle>
              <CardDescription>Descarga datos en formato CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Tickets</h3>
                  <p className="text-sm text-muted-foreground mb-4">Historial de ventas y transacciones</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('tickets')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Empleados</h3>
                  <p className="text-sm text-muted-foreground mb-4">Lista de empleados y roles</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('employees')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Inventario</h3>
                  <p className="text-sm text-muted-foreground mb-4">Items de inventario y stock</p>
                  <Button variant="outline" className="w-full" onClick={() => handleExport('inventory')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
