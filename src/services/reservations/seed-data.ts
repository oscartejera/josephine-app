/**
 * Seed Data for Reservations Module
 * Datos de demostración para el módulo de reservas
 */

import type {
  Reservation,
  CustomerProfile,
  Zone,
  Table,
  Service,
  ReservationSettings,
  CustomerTag,
  MessageTemplate,
  PromoCode,
  ClosureDay,
} from '@/types/reservations';

// ============= Location IDs (usar los del sistema existente) =============
// Por ahora uso un ID genérico, se debe adaptar a los IDs reales
const DEMO_LOCATION_ID = 'demo-location-1';

// ============= Customer Tags =============
export const demoTags: CustomerTag[] = [
  {
    id: 'tag-1',
    name: 'VIP',
    color: '#fbbf24',
    description: 'Cliente VIP con tratamiento especial',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Regular',
    color: '#3b82f6',
    description: 'Cliente habitual',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-3',
    name: 'Influencer',
    color: '#ec4899',
    description: 'Influencer o prensa',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-4',
    name: 'Empresa',
    color: '#8b5cf6',
    description: 'Cliente corporativo',
    created_at: '2024-01-01T00:00:00Z',
  },
];

// ============= Customer Profiles =============
export const demoCustomers: CustomerProfile[] = [
  {
    id: 'customer-1',
    group_id: null,
    name: 'María García López',
    email: 'maria.garcia@example.com',
    phone: '+34666111222',
    notes: 'Prefiere mesa junto a la ventana. Alérgica a frutos secos.',
    tags: ['VIP', 'Regular'],
    total_visits: 28,
    total_spent: 3420.50,
    total_no_shows: 0,
    total_cancellations: 2,
    last_visit_at: '2024-01-25T20:30:00Z',
    created_at: '2023-03-15T00:00:00Z',
    updated_at: '2024-01-25T20:30:00Z',
    max_party_size_limit: null,
    is_blocked: false,
    block_reason: null,
  },
  {
    id: 'customer-2',
    group_id: null,
    name: 'Carlos Martínez',
    email: 'carlos.martinez@example.com',
    phone: '+34677222333',
    notes: 'Celebra su cumpleaños en marzo',
    tags: ['Regular'],
    total_visits: 15,
    total_spent: 1850.00,
    total_no_shows: 0,
    total_cancellations: 1,
    last_visit_at: '2024-01-20T21:00:00Z',
    created_at: '2023-06-10T00:00:00Z',
    updated_at: '2024-01-20T21:00:00Z',
    max_party_size_limit: null,
    is_blocked: false,
    block_reason: null,
  },
  {
    id: 'customer-3',
    group_id: null,
    name: 'Ana Rodríguez',
    email: 'ana.rodriguez@example.com',
    phone: '+34688333444',
    notes: 'Influencer gastronómica con 50k seguidores',
    tags: ['Influencer', 'VIP'],
    total_visits: 8,
    total_spent: 980.00,
    total_no_shows: 0,
    total_cancellations: 0,
    last_visit_at: '2024-01-18T20:00:00Z',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2024-01-18T20:00:00Z',
    max_party_size_limit: null,
    is_blocked: false,
    block_reason: null,
  },
  {
    id: 'customer-4',
    group_id: null,
    name: 'Tech Solutions SL',
    email: 'eventos@techsolutions.com',
    phone: '+34699444555',
    notes: 'Empresa tecnológica. Suelen hacer comidas de equipo',
    tags: ['Empresa'],
    total_visits: 12,
    total_spent: 4200.00,
    total_no_shows: 1,
    total_cancellations: 3,
    last_visit_at: '2024-01-15T14:00:00Z',
    created_at: '2023-05-20T00:00:00Z',
    updated_at: '2024-01-15T14:00:00Z',
    max_party_size_limit: 20,
    is_blocked: false,
    block_reason: null,
  },
];

