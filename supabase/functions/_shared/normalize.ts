// Shared normalization utilities for POS integrations
// All functions convert external POS data to core model format

export interface RawTicket {
  external_id: string;
  opened_at: string | Date;
  closed_at?: string | Date | null;
  table_name?: string | null;
  covers?: number;
  channel?: string;
  gross_total?: number;
  net_total?: number;
  tax_total?: number;
  discount_total?: number;
  status?: string;
}

export interface RawTicketLine {
  external_line_id?: string;
  item_external_id?: string;
  item_name: string;
  category_name?: string;
  quantity?: number;
  unit_price?: number;
  gross_line_total?: number;
  discount_line_total?: number;
  tax_rate?: number;
  voided?: boolean;
  comped?: boolean;
}

export interface RawPayment {
  method: 'card' | 'cash' | 'other';
  amount: number;
  paid_at?: string | Date;
}

export interface NormalizedTicket {
  external_id: string;
  location_id: string;
  opened_at: string;
  closed_at: string | null;
  table_name: string | null;
  covers: number | null;
  channel: 'dinein' | 'takeaway' | 'delivery' | 'unknown';
  gross_total: number;
  net_total: number;
  tax_total: number;
  discount_total: number;
  status: 'open' | 'closed';
}

export interface NormalizedTicketLine {
  ticket_id: string;
  external_line_id: string | null;
  item_external_id: string | null;
  item_name: string;
  category_name: string | null;
  quantity: number;
  unit_price: number;
  gross_line_total: number;
  discount_line_total: number;
  tax_rate: number | null;
  voided: boolean;
  comped: boolean;
}

export interface NormalizedPayment {
  ticket_id: string;
  method: 'card' | 'cash' | 'other';
  amount: number;
  paid_at: string;
}

// Convert any timestamp to UTC ISO string
export function toUTC(input: string | Date | null | undefined): string | null {
  if (!input) return null;
  try {
    const date = typeof input === 'string' ? new Date(input) : input;
    return date.toISOString();
  } catch {
    return null;
  }
}

// Map channel strings to enum values
export function normalizeChannel(channel?: string): 'dinein' | 'takeaway' | 'delivery' | 'unknown' {
  if (!channel) return 'unknown';
  const c = channel.toLowerCase();
  if (c.includes('dine') || c.includes('local') || c.includes('mesa') || c.includes('table')) return 'dinein';
  if (c.includes('take') || c.includes('recoger') || c.includes('pickup')) return 'takeaway';
  if (c.includes('deliv') || c.includes('envio') || c.includes('domicilio')) return 'delivery';
  return 'unknown';
}

// Normalize a single ticket
export function normalizeTicket(raw: RawTicket, locationId: string): NormalizedTicket {
  const openedAt = toUTC(raw.opened_at) || new Date().toISOString();
  const closedAt = toUTC(raw.closed_at);
  
  return {
    external_id: raw.external_id,
    location_id: locationId,
    opened_at: openedAt,
    closed_at: closedAt,
    table_name: raw.table_name || null,
    covers: raw.covers ?? null,
    channel: normalizeChannel(raw.channel),
    gross_total: raw.gross_total ?? 0,
    net_total: raw.net_total ?? raw.gross_total ?? 0,
    tax_total: raw.tax_total ?? 0,
    discount_total: raw.discount_total ?? 0,
    status: raw.status === 'open' ? 'open' : 'closed',
  };
}

// Normalize a ticket line
export function normalizeTicketLine(raw: RawTicketLine, ticketId: string, index: number): NormalizedTicketLine {
  const qty = raw.quantity ?? 1;
  const unitPrice = raw.unit_price ?? 0;
  const grossTotal = raw.gross_line_total ?? (qty * unitPrice);
  
  return {
    ticket_id: ticketId,
    external_line_id: raw.external_line_id || `line_${index}`,
    item_external_id: raw.item_external_id || null,
    item_name: raw.item_name,
    category_name: raw.category_name || null,
    quantity: qty,
    unit_price: unitPrice,
    gross_line_total: grossTotal,
    discount_line_total: raw.discount_line_total ?? 0,
    tax_rate: raw.tax_rate ?? null,
    voided: raw.voided ?? false,
    comped: raw.comped ?? false,
  };
}

// Normalize a payment
export function normalizePayment(raw: RawPayment, ticketId: string): NormalizedPayment {
  return {
    ticket_id: ticketId,
    method: raw.method || 'other',
    amount: raw.amount ?? 0,
    paid_at: toUTC(raw.paid_at) || new Date().toISOString(),
  };
}

// Create unique external_id with provider prefix to avoid collisions
export function createExternalId(provider: string, locationId: string, originalId: string): string {
  return `${provider}_${locationId.slice(0, 8)}_${originalId}`;
}

// Payment method mapping
export function normalizePaymentMethod(method?: string): 'card' | 'cash' | 'other' {
  if (!method) return 'other';
  const m = method.toLowerCase();
  if (m.includes('card') || m.includes('tarjeta') || m.includes('visa') || m.includes('master')) return 'card';
  if (m.includes('cash') || m.includes('efectivo') || m.includes('dinero')) return 'cash';
  return 'other';
}
