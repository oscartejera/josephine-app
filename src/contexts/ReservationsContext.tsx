/**
 * Reservations Context
 * Provides reservations services and data layer to the entire app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  createInMemoryDataLayer,
  getAllSeedData,
  AvailabilityService,
  SeatingService,
  MessagingService,
  DepositService,
  type ReservationsDataLayer,
} from '@/services/reservations';
import { MockPosAdapter, PosIntegrationService } from '@/services/reservations/adapters/pos-adapter';
import { useApp } from './AppContext';

interface ReservationsContextValue {
  dataLayer: ReservationsDataLayer;
  availabilityService: AvailabilityService;
  seatingService: SeatingService;
  messagingService: MessagingService;
  depositService: DepositService;
  posIntegration: PosIntegrationService;
  isInitialized: boolean;
}

const ReservationsContext = createContext<ReservationsContextValue | null>(null);

export function ReservationsProvider({ children }: { children: ReactNode }) {
  const { locations } = useApp();
  const [isInitialized, setIsInitialized] = useState(false);
  const [services, setServices] = useState<ReservationsContextValue | null>(null);

  useEffect(() => {
    async function initializeReservations() {
      console.log('[Reservations] Initializing module...');

      // Create data layer
      const dataLayer = createInMemoryDataLayer();

      // Load seed data for all locations
      for (const location of locations) {
        const seedData = getAllSeedData(location.id);
        
        // Seed all data
        dataLayer.tags.seed(seedData.tags);
        dataLayer.customers.seed(seedData.customers);
        dataLayer.zones.seed(seedData.zones);
        dataLayer.tables.seed(seedData.tables);
        dataLayer.services.seed(seedData.services);
        dataLayer.settings.seed([seedData.settings]);
        dataLayer.messageTemplates.seed(seedData.messageTemplates);
        dataLayer.promoCodes.seed(seedData.promoCodes);
        dataLayer.closureDays.seed(seedData.closureDays);
        
        // Generate today's reservations
        const todayReservations = seedData.reservations;
        for (const res of todayReservations) {
          await dataLayer.reservations.create(res);
        }

        console.log(`[Reservations] Loaded seed data for ${location.name}`);
      }

      // Create services
      const availabilityService = new AvailabilityService(dataLayer);
      const seatingService = new SeatingService(dataLayer);
      const messagingService = new MessagingService(dataLayer);
      const depositService = new DepositService(dataLayer);

      // Create POS integration
      const posAdapter = new MockPosAdapter(dataLayer);
      const posIntegration = new PosIntegrationService(dataLayer, posAdapter);

      setServices({
        dataLayer,
        availabilityService,
        seatingService,
        messagingService,
        depositService,
        posIntegration,
        isInitialized: true,
      });

      setIsInitialized(true);
      console.log('[Reservations] Module initialized successfully');
    }

    if (locations.length > 0 && !isInitialized) {
      initializeReservations();
    }
  }, [locations, isInitialized]);

  if (!services) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Inicializando módulo de reservas...</p>
        </div>
      </div>
    );
  }

  return (
    <ReservationsContext.Provider value={services}>
      {children}
    </ReservationsContext.Provider>
  );
}

export function useReservations() {
  const context = useContext(ReservationsContext);
  if (!context) {
    throw new Error('useReservations must be used within ReservationsProvider');
  }
  return context;
}