// ============= Zones =============
export const demoZones: Zone[] = [
  {
    id: 'zone-1',
    location_id: DEMO_LOCATION_ID,
    name: 'Terraza',
    description: 'Zona exterior con vistas',
    capacity: 40,
    position: { x: 0, y: 0 },
    color: '#10b981',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'zone-2',
    location_id: DEMO_LOCATION_ID,
    name: 'Salón Principal',
    description: 'Comedor interior principal',
    capacity: 60,
    position: { x: 400, y: 0 },
    color: '#3b82f6',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'zone-3',
    location_id: DEMO_LOCATION_ID,
    name: 'Privado',
    description: 'Sala privada para eventos',
    capacity: 20,
    position: { x: 800, y: 0 },
    color: '#8b5cf6',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'zone-4',
    location_id: DEMO_LOCATION_ID,
    name: 'Barra',
    description: 'Mesas altas en barra',
    capacity: 12,
    position: { x: 400, y: 400 },
    color: '#f59e0b',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// ============= Tables =============
export const demoTables: Table[] = [
  // Terraza
  { id: 'table-t1', location_id: DEMO_LOCATION_ID, zone_id: 'zone-1', name: 'T1', min_capacity: 2, max_capacity: 4, position: { x: 50, y: 50, width: 80, height: 80 }, shape: 'square', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-t2', location_id: DEMO_LOCATION_ID, zone_id: 'zone-1', name: 'T2', min_capacity: 2, max_capacity: 4, position: { x: 150, y: 50, width: 80, height: 80 }, shape: 'square', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-t3', location_id: DEMO_LOCATION_ID, zone_id: 'zone-1', name: 'T3', min_capacity: 2, max_capacity: 2, position: { x: 250, y: 50, width: 60, height: 60 }, shape: 'circle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-t4', location_id: DEMO_LOCATION_ID, zone_id: 'zone-1', name: 'T4', min_capacity: 4, max_capacity: 6, position: { x: 50, y: 150, width: 100, height: 80 }, shape: 'rectangle', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-t5', location_id: DEMO_LOCATION_ID, zone_id: 'zone-1', name: 'T5', min_capacity: 4, max_capacity: 6, position: { x: 170, y: 150, width: 100, height: 80 }, shape: 'rectangle', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  
  // Salón Principal
  { id: 'table-s1', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S1', min_capacity: 2, max_capacity: 4, position: { x: 420, y: 50, width: 80, height: 80 }, shape: 'square', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-s2', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S2', min_capacity: 2, max_capacity: 4, position: { x: 520, y: 50, width: 80, height: 80 }, shape: 'square', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-s3', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S3', min_capacity: 2, max_capacity: 4, position: { x: 620, y: 50, width: 80, height: 80 }, shape: 'square', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-s4', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S4', min_capacity: 4, max_capacity: 8, position: { x: 420, y: 150, width: 120, height: 100 }, shape: 'rectangle', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-s5', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S5', min_capacity: 4, max_capacity: 8, position: { x: 560, y: 150, width: 120, height: 100 }, shape: 'rectangle', is_combinable: true, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-s6', location_id: DEMO_LOCATION_ID, zone_id: 'zone-2', name: 'S6', min_capacity: 2, max_capacity: 2, position: { x: 700, y: 150, width: 60, height: 60 }, shape: 'circle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  
  // Privado
  { id: 'table-p1', location_id: DEMO_LOCATION_ID, zone_id: 'zone-3', name: 'P1', min_capacity: 8, max_capacity: 20, position: { x: 820, y: 50, width: 200, height: 150 }, shape: 'rectangle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  
  // Barra
  { id: 'table-b1', location_id: DEMO_LOCATION_ID, zone_id: 'zone-4', name: 'B1', min_capacity: 1, max_capacity: 2, position: { x: 420, y: 420, width: 50, height: 50 }, shape: 'circle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-b2', location_id: DEMO_LOCATION_ID, zone_id: 'zone-4', name: 'B2', min_capacity: 1, max_capacity: 2, position: { x: 490, y: 420, width: 50, height: 50 }, shape: 'circle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'table-b3', location_id: DEMO_LOCATION_ID, zone_id: 'zone-4', name: 'B3', min_capacity: 1, max_capacity: 2, position: { x: 560, y: 420, width: 50, height: 50 }, shape: 'circle', is_combinable: false, combined_with: [], is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

// ============= Services =============
export const demoServices: Service[] = [
  {
    id: 'service-lunch',
    location_id: DEMO_LOCATION_ID,
    name: 'Almuerzo',
    start_time: '13:00',
    end_time: '16:00',
    days_of_week: [1, 2, 3, 4, 5, 6, 0], // Todos los días
    max_covers: 100,
    slot_duration_minutes: 15,
    default_reservation_duration: 90,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'service-dinner',
    location_id: DEMO_LOCATION_ID,
    name: 'Cena',
    start_time: '20:00',
    end_time: '23:30',
    days_of_week: [1, 2, 3, 4, 5, 6, 0],
    max_covers: 120,
    slot_duration_minutes: 15,
    default_reservation_duration: 120,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'service-brunch',
    location_id: DEMO_LOCATION_ID,
    name: 'Brunch',
    start_time: '11:00',
    end_time: '14:00',
    days_of_week: [6, 0], // Solo sábado y domingo
    max_covers: 80,
    slot_duration_minutes: 15,
    default_reservation_duration: 90,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// ============= Settings =============
export const demoSettings: ReservationSettings = {
  id: 'settings-1',
  location_id: DEMO_LOCATION_ID,
  default_reservation_duration: 90,
  slot_duration_minutes: 15,
  max_covers_per_slot: null,
  max_party_size: 12,
  min_party_size: 1,
  require_deposit: true,
  deposit_amount_per_person: 10,
  deposit_required_for_party_size: 6,
  auto_confirm: false,
  require_reconfirmation: true,
  reconfirmation_hours_before: 24,
  send_confirmation_email: true,
  send_reminder: true,
  reminder_hours_before: 24,
  cancellation_deadline_hours: 24,
  charge_cancellation_fee: true,
  cancellation_fee_percentage: 50,
  track_no_shows: true,
  block_after_no_shows: 3,
  enable_waitlist: true,
  auto_assign_from_waitlist: true,
  confirmation_message: 'Gracias por tu reserva en Josephine. Te esperamos!',
  cancellation_policy: 'Cancelaciones gratuitas hasta 24h antes. Después se cobrará el 50% del depósito.',
  enable_table_combining: true,
  enable_promo_codes: true,
  enable_google_reservations: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ============= Message Templates =============
export const demoMessageTemplates: MessageTemplate[] = [
  {
    id: 'template-1',
    location_id: DEMO_LOCATION_ID,
    type: 'confirmation',
    channel: 'email',
    subject: 'Confirmación de Reserva - Josephine',
    body: `Hola {{guest_name}},

Tu reserva ha sido confirmada:
📅 Fecha: {{date}}
🕐 Hora: {{time}}
👥 Comensales: {{party_size}}
📍 Mesa: {{table_name}}

{{confirmation_message}}

{{cancellation_policy}}

¡Te esperamos!
Josephine`,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'template-2',
    location_id: DEMO_LOCATION_ID,
    type: 'reminder',
    channel: 'email',
    subject: 'Recordatorio de Reserva - Josephine',
    body: `Hola {{guest_name}},

Te recordamos tu reserva para mañana:
📅 Fecha: {{date}}
🕐 Hora: {{time}}
👥 Comensales: {{party_size}}

Si necesitas modificar tu reserva, por favor contáctanos.

¡Hasta pronto!
Josephine`,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'template-3',
    location_id: DEMO_LOCATION_ID,
    type: 'reconfirmation',
    channel: 'email',
    subject: 'Por favor confirma tu reserva - Josephine',
    body: `Hola {{guest_name}},

Por favor, confirma tu reserva para mañana:
📅 Fecha: {{date}}
🕐 Hora: {{time}}
👥 Comensales: {{party_size}}

Haz clic aquí para confirmar: {{confirmation_link}}

Si no confirmas, tu reserva podría ser cancelada.

Gracias,
Josephine`,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'template-4',
    location_id: DEMO_LOCATION_ID,
    type: 'post_visit_survey',
    channel: 'email',
    subject: '¿Qué te pareció tu visita? - Josephine',
    body: `Hola {{guest_name}},

Esperamos que hayas disfrutado tu visita a Josephine.

Nos encantaría conocer tu opinión: {{survey_link}}

Si te gustó tu experiencia, te agradeceríamos mucho una reseña:
⭐ Google: {{google_review_link}}
⭐ TripAdvisor: {{tripadvisor_review_link}}

¡Gracias por visitarnos!
Josephine`,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// ============= Promo Codes =============
export const demoPromoCodes: PromoCode[] = [
  {
    id: 'promo-1',
    location_id: null, // Válido para todos los locales
    code: 'BIENVENIDA',
    description: 'Descuento de bienvenida',
    discount_type: 'free_deposit',
    discount_value: 100,
    valid_from: '2024-01-01T00:00:00Z',
    valid_until: '2024-12-31T23:59:59Z',
    max_uses: 100,
    current_uses: 23,
    min_party_size: 4,
    applicable_services: [],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'promo-2',
    location_id: DEMO_LOCATION_ID,
    code: 'VIP2024',
    description: '20% descuento para clientes VIP',
    discount_type: 'percentage',
    discount_value: 20,
    valid_from: '2024-01-01T00:00:00Z',
    valid_until: '2024-12-31T23:59:59Z',
    max_uses: null,
    current_uses: 45,
    min_party_size: 2,
    applicable_services: ['service-dinner'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
  },
  {
    id: 'promo-3',
    location_id: DEMO_LOCATION_ID,
    code: 'SANVALENTIN',
    description: 'Especial San Valentín',
    discount_type: 'fixed_amount',
    discount_value: 15,
    valid_from: '2024-02-10T00:00:00Z',
    valid_until: '2024-02-14T23:59:59Z',
    max_uses: 50,
    current_uses: 12,
    min_party_size: 2,
    applicable_services: ['service-dinner'],
    is_active: true,
    created_at: '2024-01-20T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
  },
];

// ============= Closure Days =============
export const demoClosureDays: ClosureDay[] = [
  {
    id: 'closure-1',
    location_id: DEMO_LOCATION_ID,
    date: '2024-12-25',
    reason: 'Navidad',
    is_recurring: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'closure-2',
    location_id: DEMO_LOCATION_ID,
    date: '2024-01-01',
    reason: 'Año Nuevo',
    is_recurring: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'closure-3',
    location_id: DEMO_LOCATION_ID,
    date: '2024-02-20',
    reason: 'Evento privado',
    is_recurring: false,
    created_at: '2024-01-15T00:00:00Z',
  },
];

// ============= Sample Reservations (para hoy) =============
export function generateTodayReservations(locationId: string): Reservation[] {
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      id: 'res-today-1',
      location_id: locationId,
      pos_table_id: 'table-s1',
      guest_name: 'María García López',
      guest_phone: '+34666111222',
      guest_email: 'maria.garcia@example.com',
      party_size: 2,
      reservation_date: today,
      reservation_time: '13:30',
      duration_minutes: 90,
      status: 'confirmed',
      confirmation_sent_at: new Date(Date.now() - 3600000).toISOString(),
      reconfirmation_required: false,
      reconfirmed_at: null,
      notes: 'Mesa junto a la ventana',
      special_requests: 'Sin frutos secos',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      customer_profile_id: 'customer-1',
      source: 'online',
      zone_id: 'zone-2',
      service_id: 'service-lunch',
      deposit_id: null,
      promo_code_id: null,
      auto_assigned: false,
    },
    {
      id: 'res-today-2',
      location_id: locationId,
      pos_table_id: null,
      guest_name: 'Carlos Martínez',
      guest_phone: '+34677222333',
      guest_email: 'carlos.martinez@example.com',
      party_size: 4,
      reservation_date: today,
      reservation_time: '14:00',
      duration_minutes: 90,
      status: 'confirmed',
      confirmation_sent_at: new Date(Date.now() - 7200000).toISOString(),
      reconfirmation_required: false,
      reconfirmed_at: null,
      notes: null,
      special_requests: null,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString(),
      customer_profile_id: 'customer-2',
      source: 'manual',
      zone_id: 'zone-2',
      service_id: 'service-lunch',
      deposit_id: null,
      promo_code_id: null,
      auto_assigned: false,
    },
    {
      id: 'res-today-3',
      location_id: locationId,
      pos_table_id: 'table-t1',
      guest_name: 'Ana Rodríguez',
      guest_phone: '+34688333444',
      guest_email: 'ana.rodriguez@example.com',
      party_size: 2,
      reservation_date: today,
      reservation_time: '20:30',
      duration_minutes: 120,
      status: 'confirmed',
      confirmation_sent_at: new Date(Date.now() - 3600000).toISOString(),
      reconfirmation_required: true,
      reconfirmed_at: new Date(Date.now() - 1800000).toISOString(),
      notes: 'Influencer - Atención especial',
      special_requests: 'Mesa con buena iluminación para fotos',
      created_at: new Date(Date.now() - 259200000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
      customer_profile_id: 'customer-3',
      source: 'online',
      zone_id: 'zone-1',
      service_id: 'service-dinner',
      deposit_id: 'deposit-1',
      promo_code_id: null,
      auto_assigned: false,
    },
    {
      id: 'res-today-4',
      location_id: locationId,
      pos_table_id: null,
      guest_name: 'Pedro Sánchez',
      guest_phone: '+34611555666',
      guest_email: null,
      party_size: 6,
      reservation_date: today,
      reservation_time: '21:00',
      duration_minutes: 120,
      status: 'pending',
      confirmation_sent_at: null,
      reconfirmation_required: false,
      reconfirmed_at: null,
      notes: 'Reserva telefónica',
      special_requests: null,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
      customer_profile_id: null,
      source: 'manual',
      zone_id: 'zone-2',
      service_id: 'service-dinner',
      deposit_id: null,
      promo_code_id: null,
      auto_assigned: false,
    },
    {
      id: 'res-today-5',
      location_id: locationId,
      pos_table_id: 'table-p1',
      guest_name: 'Tech Solutions SL',
      guest_phone: '+34699444555',
      guest_email: 'eventos@techsolutions.com',
      party_size: 12,
      reservation_date: today,
      reservation_time: '21:30',
      duration_minutes: 150,
      status: 'confirmed',
      confirmation_sent_at: new Date(Date.now() - 86400000).toISOString(),
      reconfirmation_required: true,
      reconfirmed_at: null,
      notes: 'Evento corporativo - Requiere menú cerrado',
      special_requests: 'Proyector y pantalla',
      created_at: new Date(Date.now() - 604800000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      customer_profile_id: 'customer-4',
      source: 'manual',
      zone_id: 'zone-3',
      service_id: 'service-dinner',
      deposit_id: 'deposit-2',
      promo_code_id: null,
      auto_assigned: false,
    },
  ];
}

// ============= Export All =============
export function getAllSeedData(locationId: string) {
  return {
    tags: demoTags,
    customers: demoCustomers,
    zones: demoZones.map(z => ({ ...z, location_id: locationId })),
    tables: demoTables.map(t => ({ ...t, location_id: locationId, zone_id: t.zone_id })),
    services: demoServices.map(s => ({ ...s, location_id: locationId })),
    settings: { ...demoSettings, location_id: locationId },
    messageTemplates: demoMessageTemplates.map(t => ({ ...t, location_id: locationId })),
    promoCodes: demoPromoCodes.map(p => p.location_id ? { ...p, location_id: locationId } : p),
    closureDays: demoClosureDays.map(c => ({ ...c, location_id: locationId })),
    reservations: generateTodayReservations(locationId),
  };
}
