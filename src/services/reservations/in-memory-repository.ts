/**
 * In-Memory Repository Implementation
 * Implementación en memoria para desarrollo y testing sin Supabase
 */

import type {
  Reservation,
  CustomerProfile,
  Deposit,
  Zone,
  Table,
  Service,
  ServiceZoneCapacity,
  ClosureDay,
  WaitlistEntry,
  MessageTemplate,
  MessageLog,
  PromoCode,
  PromoCodeUsage,
  ReservationSettings,
  CustomerTag,
  Survey,
  SurveyResponse,
  GoogleReservationSource,
  PosIntegration,
  CreateReservationInput,
  UpdateReservationInput,
  AddToWaitlistInput,
  CreateCustomerInput,
} from '@/types/reservations';

import type {
  ReservationsDataLayer,
  ReservationsRepository,
  CustomersRepository,
  DepositsRepository,
  ZonesRepository,
  TablesRepository,
  ServicesRepository,
  ServiceZoneCapacityRepository,
  ClosureDaysRepository,
  WaitlistRepository,
  MessageTemplatesRepository,
  MessageLogsRepository,
  PromoCodesRepository,
  PromoCodeUsageRepository,
  SettingsRepository,
  TagsRepository,
  SurveysRepository,
  SurveyResponsesRepository,
  GoogleReservationsRepository,
  PosIntegrationRepository,
} from './repository-interface';

// ============= Helper Functions =============

function generateId(): string {
  // Fallback if uuid is not available
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ============= In-Memory Storage =============

class InMemoryStore<T extends { id: string }> {
  private data: Map<string, T> = new Map();

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
    if (!existing) throw new Error(`Item with id ${id} not found`);
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

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    return Array.from(this.data.values()).find(predicate) || null;
  }

  seed(items: T[]): void {
    items.forEach(item => this.data.set(item.id, item));
  }
}

// ============= Repository Implementations =============

class InMemoryReservationsRepository implements ReservationsRepository {
  private store = new InMemoryStore<Reservation>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<Reservation>) {
    const reservation: Reservation = {
      id: generateId(),
      location_id: data.location_id!,
      pos_table_id: data.pos_table_id || null,
      guest_name: data.guest_name!,
      guest_phone: data.guest_phone || null,
      guest_email: data.guest_email || null,
      party_size: data.party_size!,
      reservation_date: data.reservation_date!,
      reservation_time: data.reservation_time!,
      duration_minutes: data.duration_minutes || 90,
      status: data.status || 'pending',
      confirmation_sent_at: null,
      reconfirmation_required: false,
      reconfirmed_at: null,
      notes: data.notes || null,
      special_requests: data.special_requests || null,
      created_at: now(),
      updated_at: now(),
      customer_profile_id: data.customer_profile_id || null,
      source: data.source || 'manual',
      zone_id: data.zone_id || null,
      service_id: data.service_id || null,
      deposit_id: data.deposit_id || null,
      promo_code_id: data.promo_code_id || null,
      auto_assigned: false,
    };
    return this.store.create(reservation);
  }

  async update(id: string, data: Partial<Reservation>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByLocation(locationId: string) {
    return this.store.filter(r => r.location_id === locationId);
  }

  async findByDate(locationId: string, date: string) {
    return this.store.filter(
      r => r.location_id === locationId && r.reservation_date === date
    );
  }

  async findByDateRange(locationId: string, startDate: string, endDate: string) {
    return this.store.filter(
      r =>
        r.location_id === locationId &&
        r.reservation_date >= startDate &&
        r.reservation_date <= endDate
    );
  }

  async findByCustomer(customerId: string) {
    return this.store.filter(r => r.customer_profile_id === customerId);
  }

  async findByStatus(locationId: string, status: Reservation['status']) {
    return this.store.filter(
      r => r.location_id === locationId && r.status === status
    );
  }

  async createReservation(locationId: string, input: CreateReservationInput) {
    return this.create({
      location_id: locationId,
      ...input,
      source: input.source || 'manual',
    });
  }

  async updateReservation(id: string, input: UpdateReservationInput) {
    return this.update(id, input);
  }

  async cancelReservation(id: string, reason?: string) {
    await this.update(id, {
      status: 'cancelled',
      notes: reason || undefined,
    });
  }

  async confirmReservation(id: string) {
    await this.update(id, { status: 'confirmed', confirmation_sent_at: now() });
  }

  async reconfirmReservation(id: string) {
    await this.update(id, { status: 'reconfirmed', reconfirmed_at: now() });
  }

  async markAsSeated(id: string, tableId?: string) {
    await this.update(id, {
      status: 'seated',
      pos_table_id: tableId || undefined,
    });
  }

  async markAsCompleted(id: string) {
    await this.update(id, { status: 'completed' });
  }

  async markAsNoShow(id: string) {
    await this.update(id, { status: 'no_show' });
  }

  seed(data: Reservation[]) {
    this.store.seed(data);
  }
}

