/**
 * Scan&Pay In-Memory Repository
 * Implementación en memoria para desarrollo sin base de datos
 */

import type {
  Bill,
  BillItem,
  ScanToken,
  Payment,
  ScanPaySettings,
  CreateBillInput,
  CreatePaymentInput,
} from '@/types/scanpay';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ============= In-Memory Stores =============

class InMemoryStore<T extends { id: string }> {
  protected data: Map<string, T> = new Map();

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) || null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async create(item: T): Promise<T> {
    this.data.set(item.id, item);
    return item;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.data.get(id);
    if (!existing) throw new Error(`Item ${id} not found`);
    const updated = { ...existing, ...updates };
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }

  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    return Array.from(this.data.values()).filter(predicate);
  }

  seed(items: T[]): void {
    items.forEach(item => this.data.set(item.id, item));
  }
}

// ============= Bills Repository =============

export class InMemoryBillsRepository {
  private store = new InMemoryStore<Bill>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findByOperationNumber(operationNumber: string) {
    const bills = await this.store.findAll();
    return bills.find(b => b.operation_number === operationNumber) || null;
  }

  async findByLocation(locationId: string) {
    return this.store.filter(b => b.location_id === locationId);
  }

  async findByStatus(status: Bill['status']) {
    return this.store.filter(b => b.status === status);
  }

  async create(input: CreateBillInput): Promise<Bill> {
    const operationNumber = `OP-${Date.now().toString().slice(-8)}`;
    
    // Calculate items with taxes
    const items: BillItem[] = input.items.map(item => {
      const taxRate = item.tax_rate || 10; // Default 10% IVA
      const subtotal = item.quantity * item.unit_price;
      const taxAmount = (subtotal * taxRate) / 100;
      const total = subtotal + taxAmount;

      return {
        id: generateId(),
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxTotal = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = subtotal + taxTotal;

    const bill: Bill = {
      id: generateId(),
      operation_number: operationNumber,
      location_id: input.location_id,
      table_name: input.table_name || null,
      waiter_name: input.waiter_name || null,
      items,
      subtotal,
      tax_total: taxTotal,
      total,
      amount_paid: 0,
      amount_due: total,
      status: 'open',
      created_at: now(),
      updated_at: now(),
      paid_at: null,
      voided_at: null,
    };

    return this.store.create(bill);
  }

  async applyPayment(billId: string, paymentAmount: number): Promise<Bill> {
    const bill = await this.findById(billId);
    if (!bill) throw new Error('Bill not found');

    const newAmountPaid = bill.amount_paid + paymentAmount;
    const newAmountDue = bill.total - newAmountPaid;

    let newStatus: Bill['status'] = 'open';
    if (newAmountDue <= 0) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid';
    }

    return this.store.update(billId, {
      amount_paid: newAmountPaid,
      amount_due: Math.max(0, newAmountDue),
      status: newStatus,
      paid_at: newStatus === 'paid' ? now() : undefined,
      updated_at: now(),
    });
  }

  async voidBill(billId: string): Promise<void> {
    await this.store.update(billId, {
      status: 'void',
      voided_at: now(),
      updated_at: now(),
    });
  }

  seed(bills: Bill[]) {
    this.store.seed(bills);
  }
}

// ============= Tokens Repository =============

export class InMemoryScanTokensRepository {
  private store = new InMemoryStore<ScanToken>();

  async findByToken(token: string) {
    const tokens = await this.store.findAll();
    return tokens.find(t => t.token === token) || null;
  }

  async findByBill(billId: string) {
    return this.store.filter(t => t.bill_id === billId);
  }

  async create(billId: string, expiryHours: number = 24): Promise<ScanToken> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    const scanToken: ScanToken = {
      token,
      bill_id: billId,
      expires_at: expiresAt,
      created_at: now(),
      used_at: null,
      is_active: true,
    };

    return this.store.create(scanToken);
  }

  async markAsUsed(token: string): Promise<void> {
    const scanToken = await this.findByToken(token);
    if (scanToken) {
      await this.store.update(scanToken.token, {
        used_at: now(),
      });
    }
  }

  private generateSecureToken(): string {
    return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  seed(tokens: ScanToken[]) {
    this.store.seed(tokens);
  }
}

// ============= Payments Repository =============

export class InMemoryPaymentsRepository {
  private store = new InMemoryStore<Payment>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findByBill(billId: string) {
    return this.store.filter(p => p.bill_id === billId);
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: generateId(),
      bill_id: input.bill_id,
      amount: input.amount,
      tip_amount: input.tip_amount || 0,
      total_amount: input.amount + (input.tip_amount || 0),
      method: input.method,
      status: 'pending',
      provider_reference: input.payment_method_id || null,
      created_at: now(),
      completed_at: null,
      error_message: null,
    };

    return this.store.create(payment);
  }

  async markAsSucceeded(paymentId: string, providerRef?: string): Promise<void> {
    await this.store.update(paymentId, {
      status: 'succeeded',
      completed_at: now(),
      provider_reference: providerRef || undefined,
    });
  }

  async markAsFailed(paymentId: string, error: string): Promise<void> {
    await this.store.update(paymentId, {
      status: 'failed',
      error_message: error,
      completed_at: now(),
    });
  }

  seed(payments: Payment[]) {
    this.store.seed(payments);
  }
}

// ============= Settings Repository =============

export class InMemoryScanPaySettingsRepository {
  private store = new InMemoryStore<ScanPaySettings>();

  async findByLocation(locationId: string) {
    const all = await this.store.findAll();
    return all.find(s => s.location_id === locationId) || null;
  }

  async getOrCreate(locationId: string): Promise<ScanPaySettings> {
    let settings = await this.findByLocation(locationId);
    
    if (!settings) {
      settings = await this.store.create({
        id: generateId(),
        location_id: locationId,
        enabled: true,
        currency: 'EUR',
        allow_partial_payment: true,
        allow_tip: true,
        tip_presets: [5, 10, 15, 20],
        payment_mode: 'demo',
        stripe_publishable_key: null,
        qr_expiry_hours: 24,
        require_waiter_pin: false,
        auto_print_receipt: true,
        created_at: now(),
        updated_at: now(),
      });
    }

    return settings;
  }

  async update(locationId: string, updates: Partial<ScanPaySettings>): Promise<ScanPaySettings> {
    const settings = await this.findByLocation(locationId);
    if (!settings) throw new Error('Settings not found');
    
    return this.store.update(settings.id, { ...updates, updated_at: now() });
  }

  seed(settings: ScanPaySettings[]) {
    this.store.seed(settings);
  }
}

// ============= Main Data Layer =============

export interface ScanPayDataLayer {
  bills: InMemoryBillsRepository;
  tokens: InMemoryScanTokensRepository;
  payments: InMemoryPaymentsRepository;
  settings: InMemoryScanPaySettingsRepository;
}

export function createScanPayDataLayer(): ScanPayDataLayer {
  return {
    bills: new InMemoryBillsRepository(),
    tokens: new InMemoryScanTokensRepository(),
    payments: new InMemoryPaymentsRepository(),
    settings: new InMemoryScanPaySettingsRepository(),
  };
}
