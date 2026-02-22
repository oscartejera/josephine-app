import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Settings sub-components
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { LocationManager } from '@/components/settings/LocationManager';
import { BookingSettingsManager } from '@/components/settings/BookingSettingsManager';
import { LoyaltyManager } from '@/components/settings/LoyaltyManager';
import { SupplierIntegrationManager } from '@/components/settings/SupplierIntegrationManager';
import { PaymentHistoryManager } from '@/components/settings/PaymentHistoryManager';
import { DataSourceSettings } from '@/components/settings/DataSourceSettings';

// Extracted tab components
import { ObjectivesTab } from '@/components/settings/ObjectivesTab';
import { PaymentMethodsTab } from '@/components/settings/PaymentMethodsTab';
import { ExportTab } from '@/components/settings/ExportTab';

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('nav.settings')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
          <TabsTrigger value="locations">{t('settings.locations')}</TabsTrigger>
          <TabsTrigger value="booking">{t('settings.bookings')}</TabsTrigger>
          <TabsTrigger value="loyalty">{t('settings.loyalty')}</TabsTrigger>
          <TabsTrigger value="objectives">{t('settings.objectives')}</TabsTrigger>
          <TabsTrigger value="suppliers">{t('settings.suppliers')}</TabsTrigger>
          <TabsTrigger value="payment">{t('settings.paymentMethods')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('common.transactions')}</TabsTrigger>
          <TabsTrigger value="export">{t('settings.exportData')}</TabsTrigger>
          <TabsTrigger value="datasource">{t('settings.dataSource', 'Fuente de Datos')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="space-y-6">
            <LanguageSelector />
          </div>
        </TabsContent>

        <TabsContent value="locations">
          <LocationManager />
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

        <TabsContent value="objectives" className="space-y-6">
          <ObjectivesTab />
        </TabsContent>

        <TabsContent value="transactions">
          <PaymentHistoryManager />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab />
        </TabsContent>

        <TabsContent value="datasource">
          <DataSourceSettings />
        </TabsContent>

      </Tabs>
    </div>
  );
}