class InMemoryCustomersRepository implements CustomersRepository {
  private store = new InMemoryStore<CustomerProfile>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<CustomerProfile>) {
    const customer: CustomerProfile = {
      id: generateId(),
      group_id: data.group_id || null,
      name: data.name!,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      tags: data.tags || [],
      total_visits: 0,
      total_spent: 0,
      total_no_shows: 0,
      total_cancellations: 0,
      last_visit_at: null,
      created_at: now(),
      updated_at: now(),
      max_party_size_limit: null,
      is_blocked: false,
      block_reason: null,
    };
    return this.store.create(customer);
  }

  async update(id: string, data: Partial<CustomerProfile>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByEmail(email: string) {
    return this.store.findOne(c => c.email === email);
  }

  async findByPhone(phone: string) {
    return this.store.findOne(c => c.phone === phone);
  }

  async findByTag(tag: string) {
    return this.store.filter(c => c.tags.includes(tag));
  }

  async createCustomer(input: CreateCustomerInput) {
    return this.create(input);
  }

  async addTag(customerId: string, tag: string) {
    const customer = await this.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    if (!customer.tags.includes(tag)) {
      await this.update(customerId, { tags: [...customer.tags, tag] });
    }
  }

  async removeTag(customerId: string, tag: string) {
    const customer = await this.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    await this.update(customerId, {
      tags: customer.tags.filter(t => t !== tag),
    });
  }

  async blockCustomer(customerId: string, reason: string) {
    await this.update(customerId, { is_blocked: true, block_reason: reason });
  }

  async unblockCustomer(customerId: string) {
    await this.update(customerId, { is_blocked: false, block_reason: null });
  }

  async incrementVisits(customerId: string) {
    const customer = await this.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    await this.update(customerId, {
      total_visits: customer.total_visits + 1,
      last_visit_at: now(),
    });
  }

  async incrementNoShows(customerId: string) {
    const customer = await this.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    await this.update(customerId, {
      total_no_shows: customer.total_no_shows + 1,
    });
  }

  seed(data: CustomerProfile[]) {
    this.store.seed(data);
  }
}

// Resto de implementaciones seguirían el mismo patrón...
// Por brevedad, implementaré los principales

class InMemoryDepositsRepository implements DepositsRepository {
  private store = new InMemoryStore<Deposit>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<Deposit>) {
    const deposit: Deposit = {
      id: generateId(),
      reservation_id: data.reservation_id!,
      amount: data.amount!,
      currency: 'EUR',
      per_person_amount: data.per_person_amount!,
      status: 'pending',
      payment_method: data.payment_method || 'card',
      payment_intent_id: null,
      charged_at: null,
      refunded_at: null,
      refund_amount: null,
      refund_reason: null,
      created_at: now(),
      updated_at: now(),
    };
    return this.store.create(deposit);
  }

  async update(id: string, data: Partial<Deposit>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByReservation(reservationId: string) {
    return this.store.findOne(d => d.reservation_id === reservationId);
  }

  async createDeposit(reservationId: string, amount: number, perPersonAmount: number) {
    return this.create({ reservation_id: reservationId, amount, per_person_amount: perPersonAmount });
  }

  async authorizeDeposit(id: string, paymentIntentId: string) {
    await this.update(id, { status: 'authorized', payment_intent_id: paymentIntentId });
  }

  async chargeDeposit(id: string) {
    await this.update(id, { status: 'charged', charged_at: now() });
  }

  async refundDeposit(id: string, amount: number, reason: string) {
    const deposit = await this.findById(id);
    if (!deposit) throw new Error('Deposit not found');
    
    const isPartial = amount < deposit.amount;
    await this.update(id, {
      status: isPartial ? 'partially_refunded' : 'refunded',
      refund_amount: amount,
      refund_reason: reason,
      refunded_at: now(),
    });
  }

  async findPendingDeposits(locationId: string) {
    // Need access to reservations to filter by location
    return this.store.filter(d => d.status === 'pending');
  }

  seed(data: Deposit[]) {
    this.store.seed(data);
  }
}

