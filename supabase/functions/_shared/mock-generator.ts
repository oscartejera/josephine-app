// Mock data generator for POS providers
// Used when no real credentials are available

import { RawTicket, RawTicketLine, RawPayment } from './normalize.ts';

const ITEM_NAMES = [
  { name: 'Hamburguesa Classic', category: 'Burgers', price: 12.50 },
  { name: 'Pizza Margherita', category: 'Pizzas', price: 14.00 },
  { name: 'Ensalada César', category: 'Ensaladas', price: 9.50 },
  { name: 'Tacos al Pastor', category: 'Tacos', price: 11.00 },
  { name: 'Pasta Carbonara', category: 'Pastas', price: 13.50 },
  { name: 'Sushi Roll Mix', category: 'Sushi', price: 18.00 },
  { name: 'Cerveza Artesanal', category: 'Bebidas', price: 5.50 },
  { name: 'Café Americano', category: 'Bebidas', price: 2.50 },
  { name: 'Agua Mineral', category: 'Bebidas', price: 2.00 },
  { name: 'Postre del Día', category: 'Postres', price: 6.00 },
  { name: 'Nachos con Guacamole', category: 'Entrantes', price: 8.50 },
  { name: 'Croquetas Caseras', category: 'Entrantes', price: 7.00 },
];

const CHANNELS = ['dinein', 'takeaway', 'delivery', 'dinein', 'dinein']; // weighted towards dinein
const PAYMENT_METHODS: ('card' | 'cash' | 'other')[] = ['card', 'card', 'cash', 'card']; // weighted towards card

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTicketId(provider: string, index: number): string {
  const date = new Date();
  return `${provider.toUpperCase()}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${index.toString().padStart(4, '0')}`;
}

export interface MockTicketData {
  ticket: RawTicket;
  lines: RawTicketLine[];
  payments: RawPayment[];
}

export function generateMockTicket(provider: string, index: number, daysAgo: number = 0): MockTicketData {
  const ticketDate = new Date();
  ticketDate.setDate(ticketDate.getDate() - daysAgo);
  ticketDate.setHours(randomBetween(10, 22), randomBetween(0, 59), 0, 0);
  
  const closedDate = new Date(ticketDate);
  closedDate.setMinutes(closedDate.getMinutes() + randomBetween(20, 90));
  
  const numLines = randomBetween(1, 5);
  const lines: RawTicketLine[] = [];
  let grossTotal = 0;
  
  for (let i = 0; i < numLines; i++) {
    const item = randomItem(ITEM_NAMES);
    const qty = randomBetween(1, 3);
    const lineTotal = item.price * qty;
    grossTotal += lineTotal;
    
    lines.push({
      external_line_id: `${generateTicketId(provider, index)}-L${i + 1}`,
      item_external_id: `${provider.toUpperCase()}-ITEM-${ITEM_NAMES.indexOf(item) + 1}`,
      item_name: item.name,
      category_name: item.category,
      quantity: qty,
      unit_price: item.price,
      gross_line_total: lineTotal,
      discount_line_total: 0,
      tax_rate: 10,
      voided: false,
      comped: false,
    });
  }
  
  // Apply occasional discount
  const hasDiscount = Math.random() > 0.85;
  const discountTotal = hasDiscount ? Math.round(grossTotal * 0.1 * 100) / 100 : 0;
  const netTotal = grossTotal - discountTotal;
  const taxTotal = Math.round(netTotal * 0.1 * 100) / 100;
  
  const ticket: RawTicket = {
    external_id: generateTicketId(provider, index),
    opened_at: ticketDate.toISOString(),
    closed_at: closedDate.toISOString(),
    table_name: randomItem(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Barra', null, null]),
    covers: randomBetween(1, 4),
    channel: randomItem(CHANNELS),
    gross_total: grossTotal,
    net_total: netTotal,
    tax_total: taxTotal,
    discount_total: discountTotal,
    status: 'closed',
  };
  
  // Split payment randomly
  const paymentMethod = randomItem(PAYMENT_METHODS);
  const payments: RawPayment[] = [{
    method: paymentMethod,
    amount: netTotal + taxTotal,
    paid_at: closedDate.toISOString(),
  }];
  
  return { ticket, lines, payments };
}

export function generateMockBatch(provider: string, numTickets: number, daysSpread: number = 7): MockTicketData[] {
  const result: MockTicketData[] = [];
  
  for (let i = 0; i < numTickets; i++) {
    const daysAgo = Math.floor((i / numTickets) * daysSpread);
    result.push(generateMockTicket(provider, i + 1, daysAgo));
  }
  
  return result;
}
