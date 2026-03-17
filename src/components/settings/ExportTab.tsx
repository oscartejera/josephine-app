import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export function ExportTab() {
  const { t } = useTranslation();
    const { dataSource } = useApp();
    const { toast } = useToast();

    const handleExport = async (table: string) => {
        let data: any[] = [];
        let filename = '';

        switch (table) {
            case 'tickets':
                const { data: salesData } = await supabase.from('pos_daily_finance').select('*').eq('data_source', dataSource).limit(1000);
                data = salesData || [];
                filename = 'sales_daily.csv';
                break;
            case 'employees':
                const { data: employees } = await supabase.from('employees').select('*').limit(5000);
                data = employees || [];
                filename = 'employees.csv';
                break;
            case 'inventory':
                const { data: inventory } = await supabase.from('inventory_items').select('*').limit(5000);
                data = inventory || [];
                filename = 'inventory.csv';
                break;
        }

        if (data.length === 0) {
            toast({ variant: "destructive", title: t("common.noData"), description: "No hay datos para exportar" });
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

        toast({ title: t('common.exported'), description: `${filename} descargado` });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    {t('settings.ExportTab.exportarDatos')}
                </CardTitle>
                <CardDescription>{t("settings.downloadCsv")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <h3 className="font-medium mb-2">{t('settings.ExportTab.tickets')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{t("settings.salesHistory")}</p>
                        <Button variant="outline" className="w-full" onClick={() => handleExport('tickets')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('settings.ExportTab.exportar')}
                        </Button>
                    </Card>
                    <Card className="p-4">
                        <h3 className="font-medium mb-2">{t('settings.empleados')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{t("settings.employeeList")}</p>
                        <Button variant="outline" className="w-full" onClick={() => handleExport('employees')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('settings.ExportTab.exportar1')}
                        </Button>
                    </Card>
                    <Card className="p-4">
                        <h3 className="font-medium mb-2">{t('onboarding.inventario')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{t("settings.inventoryItems")}</p>
                        <Button variant="outline" className="w-full" onClick={() => handleExport('inventory')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('settings.ExportTab.exportar2')}
                        </Button>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}
