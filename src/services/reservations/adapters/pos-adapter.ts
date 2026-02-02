/**
 * POS (TPV) Adapter
 * Interfaz para sincronizar con el sistema de Punto de Venta
 */

import type {
  ReservationsDataLayer,
} from '../repository-interface';
import type {
  Reservation,
  Deposit,
} from '@/types/reservations';

export interface PosTable {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved';
  covers: number;
  openedAt?: string;
  closedAt?: string;
  orderId?: string;
}

export interface PosPrepayment {
  id: string;
  orderId?: string;
  tableId?: string;
  amount: number;
  currency: string;
  description: string;
  source: 'reservation_deposit' | 'gift_card' | 'other';
  reservationId?: string;
}

export interface PosAdapter {
  // Table Management
  getTableStatus(tableId: string): Promise<PosTable>;
  getAllTables(locationId: string): Promise<PosTable[]>;
  releaseTable(tableId: string): Promise<void>;
  
  // Prepayments
  createPrepayment(prepayment: PosPrepayment): Promise<string>;
  getPrepayments(orderId: string): Promise<PosPrepayment[]>;
  
  // Orders
  getOrderForTable(tableId: string): Promise<{ id: string; total: number; items: any[] } | null>;
}

/**
 * Mock POS Adapter for development
 */
export class MockPosAdapter implements PosAdapter {
  private tables: Map<string, PosTable> = new Map();
  private prepayments: Map<string, PosPrepayment> = new Map();

  constructor(private dataLayer: ReservationsDataLayer) {
    // Initialize with mock data
    this.initializeMockData();
  }

  private initializeMockData() {
    // Load tables from reservations data layer
    this.dataLayer.tables.findAll().then(tables => {
      tables.forEach(table => {
        this.tables.set(table.id, {
          id: table.id,
          name: table.name,
          status: 'available',
          covers: 0,
        });
      });
    });
  }