class InMemoryZonesRepository implements ZonesRepository {
  private store = new InMemoryStore<Zone>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<Zone>) {
    const zone: Zone = {
      id: generateId(),
      location_id: data.location_id!,
      name: data.name!,
      description: data.description || null,
      capacity: data.capacity || 0,
      position: data.position || { x: 0, y: 0 },
      color: data.color || '#6366f1',
      is_active: data.is_active !== false,
      created_at: now(),
      updated_at: now(),
    };
    return this.store.create(zone);
  }

  async update(id: string, data: Partial<Zone>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByLocation(locationId: string) {
    return this.store.filter(z => z.location_id === locationId);
  }

  async findActive(locationId: string) {
    return this.store.filter(z => z.location_id === locationId && z.is_active);
  }

  seed(data: Zone[]) {
    this.store.seed(data);
  }
}

class InMemoryTablesRepository implements TablesRepository {
  private store = new InMemoryStore<Table>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<Table>) {
    const table: Table = {
      id: generateId(),
      location_id: data.location_id!,
      zone_id: data.zone_id || null,
      name: data.name!,
      min_capacity: data.min_capacity || 1,
      max_capacity: data.max_capacity!,
      position: data.position || { x: 0, y: 0, width: 100, height: 100 },
      shape: data.shape || 'rectangle',
      is_combinable: data.is_combinable || false,
      combined_with: data.combined_with || [],
      is_active: data.is_active !== false,
      created_at: now(),
      updated_at: now(),
    };
    return this.store.create(table);
  }

  async update(id: string, data: Partial<Table>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByLocation(locationId: string) {
    return this.store.filter(t => t.location_id === locationId);
  }

  async findByZone(zoneId: string) {
    return this.store.filter(t => t.zone_id === zoneId);
  }

  async findAvailableForPartySize(locationId: string, partySize: number) {
    return this.store.filter(
      t =>
        t.location_id === locationId &&
        t.is_active &&
        t.min_capacity <= partySize &&
        t.max_capacity >= partySize
    );
  }

  async combineTables(tableIds: string[]) {
    for (const id of tableIds) {
      const table = await this.findById(id);
      if (table) {
        await this.update(id, {
          combined_with: tableIds.filter(tid => tid !== id),
        });
      }
    }
  }

  async uncombineTables(tableIds: string[]) {
    for (const id of tableIds) {
      await this.update(id, { combined_with: [] });
    }
  }

  seed(data: Table[]) {
    this.store.seed(data);
  }
}

// Continuaré con implementaciones más simples para el resto...

class InMemoryServicesRepository implements ServicesRepository {
  private store = new InMemoryStore<Service>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<Service>): Promise<Service> {
    const service: Service = {
      id: generateId(),
      location_id: data.location_id!,
      name: data.name!,
      start_time: data.start_time!,
      end_time: data.end_time!,
      days_of_week: data.days_of_week || [],
      max_covers: data.max_covers || null,
      slot_duration_minutes: data.slot_duration_minutes || 15,
      default_reservation_duration: data.default_reservation_duration || 90,
      is_active: data.is_active !== false,
      created_at: now(),
      updated_at: now(),
    };
    return this.store.create(service);
  }

  async update(id: string, data: Partial<Service>) {
    return this.store.update(id, { ...data, updated_at: now() });
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  async findByLocation(locationId: string) {
    return this.store.filter(s => s.location_id === locationId);
  }

  async findActive(locationId: string) {
    return this.store.filter(s => s.location_id === locationId && s.is_active);
  }

  async findForDate(locationId: string, date: string) {
    const dayOfWeek = new Date(date).getDay();
    return this.store.filter(
      s =>
        s.location_id === locationId &&
        s.is_active &&
        s.days_of_week.includes(dayOfWeek)
    );
  }

  seed(data: Service[]) {
    this.store.seed(data);
  }
}

