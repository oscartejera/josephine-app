import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationCalendar } from '@/components/reservations/ReservationCalendar';
import { ReservationTimeline } from '@/components/reservations/ReservationTimeline';
import { CustomerCRMPanel } from '@/components/reservations/CustomerCRMPanel';
import { WaitlistPanel } from '@/components/reservations/WaitlistPanel';
import { ReservationAnalytics } from '@/components/reservations/ReservationAnalytics';
import { ReservationSettingsPanel } from '@/components/reservations/ReservationSettingsPanel';
import { useApp } from '@/contexts/AppContext';
import { Calendar, Clock, Users, ListTodo, BarChart3, Settings } from 'lucide-react';

export default function Reservations() {
  const { t } = useTranslation();
  const { locations, selectedLocationId } = useApp();
  const [activeTab, setActiveTab] = useState('calendar');

  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestor de Reservas</h1>
          <p className="text-muted-foreground">
            {selectedLocation?.name || 'Todas las ubicaciones'} • Libro único de reservas
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendario</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Lista Espera</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analítica</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <ReservationCalendar locationId={selectedLocationId} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ReservationTimeline locationId={selectedLocationId} />
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <CustomerCRMPanel />
        </TabsContent>

        <TabsContent value="waitlist" className="mt-4">
          <WaitlistPanel locationId={selectedLocationId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ReservationAnalytics locationId={selectedLocationId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ReservationSettingsPanel locationId={selectedLocationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
