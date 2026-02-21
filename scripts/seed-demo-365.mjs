/**
 * Comprehensive 365-day seed script for investor demo.
 * Populates ALL tables with coherent, deterministic data.
 *
 * Run: npm run seed:demo
 *
 * Design:
 * - Idempotent: deletes all demo org data first
 * - Deterministic: seeded PRNG (not Math.random)
 * - Coherent: sales -> orders -> items -> COGS chain is consistent
 * - Full coverage: 365 days back + 30 days forward
 *
 * Schema validated against live DB on 2026-02-20.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// --- Config ---
const SUPABASE_URL = 'https://qixipveebfhurbarksib.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Deterministic IDs ---
function deterministicUUID(seed) {
  const hash = createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

// --- Seeded PRNG ---
class SeededRandom {
  constructor(seed) {
    this.state = this._hash(String(seed));
  }
  _hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }
  next() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) { return min + this.next() * (max - min); }
  intRange(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weightedPick(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// --- Constants ---
const ORG_ID = '7bca34d5-4448-40b8-bb7f-55f1417aeccd';
const USER_ID = '647bcd4f-2e75-4b8b-9b6b-e20be416d935';
const EXISTING_LOC = 'f9f0637c-69ae-468f-bce8-0d519aea702e';
const LOC_CENTRO = deterministicUUID('loc-centro');
const LOC_CHAMBERI = deterministicUUID('loc-chamberi');
const LOC_SALAMANCA = deterministicUUID('loc-salamanca');

const ALL_LOCS = [EXISTING_LOC, LOC_CENTRO, LOC_CHAMBERI, LOC_SALAMANCA];
const LOC_PROFILES = [
  { id: EXISTING_LOC, name: 'La Taberna Malasana', baseSales: 4500, avgCheck: 24 },
  { id: LOC_CENTRO, name: 'La Taberna Centro', baseSales: 5500, avgCheck: 26 },
  { id: LOC_CHAMBERI, name: 'La Taberna Chamberi', baseSales: 5000, avgCheck: 24 },
  { id: LOC_SALAMANCA, name: 'La Taberna Salamanca', baseSales: 4000, avgCheck: 23 },
];

const DOW_MULT = [1.10, 0.80, 0.90, 0.95, 1.00, 1.35, 1.45]; // Sun=0..Sat=6
function getSeasonalMult(month) {
  if ([6, 7, 8].includes(month)) return 1.15;
  if ([3, 4, 5].includes(month)) return 1.05;
  if (month === 12) return 1.10;
  if ([1, 2].includes(month)) return 0.90;
  return 1.00;
}

// --- Helpers ---
function dateStr(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function round2(n) { return Math.round(n * 100) / 100; }

async function batchUpsert(table, rows, options = {}) {
  if (rows.length === 0) return 0;
  const batchSize = options.batchSize || 500;
  const conflict = options.onConflict;
  let ok = 0;
  let errorCount = 0;
  const totalBatches = Math.ceil(rows.length / batchSize);
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    // Use upsert only when we know the conflict key; plain insert otherwise
    const hasId = batch[0] && ('id' in batch[0]);
    const q = (conflict || hasId)
      ? supabase.from(table).upsert(batch, {
          onConflict: conflict || 'id',
          ignoreDuplicates: !conflict,
          count: 'exact',
        })
      : supabase.from(table).insert(batch, { count: 'exact' });
    const { error, count } = await q;
    if (error) {
      errorCount++;
      if (errorCount <= 3) {
        console.error(`  [${table}] batch ${batchNum}/${totalBatches} error: ${error.message}`);
      } else if (errorCount === 4) {
        console.error(`  [${table}] ... suppressing further errors`);
      }
    } else {
      ok += count ?? batch.length;
    }
    // Progress for large inserts
    if (totalBatches > 20 && batchNum % 20 === 0) {
      process.stdout.write(`  [${table}] ${batchNum}/${totalBatches} batches...\r`);
    }
  }
  if (totalBatches > 20) process.stdout.write('\x1b[2K'); // clear progress line
  const status = errorCount > 0 ? ` (${errorCount} batch errors)` : '';
  console.log(`  ${table}: ${ok}/${rows.length} rows${status}`);
  return ok;
}

async function safeDelete(table, column, value) {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq(column, value);
  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
      // Column doesn't exist on this table -- not an error for us
      return false;
    }
    console.error(`  DELETE ${table}.${column}: ${error.message}`);
    return false;
  }
  console.log(`  DELETE ${table} (${column}=${String(value).slice(0,8)}...): ${count ?? '?'} rows`);
  return true;
}

async function deleteByOrgOrLocations(table) {
  // Special case: recipe_ingredients has no org_id — delete via menu_item_id
  if (table === 'recipe_ingredients') {
    const { data: mis } = await supabase.from('menu_items').select('id').eq('org_id', ORG_ID);
    if (mis?.length) {
      for (let i = 0; i < mis.length; i += 50) {
        const batch = mis.slice(i, i + 50).map(m => m.id);
        await supabase.from('recipe_ingredients').delete().in('menu_item_id', batch);
      }
      console.log(`  DELETE recipe_ingredients: via ${mis.length} menu_items`);
    }
    return;
  }
  // Try org_id first
  const orgOk = await safeDelete(table, 'org_id', ORG_ID);
  if (orgOk) return;
  // Try group_id (payroll_runs, stock_counts use this)
  const groupOk = await safeDelete(table, 'group_id', ORG_ID);
  if (groupOk) return;
  // Fall back to location-based deletion
  for (const lid of ALL_LOCS) {
    await safeDelete(table, 'location_id', lid);
  }
}

// --- Menu Data ---
const MENU_ITEMS_DATA = [
  // Entrantes
  { name: 'Patatas bravas', cat: 'Entrantes', price: 6.50, cost_pct: 0.22 },
  { name: 'Croquetas de jamon', cat: 'Entrantes', price: 8.00, cost_pct: 0.28 },
  { name: 'Ensalada mixta', cat: 'Entrantes', price: 7.50, cost_pct: 0.20 },
  { name: 'Gazpacho andaluz', cat: 'Entrantes', price: 6.00, cost_pct: 0.18 },
  { name: 'Tortilla espanola', cat: 'Entrantes', price: 7.00, cost_pct: 0.24 },
  { name: 'Calamares a la romana', cat: 'Entrantes', price: 9.50, cost_pct: 0.26 },
  // Carnes
  { name: 'Chuleton de ternera', cat: 'Carnes', price: 24.00, cost_pct: 0.35 },
  { name: 'Pollo al ajillo', cat: 'Carnes', price: 14.50, cost_pct: 0.25 },
  { name: 'Solomillo iberico', cat: 'Carnes', price: 22.00, cost_pct: 0.33 },
  { name: 'Costillas BBQ', cat: 'Carnes', price: 16.00, cost_pct: 0.28 },
  { name: 'Hamburguesa gourmet', cat: 'Carnes', price: 15.00, cost_pct: 0.30 },
  // Pescados
  { name: 'Merluza a la plancha', cat: 'Pescados', price: 16.50, cost_pct: 0.30 },
  { name: 'Pulpo a la gallega', cat: 'Pescados', price: 18.00, cost_pct: 0.32 },
  { name: 'Gambas al ajillo', cat: 'Pescados', price: 14.00, cost_pct: 0.35 },
  { name: 'Bacalao al pil-pil', cat: 'Pescados', price: 17.50, cost_pct: 0.30 },
  // Pastas
  { name: 'Pasta carbonara', cat: 'Pastas', price: 12.00, cost_pct: 0.22 },
  { name: 'Risotto de setas', cat: 'Pastas', price: 13.50, cost_pct: 0.24 },
  { name: 'Lasana casera', cat: 'Pastas', price: 13.00, cost_pct: 0.26 },
  // Postres
  { name: 'Tarta de queso', cat: 'Postres', price: 6.50, cost_pct: 0.20 },
  { name: 'Coulant de chocolate', cat: 'Postres', price: 7.50, cost_pct: 0.22 },
  { name: 'Crema catalana', cat: 'Postres', price: 5.50, cost_pct: 0.18 },
  { name: 'Helado artesanal', cat: 'Postres', price: 5.00, cost_pct: 0.25 },
  // Bebidas
  { name: 'Cerveza cana', cat: 'Bebidas', price: 2.80, cost_pct: 0.15 },
  { name: 'Copa de vino tinto', cat: 'Bebidas', price: 4.50, cost_pct: 0.20 },
  { name: 'Refresco', cat: 'Bebidas', price: 2.50, cost_pct: 0.12 },
  { name: 'Agua mineral', cat: 'Bebidas', price: 2.00, cost_pct: 0.10 },
  { name: 'Cafe solo', cat: 'Bebidas', price: 1.80, cost_pct: 0.15 },
  { name: 'Copa de sangria', cat: 'Bebidas', price: 5.50, cost_pct: 0.18 },
  { name: 'Gin tonic premium', cat: 'Bebidas', price: 8.00, cost_pct: 0.22 },
  { name: 'Copa de cava', cat: 'Bebidas', price: 6.00, cost_pct: 0.20 },
];

// Category weights for order composition
const CAT_WEIGHTS = {
  'Entrantes': 25, 'Carnes': 15, 'Pescados': 10,
  'Pastas': 10, 'Postres': 15, 'Bebidas': 25,
};

// --- Inventory Data ---
// type enum valid values: food, beverage, other
const INV_CAT_TYPE_MAP = {
  'Proteinas': 'food',
  'Verduras': 'food',
  'Lacteos': 'food',
  'Bebidas': 'beverage',
  'Secos': 'food',
};

const INV_ITEMS_DATA = [
  { name: 'Ternera (kg)', cat: 'Proteinas', unit: 'kg', price: 18.50, vat: 10 },
  { name: 'Pollo (kg)', cat: 'Proteinas', unit: 'kg', price: 6.20, vat: 10 },
  { name: 'Merluza (kg)', cat: 'Proteinas', unit: 'kg', price: 14.00, vat: 10 },
  { name: 'Gambas (kg)', cat: 'Proteinas', unit: 'kg', price: 22.00, vat: 10 },
  { name: 'Pulpo (kg)', cat: 'Proteinas', unit: 'kg', price: 16.50, vat: 10 },
  { name: 'Jamon iberico (kg)', cat: 'Proteinas', unit: 'kg', price: 45.00, vat: 10 },
  { name: 'Patatas (kg)', cat: 'Verduras', unit: 'kg', price: 1.20, vat: 4 },
  { name: 'Tomates (kg)', cat: 'Verduras', unit: 'kg', price: 2.50, vat: 4 },
  { name: 'Lechugas (ud)', cat: 'Verduras', unit: 'ud', price: 0.80, vat: 4 },
  { name: 'Cebollas (kg)', cat: 'Verduras', unit: 'kg', price: 1.10, vat: 4 },
  { name: 'Pimientos (kg)', cat: 'Verduras', unit: 'kg', price: 2.80, vat: 4 },
  { name: 'Leche entera (L)', cat: 'Lacteos', unit: 'L', price: 0.95, vat: 4 },
  { name: 'Queso manchego (kg)', cat: 'Lacteos', unit: 'kg', price: 12.50, vat: 10 },
  { name: 'Nata (L)', cat: 'Lacteos', unit: 'L', price: 3.20, vat: 10 },
  { name: 'Cerveza barril (L)', cat: 'Bebidas', unit: 'L', price: 2.10, vat: 21 },
  { name: 'Vino tinto Rioja (bot)', cat: 'Bebidas', unit: 'bot', price: 4.50, vat: 21 },
  { name: 'Refrescos (ud)', cat: 'Bebidas', unit: 'ud', price: 0.45, vat: 21 },
  { name: 'Agua mineral (ud)', cat: 'Bebidas', unit: 'ud', price: 0.20, vat: 10 },
  { name: 'Aceite oliva (L)', cat: 'Secos', unit: 'L', price: 7.80, vat: 10 },
  { name: 'Harina (kg)', cat: 'Secos', unit: 'kg', price: 0.85, vat: 4 },
  { name: 'Arroz (kg)', cat: 'Secos', unit: 'kg', price: 1.40, vat: 4 },
  { name: 'Pasta seca (kg)', cat: 'Secos', unit: 'kg', price: 1.60, vat: 4 },
  { name: 'Cafe en grano (kg)', cat: 'Secos', unit: 'kg', price: 15.00, vat: 10 },
  { name: 'Chocolate (kg)', cat: 'Secos', unit: 'kg', price: 8.50, vat: 10 },
];

// Employee data per location
const EMPLOYEE_DATA = [
  // Malasana (loc 0)
  { name: 'Lucia Fernandez', loc: 0, role: 'Chef', hourly: 17.00 },
  { name: 'Andres Jimenez', loc: 0, role: 'Cook', hourly: 14.00 },
  { name: 'Carmen Blanco', loc: 0, role: 'Bartender', hourly: 13.00 },
  { name: 'Raul Prieto', loc: 0, role: 'Waiter', hourly: 12.50 },
  { name: 'Paula Delgado', loc: 0, role: 'Waiter', hourly: 12.50 },
  { name: 'Alberto Castillo', loc: 0, role: 'Manager', hourly: 17.50 },
  // Centro (loc 1)
  { name: 'Maria Garcia', loc: 1, role: 'Chef', hourly: 17.50 },
  { name: 'Carlos Lopez', loc: 1, role: 'Cook', hourly: 14.50 },
  { name: 'Ana Martinez', loc: 1, role: 'Bartender', hourly: 13.50 },
  { name: 'Pedro Ruiz', loc: 1, role: 'Waiter', hourly: 13.00 },
  { name: 'Laura Sanchez', loc: 1, role: 'Waiter', hourly: 12.50 },
  { name: 'Miguel Torres', loc: 1, role: 'Manager', hourly: 18.00 },
  // Chamberi (loc 2)
  { name: 'Sofia Hernandez', loc: 2, role: 'Chef', hourly: 17.00 },
  { name: 'Javier Moreno', loc: 2, role: 'Cook', hourly: 14.00 },
  { name: 'Elena Diaz', loc: 2, role: 'Bartender', hourly: 13.00 },
  { name: 'Pablo Romero', loc: 2, role: 'Waiter', hourly: 12.50 },
  { name: 'Isabel Navarro', loc: 2, role: 'Waiter', hourly: 12.50 },
  { name: 'Diego Vega', loc: 2, role: 'Manager', hourly: 17.50 },
  // Salamanca (loc 3)
  { name: 'Marta Ruiz', loc: 3, role: 'Chef', hourly: 16.50 },
  { name: 'Fernando Gil', loc: 3, role: 'Cook', hourly: 13.50 },
  { name: 'Claudia Soto', loc: 3, role: 'Bartender', hourly: 12.50 },
  { name: 'Alvaro Pena', loc: 3, role: 'Waiter', hourly: 12.00 },
  { name: 'Nuria Campos', loc: 3, role: 'Waiter', hourly: 12.00 },
  { name: 'Roberto Iglesias', loc: 3, role: 'Manager', hourly: 16.50 },
];

const SUPPLIERS_DATA = [
  { name: 'Mercamadrid Frescos', days: [1, 3, 5], cutoff: '18:00', min: 100 },
  { name: 'Distribuciones Garcia', days: [2, 4], cutoff: '16:00', min: 75 },
  { name: 'Bebidas del Sur', days: [1, 4], cutoff: '14:00', min: 150 },
  { name: 'Productos Secos SL', days: [3], cutoff: '12:00', min: 50 },
];

const REVIEW_TEMPLATES = {
  5: [
    'Excelente experiencia. La comida estaba espectacular y el servicio impecable.',
    'Sin duda el mejor restaurante de la zona. Volveremos seguro.',
    'Increible calidad-precio. Los platos estaban deliciosos.',
    'Todo perfecto, desde la atencion hasta los postres. Muy recomendable.',
    'Una joya gastronomica. El chuleton de ternera es espectacular.',
  ],
  4: [
    'Muy buena comida, aunque el servicio fue un poco lento.',
    'Gran calidad en los platos. El ambiente es muy agradable.',
    'Buena relacion calidad-precio. Repetire sin duda.',
    'Nos gusto mucho, solo mejoraria los tiempos de espera.',
  ],
  3: [
    'Correcto pero sin mas. La comida estaba bien sin ser extraordinaria.',
    'Normal para la zona. Algunos platos mejor que otros.',
    'Esta bien para una comida rapida, nada especial.',
  ],
  2: [
    'Esperaba mas por el precio. La comida estaba algo sosa.',
    'El servicio dejo mucho que desear, tuvimos que esperar bastante.',
  ],
  1: [
    'Muy decepcionante. No volveremos.',
  ],
};

// --- Main ---
async function main() {
  const TODAY = new Date('2026-02-20');
  const START_DATE = addDays(TODAY, -365);
  const rng = new SeededRandom('josephine-demo-365-v1');

  console.log('==================================================');
  console.log('  Josephine 365-Day Demo Seed');
  console.log('==================================================\n');
  console.log(`Date range: ${dateStr(START_DATE)} -> ${dateStr(TODAY)}`);
  console.log(`Locations: ${ALL_LOCS.length}`);
  console.log('');

  // ================================================================
  // PHASE 0: Cleanup
  // ================================================================
  console.log('-- Phase 0: Cleanup --');

  // First, handle payslip_lines which need to be deleted via payslip_id
  // Find all payroll_runs for our org, then payslips, then payslip_lines
  {
    const { data: runs } = await supabase.from('payroll_runs')
      .select('id').eq('group_id', ORG_ID);
    if (runs && runs.length > 0) {
      const runIds = runs.map(r => r.id);
      const { data: slips } = await supabase.from('payslips')
        .select('id').in('payroll_run_id', runIds);
      if (slips && slips.length > 0) {
        const slipIds = slips.map(s => s.id);
        // Delete in batches of 100 to avoid query-string limits
        for (let i = 0; i < slipIds.length; i += 100) {
          const batch = slipIds.slice(i, i + 100);
          await supabase.from('payslip_lines').delete().in('payslip_id', batch);
        }
        console.log(`  DELETE payslip_lines: via ${slipIds.length} payslips`);
        // Now delete payslips
        for (let i = 0; i < runIds.length; i += 50) {
          const batch = runIds.slice(i, i + 50);
          await supabase.from('payslips').delete().in('payroll_run_id', batch);
        }
        console.log(`  DELETE payslips: via ${runIds.length} payroll_runs`);
      }
    }
  }

  // Delete in dependency order (children first)
  // Tables with org_id or group_id
  const orgIdTables = [
    'payroll_runs',  // uses group_id (same value as org_id for us)
    'announcements', 'reviews',
    'purchase_order_lines', 'purchase_orders',
    'stock_movements',
    'budget_drivers', 'budget_metrics', 'budget_days', 'budget_versions',
    'forecast_points', 'forecast_runs',
    'shift_assignments', 'time_entries', 'shifts', 'schedules',
    'cdm_order_lines', 'cdm_orders',
    'daily_sales',
    'employment_contracts',
    'employee_locations',
    'employees',
    'inventory_item_location',
    'inventory_items', 'inventory_categories',
    'cdm_items',
    'menu_items',
    'departments',
    'suppliers',
  ];

  // Delete tables with FK to inventory_items/menu_items BEFORE orgIdTables
  // waste_events has FK to inventory_items but only has location_id (no org_id)
  for (const loc of ALL_LOCS) {
    await safeDelete('waste_events', 'location_id', loc);
  }

  // recipe_ingredients: no org_id/location_id - delete via menu_item_id from our menu_items
  {
    const { data: mis } = await supabase.from('menu_items')
      .select('id').eq('org_id', ORG_ID);
    if (mis && mis.length > 0) {
      const miIds = mis.map(m => m.id);
      for (let i = 0; i < miIds.length; i += 50) {
        const batch = miIds.slice(i, i + 50);
        await supabase.from('recipe_ingredients').delete().in('menu_item_id', batch);
      }
      console.log(`  DELETE recipe_ingredients: via ${miIds.length} menu_items`);
    }
  }

  for (const t of orgIdTables) {
    await deleteByOrgOrLocations(t);
  }

  // Tables that only have location_id (no org_id, no group_id)
  const locationOnlyTables = [
    'pos_daily_finance', 'cash_counts_daily', 'forecast_daily_metrics',
    'location_settings', 'employee_availability',
    'planned_shifts',
  ];

  // stock_count_lines need to go before stock_counts
  // Delete stock_count_lines via stock_count_id from our stock_counts
  {
    const { data: counts } = await supabase.from('stock_counts')
      .select('id').eq('group_id', ORG_ID);
    if (counts && counts.length > 0) {
      for (let i = 0; i < counts.length; i += 50) {
        const batch = counts.slice(i, i + 50).map(c => c.id);
        await supabase.from('stock_count_lines').delete().in('stock_count_id', batch);
      }
      console.log(`  DELETE stock_count_lines: via ${counts.length} stock_counts`);
    }
  }

  for (const t of locationOnlyTables) {
    for (const lid of ALL_LOCS) {
      await safeDelete(t, 'location_id', lid);
    }
  }

  // Delete stock_counts by group_id
  await safeDelete('stock_counts', 'group_id', ORG_ID);

  console.log('');

  // ================================================================
  // PHASE 1: Foundation
  // ================================================================
  console.log('-- Phase 1: Foundation --');

  // 1a. Update existing location + create new ones
  // locations columns: id, org_id, name, timezone, address, active, created_at, group_id, city
  // NO currency column
  await supabase.from('locations').update({ name: 'La Taberna Malasana' }).eq('id', EXISTING_LOC);
  await batchUpsert('locations', [
    { id: LOC_CENTRO, org_id: ORG_ID, name: 'La Taberna Centro', timezone: 'Europe/Madrid', active: true },
    { id: LOC_CHAMBERI, org_id: ORG_ID, name: 'La Taberna Chamberi', timezone: 'Europe/Madrid', active: true },
    { id: LOC_SALAMANCA, org_id: ORG_ID, name: 'La Taberna Salamanca', timezone: 'Europe/Madrid', active: true },
  ], { onConflict: 'id' });

  // 1b. Location memberships
  await batchUpsert('location_memberships', ALL_LOCS.map(lid => ({
    location_id: lid, user_id: USER_ID, role: 'owner',
  })), { onConflict: 'location_id,user_id' });

  // 1c. Location settings
  await batchUpsert('location_settings', ALL_LOCS.map(lid => ({
    location_id: lid,
    default_cogs_percent: 30,
    target_gp_percent: 68,
    target_col_percent: 28,
    opening_time: '10:00',
    closing_time: '23:00',
    splh_goal: 60,
  })), { onConflict: 'location_id' });

  // 1d. Org settings
  await batchUpsert('org_settings', [{
    org_id: ORG_ID, data_source_mode: 'manual_demo', demo_fallback_after_hours: 24,
  }], { onConflict: 'org_id' });

  // 1e. Departments (unique on org_id, name)
  const deptNames = ['Kitchen', 'Bar', 'Service', 'Management'];
  const departments = deptNames.map(name => ({
    id: deterministicUUID(`dept-${name}`),
    org_id: ORG_ID,
    name,
  }));
  await batchUpsert('departments', departments, { onConflict: 'org_id,name' });

  // 1f. Employees
  // Columns: id, org_id, profile_user_id, full_name, email, phone, status,
  //          created_at, location_id, role_name, hourly_cost, active, user_id
  const employees = EMPLOYEE_DATA.map((e) => ({
    id: deterministicUUID(`emp-${e.name}`),
    org_id: ORG_ID,
    full_name: e.name,
    email: e.name.toLowerCase().replace(/ /g, '.') + '@josephine.app',
    status: 'active',
    active: true,
    hourly_cost: e.hourly,
    role_name: e.role,
    location_id: ALL_LOCS[e.loc],
  }));
  await batchUpsert('employees', employees, { onConflict: 'id' });

  // Map employees to locations
  const empByLoc = {};
  EMPLOYEE_DATA.forEach((e, i) => {
    const locId = ALL_LOCS[e.loc];
    if (!empByLoc[locId]) empByLoc[locId] = [];
    empByLoc[locId].push({ ...employees[i], hourly: e.hourly, role: e.role });
  });

  // Employee-location assignments
  const empLocRows = [];
  EMPLOYEE_DATA.forEach((e, i) => {
    empLocRows.push({ employee_id: employees[i].id, location_id: ALL_LOCS[e.loc] });
  });
  await batchUpsert('employee_locations', empLocRows, { onConflict: 'employee_id,location_id' });

  console.log('');

  // ================================================================
  // PHASE 2: Menu + Inventory + Suppliers
  // ================================================================
  console.log('-- Phase 2: Menu + Inventory --');

  // 2a. Menu items (unique on org_id, name)
  const menuItems = MENU_ITEMS_DATA.map((item) => ({
    id: deterministicUUID(`menu-${item.name}`),
    org_id: ORG_ID,
    name: item.name,
    category: item.cat,
    is_active: true,
  }));
  await batchUpsert('menu_items', menuItems, { onConflict: 'org_id,name' });

  // 2a2. CDM items (mirrors menu_items for the CDM layer)
  // cdm_order_lines.item_id references cdm_items(id), NOT menu_items
  const cdmItems = MENU_ITEMS_DATA.map((item) => ({
    id: deterministicUUID(`cdm-item-${item.name}`),
    org_id: ORG_ID,
    name: item.name,
    category: item.cat,
    is_active: true,
  }));
  await batchUpsert('cdm_items', cdmItems, { onConflict: 'id' });

  // Build a map from menu item name to cdm_item id for order lines
  const cdmItemByName = {};
  for (const ci of cdmItems) {
    cdmItemByName[ci.name] = ci.id;
  }

  // 2b. Inventory categories (unique on org_id, name)
  const invCatNames = ['Proteinas', 'Verduras', 'Lacteos', 'Bebidas', 'Secos'];
  const invCategories = invCatNames.map(name => ({
    id: deterministicUUID(`invcat-${name}`),
    org_id: ORG_ID,
    name,
  }));
  await batchUpsert('inventory_categories', invCategories, { onConflict: 'org_id,name' });

  // 2c. Inventory items
  // type enum: food, beverage, other (NOT 'ingredient')
  const invItems = INV_ITEMS_DATA.map(item => ({
    id: deterministicUUID(`inv-${item.name}`),
    org_id: ORG_ID,
    name: item.name,
    type: INV_CAT_TYPE_MAP[item.cat] || 'other',
    category_id: invCategories[invCatNames.indexOf(item.cat)].id,
    order_unit: item.unit,
    base_unit: item.unit,
    price: item.price,
    last_cost: item.price,
    vat_rate: item.vat,
    is_active: true,
    metadata: {},
  }));
  await batchUpsert('inventory_items', invItems, { onConflict: 'id' });

  // 2d. Inventory at each location
  const invLocRows = [];
  for (const loc of ALL_LOCS) {
    for (const item of invItems) {
      invLocRows.push({
        item_id: item.id,
        location_id: loc,
        on_hand: round2(rng.range(10, 50)),
        safety_stock: round2(rng.range(3, 10)),
        reorder_point: round2(rng.range(8, 20)),
      });
    }
  }
  await batchUpsert('inventory_item_location', invLocRows, { onConflict: 'item_id,location_id' });

  // 2e. Suppliers (unique on org_id, name)
  // Columns: id, org_id, name, delivers_days, cutoff_time, min_order_value, metadata, created_at
  const suppliers = SUPPLIERS_DATA.map(s => ({
    id: deterministicUUID(`sup-${s.name}`),
    org_id: ORG_ID,
    name: s.name,
    delivers_days: s.days,
    cutoff_time: s.cutoff,
    min_order_value: s.min,
    metadata: {},
  }));
  await batchUpsert('suppliers', suppliers, { onConflict: 'org_id,name' });

  // 2f. Recipe ingredients (link menu items to inventory items)
  const recipeRows = [];
  const menuToInvMap = {
    'Patatas bravas': [{ inv: 'Patatas (kg)', qty: 0.3 }, { inv: 'Aceite oliva (L)', qty: 0.05 }],
    'Croquetas de jamon': [{ inv: 'Jamon iberico (kg)', qty: 0.08 }, { inv: 'Harina (kg)', qty: 0.05 }, { inv: 'Leche entera (L)', qty: 0.1 }],
    'Ensalada mixta': [{ inv: 'Lechugas (ud)', qty: 0.5 }, { inv: 'Tomates (kg)', qty: 0.15 }],
    'Gazpacho andaluz': [{ inv: 'Tomates (kg)', qty: 0.3 }, { inv: 'Pimientos (kg)', qty: 0.1 }, { inv: 'Aceite oliva (L)', qty: 0.03 }],
    'Tortilla espanola': [{ inv: 'Patatas (kg)', qty: 0.25 }, { inv: 'Cebollas (kg)', qty: 0.1 }],
    'Calamares a la romana': [{ inv: 'Harina (kg)', qty: 0.1 }, { inv: 'Aceite oliva (L)', qty: 0.08 }],
    'Chuleton de ternera': [{ inv: 'Ternera (kg)', qty: 0.4 }],
    'Pollo al ajillo': [{ inv: 'Pollo (kg)', qty: 0.3 }, { inv: 'Aceite oliva (L)', qty: 0.04 }],
    'Solomillo iberico': [{ inv: 'Ternera (kg)', qty: 0.25 }],
    'Costillas BBQ': [{ inv: 'Ternera (kg)', qty: 0.35 }],
    'Hamburguesa gourmet': [{ inv: 'Ternera (kg)', qty: 0.2 }, { inv: 'Lechugas (ud)', qty: 0.25 }],
    'Merluza a la plancha': [{ inv: 'Merluza (kg)', qty: 0.25 }],
    'Pulpo a la gallega': [{ inv: 'Pulpo (kg)', qty: 0.25 }, { inv: 'Patatas (kg)', qty: 0.15 }],
    'Gambas al ajillo': [{ inv: 'Gambas (kg)', qty: 0.2 }, { inv: 'Aceite oliva (L)', qty: 0.05 }],
    'Bacalao al pil-pil': [{ inv: 'Merluza (kg)', qty: 0.25 }, { inv: 'Aceite oliva (L)', qty: 0.06 }],
    'Pasta carbonara': [{ inv: 'Pasta seca (kg)', qty: 0.15 }, { inv: 'Nata (L)', qty: 0.1 }],
    'Risotto de setas': [{ inv: 'Arroz (kg)', qty: 0.15 }, { inv: 'Nata (L)', qty: 0.08 }],
    'Lasana casera': [{ inv: 'Pasta seca (kg)', qty: 0.15 }, { inv: 'Ternera (kg)', qty: 0.15 }, { inv: 'Queso manchego (kg)', qty: 0.05 }],
    'Tarta de queso': [{ inv: 'Queso manchego (kg)', qty: 0.1 }, { inv: 'Nata (L)', qty: 0.08 }],
    'Coulant de chocolate': [{ inv: 'Chocolate (kg)', qty: 0.08 }, { inv: 'Harina (kg)', qty: 0.03 }],
    'Crema catalana': [{ inv: 'Leche entera (L)', qty: 0.2 }, { inv: 'Nata (L)', qty: 0.05 }],
    'Helado artesanal': [{ inv: 'Leche entera (L)', qty: 0.15 }, { inv: 'Nata (L)', qty: 0.1 }],
    'Cerveza cana': [{ inv: 'Cerveza barril (L)', qty: 0.33 }],
    'Copa de vino tinto': [{ inv: 'Vino tinto Rioja (bot)', qty: 0.15 }],
    'Refresco': [{ inv: 'Refrescos (ud)', qty: 1 }],
    'Agua mineral': [{ inv: 'Agua mineral (ud)', qty: 1 }],
    'Cafe solo': [{ inv: 'Cafe en grano (kg)', qty: 0.01 }, { inv: 'Leche entera (L)', qty: 0.02 }],
    'Copa de sangria': [{ inv: 'Vino tinto Rioja (bot)', qty: 0.15 }, { inv: 'Refrescos (ud)', qty: 0.5 }],
    'Gin tonic premium': [{ inv: 'Refrescos (ud)', qty: 0.5 }],
    'Copa de cava': [{ inv: 'Vino tinto Rioja (bot)', qty: 0.15 }],
  };
  for (const mi of menuItems) {
    const ingredients = menuToInvMap[mi.name] || [];
    for (const ing of ingredients) {
      const invItem = invItems.find(ii => ii.name === ing.inv);
      if (invItem) {
        recipeRows.push({
          menu_item_id: mi.id,
          inventory_item_id: invItem.id,
          qty_base_units: ing.qty,
        });
      }
    }
  }
  await batchUpsert('recipe_ingredients', recipeRows, { onConflict: 'menu_item_id,inventory_item_id' });

  console.log('');

  // ================================================================
  // PHASE 3: Sales + CDM Orders (365 days)
  // ================================================================
  console.log('-- Phase 3: Sales + Orders (365 days) --');

  const dailySalesRows = [];
  const cdmOrderRows = [];
  const cdmOrderLineRows = [];
  const posFinanceRows = [];
  const cashCountRows = [];

  // Pre-compute category items for weighted picking
  const categories = Object.keys(CAT_WEIGHTS);
  const catWeights = categories.map(c => CAT_WEIGHTS[c]);
  const itemsByCategory = {};
  for (const cat of categories) {
    itemsByCategory[cat] = menuItems.filter((_, i) => MENU_ITEMS_DATA[i].cat === cat)
      .map((mi) => {
        const orig = MENU_ITEMS_DATA.find(m => m.name === mi.name);
        // Use cdm_item id for order lines (FK references cdm_items, not menu_items)
        return { id: cdmItemByName[mi.name] || mi.id, name: mi.name, price: orig.price, cost_pct: orig.cost_pct };
      });
  }

  // Target orders per day per location: 25-35 (capped to keep total rows manageable)
  const MIN_ORDERS_PER_DAY = 25;
  const MAX_ORDERS_PER_DAY = 35;

  let totalOrders = 0;
  let totalLines = 0;

  for (const loc of LOC_PROFILES) {
    let d = new Date(START_DATE);
    while (d <= TODAY) {
      const ds = dateStr(d);
      const dow = d.getDay();
      const month = d.getMonth() + 1;
      const daySeed = `sales-${loc.id}-${ds}`;
      const dayRng = new SeededRandom(daySeed);

      const seasonal = getSeasonalMult(month);
      const dowMult = DOW_MULT[dow];
      const noise = dayRng.range(0.92, 1.08);
      const netSales = round2(loc.baseSales * dowMult * seasonal * noise);
      const grossSales = round2(netSales * 1.10);
      // Cap orders to 25-35 per day per location
      const rawOrders = Math.max(1, Math.round(netSales / (loc.avgCheck + dayRng.range(-2, 2))));
      const ordersCount = Math.min(MAX_ORDERS_PER_DAY, Math.max(MIN_ORDERS_PER_DAY, rawOrders));
      const tips = round2(netSales * dayRng.range(0.02, 0.04));
      const discounts = round2(netSales * dayRng.range(0.015, 0.03));
      const paymentsCash = round2(grossSales * dayRng.range(0.25, 0.35));
      const paymentsCard = round2(grossSales - paymentsCash);

      dailySalesRows.push({
        org_id: ORG_ID,
        location_id: loc.id,
        day: ds,
        gross_sales: grossSales,
        net_sales: netSales,
        tax: round2(grossSales - netSales),
        tips,
        discounts,
        comps: round2(netSales * dayRng.range(0.003, 0.008)),
        voids: round2(netSales * dayRng.range(0.002, 0.005)),
        refunds: round2(netSales * dayRng.range(0.001, 0.004)),
        orders_count: ordersCount,
        payments_total: grossSales,
      });

      // Generate individual CDM orders
      // cdm_orders: DO NOT send provider or integration_account_id for demo data
      //   provider is enum: square,lightspeed,oracle_simphony,toast
      let remainingSales = netSales;
      for (let o = 0; o < ordersCount; o++) {
        const orderId = deterministicUUID(`order-${loc.id}-${ds}-${o}`);
        const isLastOrder = o === ordersCount - 1;
        const orderNet = isLastOrder
          ? round2(remainingSales)
          : round2(netSales / ordersCount * dayRng.range(0.8, 1.2));

        // Time: 10:00 to 22:30
        const hour = 10 + Math.floor(dayRng.next() * 12.5);
        const minute = Math.floor(dayRng.next() * 60);
        const openedAt = new Date(d);
        openedAt.setHours(hour, minute, 0, 0);
        const closedAt = new Date(openedAt);
        closedAt.setMinutes(closedAt.getMinutes() + dayRng.intRange(20, 75));

        const orderDiscount = round2(orderNet * dayRng.range(0, 0.03));
        const safeOrderNet = round2(Math.max(orderNet, 5));

        cdmOrderRows.push({
          id: orderId,
          org_id: ORG_ID,
          location_id: loc.id,
          opened_at: openedAt.toISOString(),
          closed_at: closedAt.toISOString(),
          net_sales: safeOrderNet,
          gross_sales: round2(safeOrderNet * 1.10),
          tax: round2(safeOrderNet * 0.10),
          tips: round2(safeOrderNet * dayRng.range(0.02, 0.04)),
          discounts: orderDiscount,
          comps: 0,
          voids: 0,
          refunds: 0,
          payments_total: round2(safeOrderNet * 1.10),
        });
        totalOrders++;

        // Generate order lines (2-4 items)
        // cdm_order_lines: DO NOT send provider or integration_account_id
        const numLines = dayRng.intRange(2, 4);
        let lineSum = 0;
        for (let l = 0; l < numLines; l++) {
          const cat = dayRng.weightedPick(categories, catWeights);
          const catItems = itemsByCategory[cat];
          if (!catItems || catItems.length === 0) continue;
          const item = dayRng.pick(catItems);
          const qty = dayRng.intRange(1, 3);
          const isLastLine = l === numLines - 1;
          const lineGross = isLastLine
            ? round2(Math.max(safeOrderNet - lineSum, item.price))
            : round2(item.price * qty);

          cdmOrderLineRows.push({
            id: deterministicUUID(`oline-${loc.id}-${ds}-${o}-${l}`),
            org_id: ORG_ID,
            order_id: orderId,
            item_id: item.id,
            name: item.name,
            qty: isLastLine ? Math.max(1, Math.round(lineGross / item.price)) : qty,
            gross: lineGross,
            net: round2(lineGross / 1.10),
            discount: 0,
            tax: round2(lineGross - lineGross / 1.10),
          });
          lineSum += lineGross;
          totalLines++;
        }

        remainingSales -= safeOrderNet;
        if (remainingSales <= 0 && !isLastOrder) break;
      }

      // POS daily finance
      // Columns: id, date, location_id, net_sales, gross_sales, orders_count,
      //   payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      //   discounts_amount, comps_amount, voids_amount, data_source, created_at
      // NO org_id column
      const refundsAmount = round2(netSales * dayRng.range(0.001, 0.004));
      const discsAmount = round2(netSales * dayRng.range(0.015, 0.03));
      const compsAmount = round2(netSales * dayRng.range(0.003, 0.008));
      const voidsAmount = round2(netSales * dayRng.range(0.002, 0.005));

      posFinanceRows.push({
        date: ds,
        location_id: loc.id,
        net_sales: netSales,
        gross_sales: grossSales,
        orders_count: ordersCount,
        payments_cash: paymentsCash,
        payments_card: paymentsCard,
        payments_other: 0,
        refunds_amount: refundsAmount,
        refunds_count: dayRng.intRange(0, 2),
        discounts_amount: discsAmount,
        comps_amount: compsAmount,
        voids_amount: voidsAmount,
        data_source: 'demo',
      });

      // Cash counts daily - NO org_id column
      cashCountRows.push({
        date: ds,
        location_id: loc.id,
        cash_counted: round2(paymentsCash + dayRng.range(-5, 5)),
        notes: null,
      });

      d = addDays(d, 1);
    }
  }

  console.log(`  Generated: ${dailySalesRows.length} daily_sales, ${cdmOrderRows.length} cdm_orders, ${cdmOrderLineRows.length} cdm_order_lines`);

  await batchUpsert('daily_sales', dailySalesRows, { onConflict: 'org_id,location_id,day', batchSize: 1000 });
  await batchUpsert('cdm_orders', cdmOrderRows, { batchSize: 2000 });
  await batchUpsert('cdm_order_lines', cdmOrderLineRows, { batchSize: 5000 });
  await batchUpsert('pos_daily_finance', posFinanceRows, { batchSize: 1000 });
  await batchUpsert('cash_counts_daily', cashCountRows, { batchSize: 1000 });

  console.log('');

  // ================================================================
  // PHASE 4: Labour (365 days)
  // ================================================================
  console.log('-- Phase 4: Labour (365 days) --');

  const scheduleRows = [];
  const shiftRows = [];
  const assignmentRows = [];
  const timeEntryRows = [];
  const plannedShiftRows = [];

  for (const locId of ALL_LOCS) {
    const locEmps = empByLoc[locId] || [];
    if (locEmps.length === 0) continue;

    // Generate weekly schedules for the full year
    let weekStart = new Date(START_DATE);
    // Align to Monday
    while (weekStart.getDay() !== 1) weekStart = addDays(weekStart, 1);

    while (weekStart <= TODAY) {
      const schedId = deterministicUUID(`sched-${locId}-${dateStr(weekStart)}`);
      scheduleRows.push({
        id: schedId,
        org_id: ORG_ID,
        location_id: locId,
        week_start: dateStr(weekStart),
        status: 'published',
      });

      for (let dayOff = 0; dayOff < 7; dayOff++) {
        const shiftDate = addDays(weekStart, dayOff);
        if (shiftDate > TODAY) break;
        const ds = dateStr(shiftDate);
        const dayRng = new SeededRandom(`shift-${locId}-${ds}`);

        // Two shifts per day
        for (const [startH, endH, headcount] of [[10, 16, 3], [16, 23, 4]]) {
          const shiftId = deterministicUUID(`shift-${locId}-${ds}-${startH}`);
          const startAt = new Date(shiftDate);
          startAt.setHours(startH, 0, 0, 0);
          const endAt = new Date(shiftDate);
          endAt.setHours(endH, 0, 0, 0);

          shiftRows.push({
            id: shiftId,
            schedule_id: schedId,
            location_id: locId,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            required_headcount: headcount,
          });

          // Assign employees
          const shuffled = dayRng.shuffle(locEmps);
          const assigned = shuffled.slice(0, Math.min(headcount, shuffled.length));

          for (const emp of assigned) {
            assignmentRows.push({
              shift_id: shiftId,
              employee_id: emp.id,
            });

            // Time entry (actual clock)
            const clockIn = new Date(startAt);
            clockIn.setMinutes(clockIn.getMinutes() + dayRng.intRange(-5, 10));
            const clockOut = new Date(endAt);
            clockOut.setMinutes(clockOut.getMinutes() + dayRng.intRange(-10, 15));
            const hours = (clockOut - clockIn) / 3600000;

            timeEntryRows.push({
              id: deterministicUUID(`te-${locId}-${ds}-${startH}-${emp.id}`),
              org_id: ORG_ID,
              location_id: locId,
              employee_id: emp.id,
              clock_in: clockIn.toISOString(),
              clock_out: clockOut.toISOString(),
              source: 'manual',
              approved: true,
            });

            // Planned shift
            plannedShiftRows.push({
              id: deterministicUUID(`ps-${locId}-${ds}-${startH}-${emp.id}`),
              employee_id: emp.id,
              location_id: locId,
              shift_date: ds,
              start_time: `${String(startH).padStart(2, '0')}:00`,
              end_time: `${String(endH).padStart(2, '0')}:00`,
              role: emp.role,
              status: 'published',
              planned_cost: round2(hours * emp.hourly),
            });
          }
        }
      }
      weekStart = addDays(weekStart, 7);
    }
  }

  console.log(`  Generated: ${scheduleRows.length} schedules, ${shiftRows.length} shifts, ${timeEntryRows.length} time_entries, ${plannedShiftRows.length} planned_shifts`);

  await batchUpsert('schedules', scheduleRows, { batchSize: 500 });
  await batchUpsert('shifts', shiftRows, { batchSize: 1000 });
  await batchUpsert('shift_assignments', assignmentRows, { batchSize: 2000, onConflict: 'shift_id,employee_id' });
  await batchUpsert('time_entries', timeEntryRows, { batchSize: 2000 });
  await batchUpsert('planned_shifts', plannedShiftRows, { batchSize: 2000 });

  // Employee availability (weekly pattern)
  // day_of_week: 1-7 (Mon-Sun), NOT 0-6
  const availRows = [];
  for (const locId of ALL_LOCS) {
    const locEmps = empByLoc[locId] || [];
    for (const emp of locEmps) {
      const empRng = new SeededRandom(`avail-${emp.id}`);
      for (let dow = 1; dow <= 7; dow++) {
        // Most employees available 5-6 days, 1-2 days off
        const available = empRng.next() > 0.2; // 80% chance available per day
        if (available) {
          availRows.push({
            employee_id: emp.id,
            location_id: locId,
            day_of_week: dow,
            start_time: '10:00',
            end_time: '23:00',
            is_available: true,
          });
        }
      }
    }
  }
  await batchUpsert('employee_availability', availRows, { batchSize: 500 });

  console.log('');

  // ================================================================
  // PHASE 5: Payroll
  // ================================================================
  console.log('-- Phase 5: Payroll --');

  // Legal entity
  const legalEntityId = deterministicUUID('legal-entity-1');
  await batchUpsert('legal_entities', [{
    id: legalEntityId,
    group_id: ORG_ID,
    razon_social: 'La Taberna Madrid SL',
    nif: 'B12345678',
    domicilio_fiscal: 'Calle Fuencarral 42, 28004 Madrid',
    cnae: '5610',
  }], { onConflict: 'id' });

  // Employment contracts
  const contractRows = employees.map((emp, i) => {
    const ed = EMPLOYEE_DATA[i];
    const baseSalary = round2(ed.hourly * 40 * 4.33); // ~monthly from hourly
    return {
      id: deterministicUUID(`contract-${emp.id}`),
      employee_id: emp.id,
      legal_entity_id: legalEntityId,
      contract_type: 'indefinido',
      base_salary_monthly: baseSalary,
      hourly_rate: ed.hourly,
      irpf_rate: baseSalary > 2500 ? 22 : baseSalary > 2000 ? 18 : 15,
      jornada_pct: 100,
      active: true,
    };
  });
  await batchUpsert('employment_contracts', contractRows, { onConflict: 'id' });

  // Payroll runs (12 months)
  // payroll_runs uses group_id, NOT org_id
  const payrollRuns = [];
  const payslipRows = [];
  const payslipLineRows = [];

  for (let m = 0; m < 12; m++) {
    const monthDate = addDays(START_DATE, m * 30);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;

    const runId = deterministicUUID(`payroll-${year}-${month}`);
    payrollRuns.push({
      id: runId,
      group_id: ORG_ID,
      legal_entity_id: legalEntityId,
      period_year: year,
      period_month: month,
      status: 'closed',
    });

    for (const contract of contractRows) {
      const gross = contract.base_salary_monthly;
      const complementos = round2(gross * 0.07);
      const totalGross = round2(gross + complementos);
      const irpf = round2(totalGross * contract.irpf_rate / 100);
      const ssEmp = round2(totalGross * 0.0635);
      const ssEr = round2(totalGross * 0.30);
      const net = round2(totalGross - irpf - ssEmp);

      const slipId = deterministicUUID(`slip-${runId}-${contract.employee_id}`);
      payslipRows.push({
        id: slipId,
        payroll_run_id: runId,
        employee_id: contract.employee_id,
        gross_pay: totalGross,
        net_pay: net,
        irpf_withheld: irpf,
        employee_ss: ssEmp,
        employer_ss: ssEr,
      });

      payslipLineRows.push(
        { payslip_id: slipId, concept_code: 'SALARIO_BASE', description: 'Salario base', amount: gross, type: 'earning' },
        { payslip_id: slipId, concept_code: 'COMPLEMENTOS', description: 'Complementos salariales', amount: complementos, type: 'earning' },
        { payslip_id: slipId, concept_code: 'IRPF', description: `Retencion IRPF (${contract.irpf_rate}%)`, amount: irpf, type: 'deduction' },
        { payslip_id: slipId, concept_code: 'SS_TRABAJADOR', description: 'Seg. Social trabajador (6.35%)', amount: ssEmp, type: 'deduction' },
        { payslip_id: slipId, concept_code: 'SS_EMPRESA', description: 'Seg. Social empresa (30%)', amount: ssEr, type: 'company_cost' },
      );
    }
  }

  await batchUpsert('payroll_runs', payrollRuns, { onConflict: 'id' });
  await batchUpsert('payslips', payslipRows, { batchSize: 500 });
  await batchUpsert('payslip_lines', payslipLineRows, { batchSize: 2000 });

  console.log('');

  // ================================================================
  // PHASE 6: Inventory + Waste + Purchases + Stock Counts
  // ================================================================
  console.log('-- Phase 6: Inventory + Waste + Purchases --');

  const stockMoveRows = [];
  const wasteEventRows = [];
  const poRows = [];
  const poLineRows = [];

  for (const loc of LOC_PROFILES) {
    let d = new Date(START_DATE);
    while (d <= TODAY) {
      const ds = dateStr(d);
      const dayRng = new SeededRandom(`inv-${loc.id}-${ds}`);

      // Stock movements: sale_estimate (tied to daily sales volume)
      const dailySale = dailySalesRows.find(r => r.location_id === loc.id && r.day === ds);
      const dailyNet = dailySale ? dailySale.net_sales : loc.baseSales;
      const cogsTarget = dailyNet * 0.30; // 30% COGS target

      // Distribute COGS across 4-6 inventory items
      const numItems = dayRng.intRange(4, 6);
      let remainingCogs = cogsTarget;
      for (let i = 0; i < numItems; i++) {
        const item = dayRng.pick(invItems);
        const isLast = i === numItems - 1;
        const itemCogs = isLast ? remainingCogs : round2(cogsTarget / numItems * dayRng.range(0.7, 1.3));
        const qtyDelta = round2(itemCogs / item.price);

        stockMoveRows.push({
          id: deterministicUUID(`sm-sale-${loc.id}-${ds}-${i}`),
          org_id: ORG_ID,
          location_id: loc.id,
          item_id: item.id,
          movement_type: 'sale_estimate',
          qty_delta: -qtyDelta,
          unit_cost: item.price,
          reason: 'Daily consumption estimate',
          created_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 22, 0).toISOString(),
        });
        remainingCogs -= itemCogs;
      }

      // Waste: ~2% of COGS
      if (dayRng.next() > 0.3) { // 70% chance of waste on any day
        const wasteItem = dayRng.pick(invItems);
        const wasteQty = round2(dayRng.range(0.1, 2));
        const wasteValue = round2(wasteQty * wasteItem.price);
        const reasons = ['Expired', 'Damaged', 'Overproduction', 'Prep waste'];

        stockMoveRows.push({
          id: deterministicUUID(`sm-waste-${loc.id}-${ds}`),
          org_id: ORG_ID,
          location_id: loc.id,
          item_id: wasteItem.id,
          movement_type: 'waste',
          qty_delta: -wasteQty,
          unit_cost: wasteItem.price,
          reason: dayRng.pick(reasons),
          created_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0).toISOString(),
        });

        // waste_events: NO org_id column
        wasteEventRows.push({
          id: deterministicUUID(`we-${loc.id}-${ds}`),
          inventory_item_id: wasteItem.id,
          location_id: loc.id,
          quantity: wasteQty,
          waste_value: wasteValue,
          reason: dayRng.pick(reasons),
          created_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0).toISOString(),
        });
      }

      // Weekly purchases (deliveries on supplier days)
      const dow = d.getDay();
      for (const sup of suppliers) {
        if (sup.delivers_days && sup.delivers_days.includes(dow)) {
          const poRng = new SeededRandom(`po-${loc.id}-${ds}-${sup.id}`);
          if (poRng.next() > 0.5) { // 50% chance on delivery days
            const numPoLines = poRng.intRange(3, 5);
            let total = 0;
            const lines = [];
            const usedItems = new Set();

            for (let l = 0; l < numPoLines; l++) {
              let item;
              do { item = poRng.pick(invItems); } while (usedItems.has(item.id));
              usedItems.add(item.id);

              const qty = round2(poRng.range(5, 25));
              const lineVal = round2(qty * item.price);
              total += lineVal;

              lines.push({
                id: deterministicUUID(`pol-${loc.id}-${ds}-${sup.id}-${l}`),
                purchase_order_id: null, // set below
                item_id: item.id,
                qty_packs: qty,
                pack_price: item.price,
                line_value: lineVal,
              });

              // Purchase stock movement
              stockMoveRows.push({
                id: deterministicUUID(`sm-purch-${loc.id}-${ds}-${sup.id}-${l}`),
                org_id: ORG_ID,
                location_id: loc.id,
                item_id: item.id,
                movement_type: 'purchase',
                qty_delta: qty,
                unit_cost: item.price,
                reason: `PO from ${sup.name}`,
                created_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0).toISOString(),
              });
            }

            if (total >= (sup.min_order_value || 0)) {
              const poId = deterministicUUID(`po-${loc.id}-${ds}-${sup.id}`);
              const daysOld = Math.floor((TODAY - d) / 86400000);
              // purchase_orders.status enum: draft, sent, confirmed, delivered, cancelled
              poRows.push({
                id: poId,
                org_id: ORG_ID,
                location_id: loc.id,
                supplier_id: sup.id,
                status: daysOld > 7 ? 'delivered' : daysOld > 2 ? 'sent' : 'draft',
                order_date: ds,
                delivery_date: dateStr(addDays(d, poRng.intRange(1, 3))),
                total_value: round2(total),
              });
              for (const line of lines) {
                line.purchase_order_id = poId;
                poLineRows.push(line);
              }
            }
          }
        }
      }

      d = addDays(d, 1);
    }
  }

  console.log(`  Generated: ${stockMoveRows.length} stock_movements, ${wasteEventRows.length} waste_events, ${poRows.length} POs`);

  await batchUpsert('stock_movements', stockMoveRows, { batchSize: 2000 });
  await batchUpsert('waste_events', wasteEventRows, { batchSize: 1000 });
  await batchUpsert('purchase_orders', poRows, { batchSize: 500 });
  await batchUpsert('purchase_order_lines', poLineRows, { batchSize: 1000 });

  // Stock counts (monthly, 12 per location)
  // stock_counts: uses group_id, NOT org_id
  console.log('  Stock counts...');
  const stockCountRows = [];
  const stockCountLineRows = [];

  for (const locId of ALL_LOCS) {
    for (let m = 0; m < 12; m++) {
      const countDate = addDays(START_DATE, (m + 1) * 30);
      if (countDate > TODAY) break;

      const countId = deterministicUUID(`sc-${locId}-${m}`);
      const countRng = new SeededRandom(`sc-${locId}-${m}`);

      stockCountRows.push({
        id: countId,
        group_id: ORG_ID,
        location_id: locId,
        start_date: dateStr(addDays(countDate, -30)),
        end_date: dateStr(countDate),
        status: m < 11 ? 'completed' : 'draft',
      });

      for (const item of invItems) {
        const opening = round2(countRng.range(10, 60));
        const deliveries = round2(countRng.range(20, 80));
        const sales = round2(countRng.range(15, 70));
        const closing = round2(opening + deliveries - sales + countRng.range(-3, 3));
        const variance = round2(closing - (opening + deliveries - sales));

        stockCountLineRows.push({
          stock_count_id: countId,
          inventory_item_id: item.id,
          opening_qty: opening,
          deliveries_qty: deliveries,
          sales_qty: sales,
          closing_qty: Math.max(0, closing),
          variance_qty: variance,
        });
      }
    }
  }

  await batchUpsert('stock_counts', stockCountRows, { batchSize: 100 });
  await batchUpsert('stock_count_lines', stockCountLineRows, { batchSize: 2000 });

  console.log('');

  // ================================================================
  // PHASE 7: Budgets (12 months)
  // ================================================================
  console.log('-- Phase 7: Budgets (12 months) --');

  const budgetVersionRows = [];
  const budgetDayRows = [];
  const budgetMetricRows = [];
  const budgetDriverRows = [];

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(START_DATE.getFullYear(), START_DATE.getMonth() + m, 1);
    const monthEnd = new Date(START_DATE.getFullYear(), START_DATE.getMonth() + m + 1, 0);
    const versionId = deterministicUUID(`budget-${dateStr(monthStart)}`);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    budgetVersionRows.push({
      id: versionId,
      org_id: ORG_ID,
      name: `Budget ${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
      scope: 'location',
      status: 'published',
      start_date: dateStr(monthStart),
      end_date: dateStr(monthEnd),
      published_at: monthStart.toISOString(),
    });

    for (const loc of LOC_PROFILES) {
      let d = new Date(monthStart);
      while (d <= monthEnd && d <= TODAY) {
        const ds = dateStr(d);
        const dow = d.getDay();
        const month = d.getMonth() + 1;
        const mult = DOW_MULT[dow] * getSeasonalMult(month);
        const budgetSales = round2(loc.baseSales * mult);
        const budgetLabour = round2(budgetSales * 0.28);
        const budgetCogs = round2(budgetSales * 0.30);
        const dayId = deterministicUUID(`bday-${loc.id}-${ds}`);

        budgetDayRows.push({
          id: dayId,
          budget_version_id: versionId,
          org_id: ORG_ID,
          location_id: loc.id,
          day: ds,
          is_holiday: false,
          is_event: false,
        });

        budgetMetricRows.push(
          { budget_day_id: dayId, layer: 'base', metric: 'covers', value: Math.round(budgetSales / 25), source: 'seed' },
          { budget_day_id: dayId, layer: 'base', metric: 'labour_cost', value: budgetLabour, source: 'seed' },
          { budget_day_id: dayId, layer: 'base', metric: 'cogs', value: budgetCogs, source: 'seed' },
        );

        budgetDriverRows.push({
          budget_day_id: dayId,
          target_covers: Math.round(budgetSales / 25),
          target_avg_check: 25,
          target_cogs_pct: 30,
          target_labour_hours: round2(budgetLabour / 14.5),
          target_hourly_rate: 14.5,
        });

        d = addDays(d, 1);
      }
    }
  }

  await batchUpsert('budget_versions', budgetVersionRows, { batchSize: 100 });
  await batchUpsert('budget_days', budgetDayRows, { batchSize: 2000 });
  await batchUpsert('budget_metrics', budgetMetricRows, { batchSize: 5000, onConflict: 'budget_day_id,layer,metric' });
  await batchUpsert('budget_drivers', budgetDriverRows, { batchSize: 2000, onConflict: 'budget_day_id' });

  console.log('');

  // ================================================================
  // PHASE 8: Forecast
  // ================================================================
  console.log('-- Phase 8: Forecast --');

  const forecastRuns = [];
  const forecastPoints = [];

  for (const loc of LOC_PROFILES) {
    const runId = deterministicUUID(`frun-${loc.id}-latest`);
    forecastRuns.push({
      id: runId,
      org_id: ORG_ID,
      location_id: loc.id,
      metric: 'gross_sales',
      train_start: dateStr(START_DATE),
      train_end: dateStr(TODAY),
      horizon_days: 30,
      status: 'completed',
      requested_at: TODAY.toISOString(),
      finished_at: TODAY.toISOString(),
    });

    for (let i = 1; i <= 30; i++) {
      const fd = addDays(TODAY, i);
      const dow = fd.getDay();
      const month = fd.getMonth() + 1;
      const fRng = new SeededRandom(`fc-${loc.id}-${dateStr(fd)}`);
      const mult = DOW_MULT[dow] * getSeasonalMult(month);
      const yhat = round2(loc.baseSales * mult * fRng.range(0.92, 1.08));

      forecastPoints.push({
        forecast_run_id: runId,
        org_id: ORG_ID,
        location_id: loc.id,
        day: dateStr(fd),
        yhat,
        yhat_lower: round2(yhat * 0.85),
        yhat_upper: round2(yhat * 1.15),
      });
    }
  }

  // Forecast daily metrics (historical accuracy)
  // Columns: id, date, location_id, forecast_sales, forecast_orders,
  //          planned_labor_hours, planned_labor_cost, created_at
  // NO mape, NO confidence columns
  const forecastMetricRows = [];
  for (const loc of LOC_PROFILES) {
    let d = addDays(TODAY, -30);
    while (d <= TODAY) {
      const ds = dateStr(d);
      const fmRng = new SeededRandom(`fm-${loc.id}-${ds}`);
      const actual = dailySalesRows.find(r => r.location_id === loc.id && r.day === ds);
      if (actual) {
        const mapeNoise = fmRng.range(0.85, 1.15);
        forecastMetricRows.push({
          date: ds,
          location_id: loc.id,
          forecast_sales: round2(actual.net_sales * mapeNoise),
          forecast_orders: Math.round(actual.orders_count * mapeNoise),
        });
      }
      d = addDays(d, 1);
    }
  }

  await batchUpsert('forecast_runs', forecastRuns, { onConflict: 'id' });
  // forecast_points has no unique constraint — use plain insert
  {
    const { error, count } = await supabase.from('forecast_points').insert(forecastPoints, { count: 'exact' });
    if (error) console.error(`  forecast_points error: ${error.message}`);
    else console.log(`  forecast_points: ${count ?? forecastPoints.length}/${forecastPoints.length} rows`);
  }
  await batchUpsert('forecast_daily_metrics', forecastMetricRows, { batchSize: 500 });

  console.log('');

  // ================================================================
  // PHASE 9: Reviews + Announcements
  // ================================================================
  console.log('-- Phase 9: Reviews + Announcements --');

  const reviewRows = [];
  const platforms = ['Google', 'TripAdvisor', 'TheFork'];
  const platWeights = [50, 30, 20];
  const ratingWeights = [5, 30, 15, 10, 40];
  const ratings = [1, 2, 3, 4, 5];
  const names = [
    'Ana M.', 'Carlos R.', 'Laura P.', 'Miguel S.', 'Elena V.',
    'Pedro G.', 'Maria T.', 'Javier L.', 'Sofia D.', 'Pablo N.',
    'Isabel F.', 'Diego H.', 'Carmen B.', 'Raul J.', 'Lucia A.',
    'Andres K.', 'Paula O.', 'Roberto M.', 'Marta C.', 'Fernando E.',
  ];

  for (const loc of LOC_PROFILES) {
    let d = new Date(START_DATE);
    while (d <= TODAY) {
      const reviewRng = new SeededRandom(`rev-${loc.id}-${dateStr(d)}`);
      if (reviewRng.next() < 0.45) {
        const rating = reviewRng.weightedPick(ratings, ratingWeights);
        const templates = REVIEW_TEMPLATES[rating] || REVIEW_TEMPLATES[3];
        reviewRows.push({
          org_id: ORG_ID,
          location_id: loc.id,
          platform: reviewRng.weightedPick(platforms, platWeights),
          rating,
          review_text: reviewRng.pick(templates),
          reviewer_name: reviewRng.pick(names),
          sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
          review_date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), reviewRng.intRange(10, 22), reviewRng.intRange(0, 59)).toISOString(),
        });
      }
      d = addDays(d, 1);
    }
  }

  console.log(`  Reviews: ${reviewRows.length}`);
  await batchUpsert('reviews', reviewRows, { batchSize: 500 });

  // Announcements
  const announcementRows = [
    { org_id: ORG_ID, title: 'Horario de Navidad', body: 'Recordad que del 24 al 26 de diciembre tenemos horario especial. Consultar turnos publicados.', type: 'info', pinned: true },
    { org_id: ORG_ID, title: 'Nuevo menu de temporada', body: 'A partir del lunes se activa el menu de primavera. Ensayo de platos el viernes a las 15h.', type: 'info', pinned: true },
    { org_id: ORG_ID, title: 'Objetivo mensual alcanzado', body: 'Enhorabuena equipo! Hemos superado el objetivo de ventas de enero en un 5%.', type: 'info', pinned: false },
    { org_id: ORG_ID, title: 'Revision de protocolos de limpieza', body: 'Actualizacion del protocolo de limpieza de cocina. Revisar el documento en la carpeta compartida.', type: 'warning', pinned: false },
    { org_id: ORG_ID, title: 'Cumpleanos de Maria', body: 'Feliz cumpleanos Maria! Celebracion a las 17h en Centro.', type: 'info', pinned: false },
    { org_id: ORG_ID, title: 'Inventario semanal', body: 'Recordad hacer el conteo de stock los lunes antes de las 12h.', type: 'warning', pinned: false },
    { org_id: ORG_ID, title: 'Evento privado - Salamanca', body: 'El sabado 15 hay reserva privada de 20 personas. Se necesita personal extra.', type: 'info', pinned: false },
    { org_id: ORG_ID, title: 'Formacion en alergenos', body: 'Sesion obligatoria de formacion en alergenos el jueves a las 16h.', type: 'warning', pinned: false },
  ];
  await batchUpsert('announcements', announcementRows);

  console.log('');

  // ================================================================
  // PHASE 10: MV Refresh
  // ================================================================
  console.log('── Phase 10: MV Refresh ──');
  try {
    const { data, error } = await supabase.rpc('refresh_all_mvs', { p_triggered_by: 'seed_demo_365' });
    if (error) {
      if (error.message.includes('statement timeout')) {
        console.log('  MV refresh timed out (expected with large dataset).');
        console.log('  Refresh manually via Supabase SQL Editor or scheduled cron.');
      } else {
        console.error('  MV refresh error:', error.message);
      }
    } else {
      console.log('  MV refresh:', JSON.stringify(data));
    }
  } catch (e) {
    console.error('  MV refresh exception:', e.message);
  }

  // ================================================================
  // Summary
  // ================================================================
  console.log('\n==================================================');
  console.log('  SEED COMPLETE');
  console.log('==================================================');
  console.log(`  Locations: ${ALL_LOCS.length}`);
  console.log(`  Employees: ${employees.length}`);
  console.log(`  Menu items: ${menuItems.length}`);
  console.log(`  Inventory items: ${invItems.length}`);
  console.log(`  Daily sales: ${dailySalesRows.length}`);
  console.log(`  CDM orders: ${cdmOrderRows.length}`);
  console.log(`  CDM order lines: ${cdmOrderLineRows.length}`);
  console.log(`  Schedules: ${scheduleRows.length}`);
  console.log(`  Shifts: ${shiftRows.length}`);
  console.log(`  Time entries: ${timeEntryRows.length}`);
  console.log(`  Planned shifts: ${plannedShiftRows.length}`);
  console.log(`  Stock movements: ${stockMoveRows.length}`);
  console.log(`  Waste events: ${wasteEventRows.length}`);
  console.log(`  Purchase orders: ${poRows.length}`);
  console.log(`  Stock counts: ${stockCountRows.length}`);
  console.log(`  Budget versions: ${budgetVersionRows.length}`);
  console.log(`  Budget days: ${budgetDayRows.length}`);
  console.log(`  Forecast runs: ${forecastRuns.length}`);
  console.log(`  Payroll runs: ${payrollRuns.length}`);
  console.log(`  Payslips: ${payslipRows.length}`);
  console.log(`  Reviews: ${reviewRows.length}`);
  console.log(`  Announcements: ${announcementRows.length}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
