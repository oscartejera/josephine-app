import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutGrid, ShoppingCart, ClipboardList, Settings, Receipt } from 'lucide-react';
import { POSFloorPlan } from '@/components/pos/POSFloorPlan';
import { POSQuickOrder } from '@/components/pos/POSQuickOrder';
import { POSOpenTables } from '@/components/pos/POSOpenTables';
import { POSCashSession } from '@/components/pos/POSCashSession';
import { usePOSData } from '@/hooks/usePOSData';

export default function POSTerminal() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { locations } = useApp();
  const [activeTab, setActiveTab] = useState('floor');
  
  const location = locations.find(l => l.id === locationId);
  const { 
    floorMaps, 
    tables, 
    products, 
    openTickets,
    cashSession,
    loading,
    refetch
  } = usePOSData(locationId || '');

  if (!locationId || !location) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Local no encontrado</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{location.name}</h1>
            <p className="text-xs text-muted-foreground">
              {cashSession ? `Caja abierta • €${cashSession.opening_cash.toFixed(2)}` : 'Caja cerrada'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <POSCashSession 
            locationId={locationId} 
            session={cashSession} 
            onSessionChange={refetch} 
          />
        </div>
      </header>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-card h-12 px-4 shrink-0">
          <TabsTrigger value="floor" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Plano</span>
          </TabsTrigger>
          <TabsTrigger value="quick" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Rápido</span>
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Abiertas</span>
            {openTickets.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                {openTickets.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="floor" className="flex-1 m-0 p-0 overflow-hidden">
          <POSFloorPlan 
            locationId={locationId}
            floorMaps={floorMaps}
            tables={tables}
            products={products}
            onRefresh={refetch}
          />
        </TabsContent>

        <TabsContent value="quick" className="flex-1 m-0 p-0 overflow-hidden">
          <POSQuickOrder 
            locationId={locationId}
            products={products}
            cashSession={cashSession}
            onRefresh={refetch}
          />
        </TabsContent>

        <TabsContent value="open" className="flex-1 m-0 p-4 overflow-auto">
          <POSOpenTables 
            tickets={openTickets}
            tables={tables}
            onRefresh={refetch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