// Implementaciones simplificadas para los demás repositorios
class SimpleInMemoryRepository<T extends { id: string; created_at: string }> {
  protected store = new InMemoryStore<T>();

  async findById(id: string) {
    return this.store.findById(id);
  }

  async findAll() {
    return this.store.findAll();
  }

  async create(data: Partial<T>): Promise<T> {
    const item = {
      ...data,
      id: generateId(),
      created_at: now(),
    } as T;
    return this.store.create(item);
  }

  async update(id: string, data: Partial<T>) {
    return this.store.update(id, data);
  }

  async delete(id: string) {
    return this.store.delete(id);
  }

  seed(data: T[]) {
    this.store.seed(data);
  }
}

// Settings Repository
class InMemorySettingsRepository implements SettingsRepository {
  private store = new InMemoryStore<ReservationSettings>();

  async findByLocation(locationId: string) {
    return this.store.findOne(s => s.location_id === locationId);
  }

  async update(locationId: string, updates: Partial<ReservationSettings>) {
    const existing = await this.findByLocation(locationId);
    if (!existing) throw new Error('Settings not found');
    return this.store.update(existing.id, { ...updates, updated_at: now() });
  }

  async getOrCreate(locationId: string) {
    let settings = await this.findByLocation(locationId);
    if (!settings) {
      settings = await this.store.create({
        id: generateId(),
        location_id: locationId,
        default_reservation_duration: 90,
        slot_duration_minutes: 15,
        max_covers_per_slot: null,
        max_party_size: 12,
        min_party_size: 1,
        require_deposit: false,
        deposit_amount_per_person: 10,
        deposit_required_for_party_size: 6,
        auto_confirm: true,
        require_reconfirmation: false,
        reconfirmation_hours_before: 24,
        send_confirmation_email: true,
        send_reminder: true,
        reminder_hours_before: 24,
        cancellation_deadline_hours: 24,
        charge_cancellation_fee: false,
        cancellation_fee_percentage: 50,
        track_no_shows: true,
        block_after_no_shows: 3,
        enable_waitlist: true,
        auto_assign_from_waitlist: true,
        confirmation_message: null,
        cancellation_policy: null,
        enable_table_combining: true,
        enable_promo_codes: true,
        enable_google_reservations: false,
        created_at: now(),
        updated_at: now(),
      });
    }
    return settings;
  }

  seed(data: ReservationSettings[]) {
    this.store.seed(data);
  }
}

// Resto de repositorios con implementaciones básicas
class InMemoryServiceZoneCapacityRepository extends SimpleInMemoryRepository<ServiceZoneCapacity> implements ServiceZoneCapacityRepository {
  async findByService(serviceId: string) {
    return this.store.filter(s => s.service_id === serviceId);
  }
  async findByZone(zoneId: string) {
    return this.store.filter(s => s.zone_id === zoneId);
  }
}

class InMemoryClosureDaysRepository extends SimpleInMemoryRepository<ClosureDay> implements ClosureDaysRepository {
  async findByLocation(locationId: string) {
    return this.store.filter(c => c.location_id === locationId);
  }
  async findByDate(locationId: string, date: string) {
    return this.store.findOne(c => c.location_id === locationId && c.date === date);
  }
  async isClosedOn(locationId: string, date: string) {
    const closure = await this.findByDate(locationId, date);
    return closure !== null;
  }
}