  async getTableStatus(tableId: string): Promise<PosTable> {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in POS`);
    }
    return table;
  }

  async getAllTables(locationId: string): Promise<PosTable[]> {
    const tables = await this.dataLayer.tables.findByLocation(locationId);
    return tables.map(t => ({
      id: t.id,
      name: t.name,
      status: this.tables.get(t.id)?.status || 'available',
      covers: this.tables.get(t.id)?.covers || 0,
    }));
  }

  async releaseTable(tableId: string): Promise<void> {
    console.log(`[POS Mock] Releasing table ${tableId}`);
    
    const table = this.tables.get(tableId);
    if (table) {
      table.status = 'available';
      table.covers = 0;
      table.orderId = undefined;
      table.closedAt = new Date().toISOString();
      this.tables.set(tableId, table);
    }

    // Notify reservations system
    await this.notifyTableReleased(tableId);
  }

  async createPrepayment(prepayment: PosPrepayment): Promise<string> {
    const id = `prep_${Date.now()}`;
    this.prepayments.set(id, { ...prepayment, id });
    
    console.log(`[POS Mock] Created prepayment:`, prepayment);
    
    return id;
  }

  async getPrepayments(orderId: string): Promise<PosPrepayment[]> {
    return Array.from(this.prepayments.values()).filter(p => p.orderId === orderId);
  }

  async getOrderForTable(tableId: string): Promise<{ id: string; total: number; items: any[] } | null> {
    const table = this.tables.get(tableId);
    if (!table || !table.orderId) {
      return null;
    }

    return {
      id: table.orderId,
      total: 45.50, // Mock total
      items: [
        { name: 'Plato principal', price: 25.00 },
        { name: 'Bebida', price: 5.50 },
        { name: 'Postre', price: 15.00 },
      ],
    };
  }

  private async notifyTableReleased(tableId: string) {
    // Find active reservations for this table
    const allReservations = await this.dataLayer.reservations.findAll();
    const tableReservation = allReservations.find(
      r => r.pos_table_id === tableId && r.status === 'seated'
    );

    if (tableReservation) {
      await this.dataLayer.reservations.markAsCompleted(tableReservation.id);
      console.log(`[POS Mock] Marked reservation ${tableReservation.id} as completed`);
    }
  }

  // Mock method to simulate table opening (for testing)
  async mockOpenTable(tableId: string, covers: number, orderId: string) {
    const table = this.tables.get(tableId);
    if (table) {
      table.status = 'occupied';
      table.covers = covers;
      table.orderId = orderId;
      table.openedAt = new Date().toISOString();
      this.tables.set(tableId, table);
    }
  }
}

/**
 * POS Integration Service
 * Orchestrates bidirectional sync between Reservations and POS
 */
export class PosIntegrationService {
  constructor(
    private dataLayer: ReservationsDataLayer,
    private posAdapter: PosAdapter
  ) {}

  /**
   * Seat a reservation - update both systems
   */
  async seatReservation(reservationId: string, tableId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Check table is available in POS
    const table = await this.posAdapter.getTableStatus(tableId);
    if (table.status !== 'available') {
      throw new Error(`Table ${table.name} is not available in POS`);
    }

    // Update reservation
    await this.dataLayer.reservations.markAsSeated(reservationId, tableId);

    // If reservation has deposit, create prepayment in POS
    if (reservation.deposit_id) {
      await this.convertDepositToPrepayment(reservation);
    }

    console.log(`[POS Integration] Seated reservation ${reservationId} at table ${tableId}`);
  }

  /**
   * Convert reservation deposit to POS prepayment
   */
  async convertDepositToPrepayment(reservation: Reservation): Promise<void> {
    if (!reservation.deposit_id) return;

    const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
    if (!deposit || deposit.status !== 'charged') {
      console.warn(`Deposit ${reservation.deposit_id} not charged, skipping prepayment`);
      return;
    }

    const prepayment: PosPrepayment = {
      id: '', // Will be assigned by POS
      tableId: reservation.pos_table_id || undefined,
      amount: deposit.amount,
      currency: deposit.currency,
      description: `Depósito de reserva - ${reservation.guest_name}`,
      source: 'reservation_deposit',
      reservationId: reservation.id,
    };

    const prepaymentId = await this.posAdapter.createPrepayment(prepayment);
    console.log(`[POS Integration] Created prepayment ${prepaymentId} for deposit ${deposit.id}`);
  }

  /**
   * Handle table closure from POS
   */
  async handleTableClosed(tableId: string): Promise<void> {
    console.log(`[POS Integration] Table ${tableId} closed in POS`);

    // Find reservation for this table
    const allReservations = await this.dataLayer.reservations.findAll();
    const reservation = allReservations.find(
      r => r.pos_table_id === tableId && r.status === 'seated'
    );

    if (reservation) {
      // Mark reservation as completed
      await this.dataLayer.reservations.markAsCompleted(reservation.id);

      // Update customer visit count
      if (reservation.customer_profile_id) {
        await this.dataLayer.customers.incrementVisits(reservation.customer_profile_id);
      }

      console.log(`[POS Integration] Completed reservation ${reservation.id}`);

      // Trigger post-visit actions (survey, etc.)
      await this.triggerPostVisitActions(reservation.id);
    }

    // Check waitlist for available tables
    await this.checkWaitlistForReleasedTable(tableId);
  }

  /**
   * Sync table statuses from POS
   */
  async syncTableStatuses(locationId: string): Promise<void> {
    const posTables = await this.posAdapter.getAllTables(locationId);
    
    console.log(`[POS Integration] Synced ${posTables.length} tables from POS`);

    // Update reservation system with POS status
    for (const posTable of posTables) {
      if (posTable.status === 'available') {
        // Table is free in POS, check if we need to release a reservation
        await this.handleTableClosed(posTable.id);
      }
    }
  }

  /**
   * Trigger post-visit actions
   */
  private async triggerPostVisitActions(reservationId: string): Promise<void> {
    // Schedule survey email
    // Schedule review request
    // etc.
    
    console.log(`[POS Integration] Scheduled post-visit actions for ${reservationId}`);
  }

  /**
   * Check waitlist when table is released
   */
  private async checkWaitlistForReleasedTable(tableId: string): Promise<void> {
    const table = await this.dataLayer.tables.findById(tableId);
    if (!table) return;

    const waitlist = await this.dataLayer.waitlist.findActive(table.location_id);
    
    // Find suitable waitlist entry for this table
    const suitable = waitlist.find(
      w => w.party_size >= table.min_capacity && w.party_size <= table.max_capacity
    );

    if (suitable && suitable.status === 'waiting') {
      await this.dataLayer.waitlist.markAsNotified(suitable.id);
      console.log(`[POS Integration] Notified waitlist entry ${suitable.id} for table ${tableId}`);
    }
  }

  /**
   * Get prepayments for an order
   */
  async getPrepayments(orderId: string): Promise<PosPrepayment[]> {
    return this.posAdapter.getPrepayments(orderId);
  }
}