class InMemoryWaitlistRepository extends SimpleInMemoryRepository<WaitlistEntry> implements WaitlistRepository {
  async findByLocation(locationId: string) {
    return this.store.filter(w => w.location_id === locationId);
  }
  async findActive(locationId: string) {
    return this.store.filter(
      w => w.location_id === locationId && ['waiting', 'notified'].includes(w.status)
    );
  }
  async addToWaitlist(locationId: string, input: AddToWaitlistInput) {
    return this.create({
      location_id: locationId,
      ...input,
      status: 'waiting',
      notified_at: null,
      updated_at: now(),
    } as any);
  }
  async markAsSeated(id: string) {
    await this.update(id, { status: 'seated', updated_at: now() } as any);
  }
  async markAsLeft(id: string) {
    await this.update(id, { status: 'left', updated_at: now() } as any);
  }
  async markAsNotified(id: string) {
    await this.update(id, { status: 'notified', notified_at: now(), updated_at: now() } as any);
  }
}

class InMemoryMessageTemplatesRepository extends SimpleInMemoryRepository<MessageTemplate> implements MessageTemplatesRepository {
  async findByType(type: MessageTemplate['type']) {
    return this.store.filter(m => m.type === type);
  }
  async findActiveByType(type: MessageTemplate['type'], channel: MessageTemplate['channel']) {
    return this.store.findOne(m => m.type === type && m.channel === channel && m.is_active);
  }
}

class InMemoryMessageLogsRepository extends SimpleInMemoryRepository<MessageLog> implements MessageLogsRepository {
  async findByReservation(reservationId: string) {
    return this.store.filter(m => m.reservation_id === reservationId);
  }
  async findByCustomer(customerId: string) {
    return this.store.filter(m => m.customer_profile_id === customerId);
  }
  async logMessage(log: Omit<MessageLog, 'id' | 'created_at'>) {
    return this.create(log as any);
  }
  async markAsSent(id: string) {
    await this.update(id, { status: 'sent', sent_at: now() } as any);
  }
  async markAsDelivered(id: string) {
    await this.update(id, { status: 'delivered', delivered_at: now() } as any);
  }
  async markAsFailed(id: string, error: string) {
    await this.update(id, { status: 'failed', error } as any);
  }
}

class InMemoryPromoCodesRepository extends SimpleInMemoryRepository<PromoCode> implements PromoCodesRepository {
  async findByCode(code: string) {
    return this.store.findOne(p => p.code.toUpperCase() === code.toUpperCase());
  }
  async findActiveByCode(code: string) {
    const promo = await this.findByCode(code);
    if (!promo || !promo.is_active) return null;
    const nowDate = new Date();
    if (new Date(promo.valid_from) > nowDate || new Date(promo.valid_until) < nowDate) return null;
    return promo;
  }
  async findActive(locationId?: string) {
    const nowDate = new Date().toISOString();
    return this.store.filter(
      p =>
        p.is_active &&
        p.valid_from <= nowDate &&
        p.valid_until >= nowDate &&
        (!locationId || !p.location_id || p.location_id === locationId)
    );
  }
  async validatePromoCode(code: string, locationId: string, partySize: number, serviceId: string) {
    const promo = await this.findActiveByCode(code);
    if (!promo) return { valid: false, reason: 'Código no válido o expirado' };
    if (promo.location_id && promo.location_id !== locationId) {
      return { valid: false, reason: 'Código no válido para esta ubicación' };
    }
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return { valid: false, reason: 'Código agotado' };
    }
    if (promo.min_party_size && partySize < promo.min_party_size) {
      return { valid: false, reason: `Código válido solo para grupos de ${promo.min_party_size} o más` };
    }
    if (promo.applicable_services.length > 0 && !promo.applicable_services.includes(serviceId)) {
      return { valid: false, reason: 'Código no válido para este servicio' };
    }
    return { valid: true, discount: promo.discount_value };
  }
  async incrementUsage(id: string) {
    const promo = await this.findById(id);
    if (promo) {
      await this.update(id, { current_uses: promo.current_uses + 1 } as any);
    }
  }
}

class InMemoryPromoCodeUsageRepository extends SimpleInMemoryRepository<PromoCodeUsage> implements PromoCodeUsageRepository {
  async findByPromoCode(promoCodeId: string) {
    return this.store.filter(u => u.promo_code_id === promoCodeId);
  }
  async findByCustomer(customerId: string) {
    return this.store.filter(u => u.customer_profile_id === customerId);
  }
  async recordUsage(promoCodeId: string, reservationId: string, customerId: string | null, discountAmount: number) {
    return this.create({
      promo_code_id: promoCodeId,
      reservation_id: reservationId,
      customer_profile_id: customerId,
      discount_amount: discountAmount,
      used_at: now(),
    } as any);
  }
}

class InMemoryTagsRepository extends SimpleInMemoryRepository<CustomerTag> implements TagsRepository {
  async findByName(name: string) {
    return this.store.findOne(t => t.name.toLowerCase() === name.toLowerCase());
  }
}

class InMemorySurveysRepository extends SimpleInMemoryRepository<Survey> implements SurveysRepository {
  async findActive(locationId: string) {
    return this.store.findOne(s => s.location_id === locationId && s.is_active);
  }
  async findByLocation(locationId: string) {
    return this.store.filter(s => s.location_id === locationId);
  }
}

class InMemorySurveyResponsesRepository extends SimpleInMemoryRepository<SurveyResponse> implements SurveyResponsesRepository {
  async findBySurvey(surveyId: string) {
    return this.store.filter(r => r.survey_id === surveyId);
  }
  async findByReservation(reservationId: string) {
    return this.store.findOne(r => r.reservation_id === reservationId);
  }
  async submitResponse(response: Omit<SurveyResponse, 'id' | 'submitted_at'>) {
    return this.create({ ...response, submitted_at: now() } as any);
  }
}

class InMemoryGoogleReservationsRepository extends SimpleInMemoryRepository<GoogleReservationSource> implements GoogleReservationsRepository {
  async findByLocation(locationId: string) {
    return this.store.findOne(g => g.location_id === locationId);
  }
  async updateSyncStatus(id: string, status: GoogleReservationSource['sync_status'], lastSyncAt: string) {
    await this.update(id, { sync_status: status, last_sync_at: lastSyncAt } as any);
  }
}

class InMemoryPosIntegrationRepository extends SimpleInMemoryRepository<PosIntegration> implements PosIntegrationRepository {
  async findByLocation(locationId: string) {
    return this.store.findOne(p => p.location_id === locationId);
  }
  async updateSyncStatus(id: string, lastSyncAt: string) {
    await this.update(id, { last_sync_at: lastSyncAt } as any);
  }
}

// ============= Main Data Layer =============

export function createInMemoryDataLayer(): ReservationsDataLayer {
  const reservations = new InMemoryReservationsRepository();
  const customers = new InMemoryCustomersRepository();
  const deposits = new InMemoryDepositsRepository();
  const zones = new InMemoryZonesRepository();
  const tables = new InMemoryTablesRepository();
  const services = new InMemoryServicesRepository();
  const serviceZoneCapacity = new InMemoryServiceZoneCapacityRepository();
  const closureDays = new InMemoryClosureDaysRepository();
  const waitlist = new InMemoryWaitlistRepository();
  const messageTemplates = new InMemoryMessageTemplatesRepository();
  const messageLogs = new InMemoryMessageLogsRepository();
  const promoCodes = new InMemoryPromoCodesRepository();
  const promoCodeUsage = new InMemoryPromoCodeUsageRepository();
  const settings = new InMemorySettingsRepository();
  const tags = new InMemoryTagsRepository();
  const surveys = new InMemorySurveysRepository();
  const surveyResponses = new InMemorySurveyResponsesRepository();
  const googleReservations = new InMemoryGoogleReservationsRepository();
  const posIntegration = new InMemoryPosIntegrationRepository();

  return {
    reservations,
    customers,
    deposits,
    zones,
    tables,
    services,
    serviceZoneCapacity,
    closureDays,
    waitlist,
    messageTemplates,
    messageLogs,
    promoCodes,
    promoCodeUsage,
    settings,
    tags,
    surveys,
    surveyResponses,
    googleReservations,
    posIntegration,
  };
}
