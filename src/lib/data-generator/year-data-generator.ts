/**
 * Year Data Generator v2 — Time Series Enhanced
 *
 * Generates realistic restaurant time series data with:
 * - AR(1) autocorrelation (today's sales depend on yesterday)
 * - Trend changepoints (not just linear growth)
 * - Spanish holiday effects (learned from real calendar)
 * - Weather-correlated patterns (deterministic PRNG)
 * - Weekly + monthly seasonality
 * - Deterministic seeded RNG for reproducibility
 */

// Deterministic PRNG (Mulberry32) — same as regressors.ts
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Box-Muller normal distribution from uniform PRNG
function normalRandom(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(0.0001, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

// Spanish holidays (matching regressors.ts)
const SPANISH_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21',
  '2025-05-01', '2025-05-02', '2025-08-15', '2025-10-12',
  '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25',
  '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06',
  '2026-05-01', '2026-08-15', '2026-10-12', '2026-11-01',
  '2026-12-06', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-01-06', '2027-03-26', '2027-03-29',
  '2027-05-01', '2027-08-15', '2027-10-12', '2027-11-01',
  '2027-12-06', '2027-12-08', '2027-12-25',
]);

// Madrid monthly climate normals (AEMET data)
const MADRID_CLIMATE: Record<number, { avgTemp: number; tempStd: number; rainProb: number }> = {
  0:  { avgTemp: 6.3,  tempStd: 3.0, rainProb: 0.27 },
  1:  { avgTemp: 7.9,  tempStd: 3.2, rainProb: 0.25 },
  2:  { avgTemp: 11.2, tempStd: 3.5, rainProb: 0.23 },
  3:  { avgTemp: 13.1, tempStd: 3.0, rainProb: 0.30 },
  4:  { avgTemp: 17.2, tempStd: 3.5, rainProb: 0.28 },
  5:  { avgTemp: 22.5, tempStd: 3.0, rainProb: 0.12 },
  6:  { avgTemp: 26.1, tempStd: 2.5, rainProb: 0.07 },
  7:  { avgTemp: 25.6, tempStd: 2.5, rainProb: 0.08 },
  8:  { avgTemp: 21.3, tempStd: 3.0, rainProb: 0.18 },
  9:  { avgTemp: 15.1, tempStd: 3.5, rainProb: 0.28 },
  10: { avgTemp: 9.9,  tempStd: 3.0, rainProb: 0.30 },
  11: { avgTemp: 6.9,  tempStd: 3.0, rainProb: 0.30 },
};

// Day-of-week multipliers (typical Madrid casual dining)
const DOW_MULTIPLIERS: Record<number, number> = {
  0: 1.10, // Sunday: family lunch
  1: 0.75, // Monday: slowest
  2: 0.82, // Tuesday
  3: 0.88, // Wednesday
  4: 0.95, // Thursday
  5: 1.30, // Friday: after-work
  6: 1.40, // Saturday: peak
};

// Monthly seasonality (Madrid restaurant industry)
const MONTH_SEASONALITY: Record<number, number> = {
  0:  0.85, // January: post-holiday slump
  1:  0.90, // February
  2:  0.95, // March: spring picks up
  3:  1.00, // April: Semana Santa
  4:  1.05, // May: San Isidro, terrazas
  5:  1.10, // June: terrazas peak
  6:  0.75, // July: locals on vacation
  7:  0.70, // August: city empties
  8:  1.05, // September: vuelta
  9:  1.05, // October: otoño gastronómico
  10: 1.00, // November
  11: 1.30, // December: Christmas season
};

export function generateYearData(locationId: string, orgId: string = 'demo-org', daysToGenerate: number = 90) {
  console.log(`[Data Generator v2] Generating ${daysToGenerate} days with TS patterns...`);

  const rng = mulberry32(hashSeed(locationId + orgId));
  const today = new Date();
  const data: any = {
    sales15m: [],
    laborDaily: [],
    inventoryDaily: [],
    itemMixDaily: [],
    orders: [],
    orderLines: [],
    payments: [],
  };

  // Spanish menu items
  const menuItems = [
    { name: 'Paella Valenciana', price: 18.50, category: 'Principales', margin: 0.42 },
    { name: 'Jamón Ibérico', price: 16.00, category: 'Entrantes', margin: 0.55 },
    { name: 'Croquetas de Jamón', price: 9.50, category: 'Entrantes', margin: 0.48 },
    { name: 'Chuletón de Buey', price: 32.00, category: 'Principales', margin: 0.38 },
    { name: 'Pulpo a la Gallega', price: 22.00, category: 'Principales', margin: 0.45 },
    { name: 'Gazpacho', price: 7.50, category: 'Entrantes', margin: 0.62 },
    { name: 'Tortilla Española', price: 8.00, category: 'Entrantes', margin: 0.58 },
    { name: 'Bacalao al Pil-Pil', price: 24.00, category: 'Principales', margin: 0.40 },
    { name: 'Ensalada Mixta', price: 8.50, category: 'Entrantes', margin: 0.65 },
    { name: 'Cerveza Estrella', price: 3.00, category: 'Bebidas', margin: 0.70 },
    { name: 'Vino Tinto (Copa)', price: 4.50, category: 'Bebidas', margin: 0.68 },
    { name: 'Agua Mineral', price: 2.00, category: 'Bebidas', margin: 0.75 },
    { name: 'Coca-Cola', price: 2.50, category: 'Bebidas', margin: 0.72 },
    { name: 'Tarta de Queso', price: 6.50, category: 'Postres', margin: 0.52 },
    { name: 'Crema Catalana', price: 6.00, category: 'Postres', margin: 0.55 },
  ];

  // ── Trend Changepoints ─────────────────────────────────────────
  // Instead of linear growth, simulate realistic business phases:
  // Phase 1 (first 30%): rapid ramp-up after opening
  // Phase 2 (30%-70%): steady growth
  // Phase 3 (70%-100%): mature, slight growth
  const changepointPct1 = 0.30;
  const changepointPct2 = 0.70;
  const rampUpRate = 0.30;     // 30% growth during ramp-up
  const steadyRate = 0.12;     // 12% growth during steady phase
  const matureRate = 0.05;     // 5% growth when mature

  function trendMultiplier(dayIdx: number): number {
    const pct = dayIdx / daysToGenerate;
    if (pct < changepointPct1) {
      return 1 + rampUpRate * (pct / changepointPct1);
    } else if (pct < changepointPct2) {
      const baseAtCP1 = 1 + rampUpRate;
      return baseAtCP1 + steadyRate * ((pct - changepointPct1) / (changepointPct2 - changepointPct1));
    } else {
      const baseAtCP2 = 1 + rampUpRate + steadyRate;
      return baseAtCP2 + matureRate * ((pct - changepointPct2) / (1 - changepointPct2));
    }
  }

  // ── AR(1) Autocorrelation State ────────────────────────────────
  // Sales today are correlated with yesterday (phi = 0.35)
  const AR1_PHI = 0.35;
  let prevDaySalesResidual = 0; // AR(1) residual from previous day

  // Base daily sales level (€)
  const BASE_DAILY_SALES = 4500 + rng() * 1500; // €4500-6000

  for (let dayOffset = daysToGenerate - 1; dayOffset >= 0; dayOffset--) {
    const dayIdx = daysToGenerate - 1 - dayOffset;
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const dateStr = date.toISOString().split('T')[0];

    // ── Deterministic weather for this day ──────────────────────
    const dayRng = mulberry32(hashSeed(dateStr + locationId));
    const climate = MADRID_CLIMATE[month] || { avgTemp: 15, tempStd: 3, rainProb: 0.2 };
    const temperature = normalRandom(dayRng, climate.avgTemp, climate.tempStd);
    const isRaining = dayRng() < climate.rainProb;

    // Weather impact on sales
    let weatherMultiplier = 1.0;
    if (isRaining) weatherMultiplier *= 0.82;
    if (temperature < 10) weatherMultiplier *= 0.90;
    else if (temperature > 30) weatherMultiplier *= 0.92;
    else if (temperature >= 18 && temperature <= 25) weatherMultiplier *= 1.05; // ideal terrace weather

    // ── Holiday impact ──────────────────────────────────────────
    const isHoliday = SPANISH_HOLIDAYS.has(dateStr);
    const holidayMultiplier = isHoliday ? 0.80 : 1.0;

    // ── Payday effect ───────────────────────────────────────────
    const dayOfMonth = date.getDate();
    const isPayday = dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth >= 25;
    const paydayMultiplier = isPayday ? 1.05 : 1.0;

    // ── Compose deterministic sales level ───────────────────────
    const trendFactor = trendMultiplier(dayIdx);
    const dowFactor = DOW_MULTIPLIERS[dayOfWeek] || 1.0;
    const monthFactor = MONTH_SEASONALITY[month] || 1.0;

    const deterministicSales = BASE_DAILY_SALES
      * trendFactor
      * dowFactor
      * monthFactor
      * weatherMultiplier
      * holidayMultiplier
      * paydayMultiplier;

    // ── AR(1) noise: current residual depends on previous day ───
    const whiteNoise = normalRandom(rng, 0, deterministicSales * 0.08); // 8% std
    const ar1Residual = AR1_PHI * prevDaySalesResidual + whiteNoise;
    prevDaySalesResidual = ar1Residual;

    const dailySalesTarget = Math.max(500, deterministicSales + ar1Residual);
    const avgTicket = normalRandom(dayRng, 25, 3); // €22-28 range
    const dailyCovers = Math.round(dailySalesTarget / Math.max(15, avgTicket));

    // Generate hourly sales (11:00-23:00)
    let dailySalesGross = 0;
    let dailySalesNet = 0;
    let dailyTickets = 0;

    for (let hour = 11; hour <= 23; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        const ts = new Date(date);
        ts.setHours(hour, minute, 0, 0);

        // Hourly distribution
        let coversPct = 0.01;
        if (hour >= 13 && hour <= 14) coversPct = 0.15; // Lunch peak
        if (hour >= 20 && hour <= 22) coversPct = 0.17; // Dinner peak
        if (hour === 12 || hour === 19) coversPct = 0.04; // Pre-service

        const slotCovers = dailyCovers * coversPct;
        const slotTickets = Math.round(slotCovers / 2.5);
        const slotSales = slotCovers * avgTicket;

        // Channel split (deterministic)
        const dineInPct = 0.62 + dayRng() * 0.08;
        const pickUpPct = 0.05 + dayRng() * 0.05;
        const deliveryPct = 1 - dineInPct - pickUpPct;

        const salesGross = slotSales;
        const salesNet = salesGross * 0.95;

        data.sales15m.push({
          location_id: locationId,
          ts_bucket: ts.toISOString(),
          sales_gross: Math.round(salesGross * 100) / 100,
          sales_net: Math.round(salesNet * 100) / 100,
          tickets: slotTickets,
          covers: Math.round(slotCovers),
          discounts: Math.round(salesGross * 0.05 * 100) / 100,
          voids: dayRng() > 0.98 ? 15 : 0,
          comps: dayRng() > 0.97 ? 25 : 0,
          refunds: dayRng() > 0.99 ? 30 : 0,
          channel_dine_in: salesGross * dineInPct,
          channel_pickup: salesGross * pickUpPct,
          channel_delivery: salesGross * deliveryPct,
        });

        dailySalesGross += salesGross;
        dailySalesNet += salesNet;
        dailyTickets += slotTickets;
      }
    }

    // Labor daily (derived from sales to maintain COL% target)
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
    const targetColPct = 0.28;
    const avgHourlyCost = 14.5;
    const targetLaborCost = dailySalesNet * targetColPct;
    const targetHours = targetLaborCost / avgHourlyCost;
    const scheduledHours = isWeekend ? Math.max(40, targetHours * 1.05) : Math.max(32, targetHours * 1.02);
    const actualHours = scheduledHours * normalRandom(dayRng, 1.0, 0.03);

    data.laborDaily.push({
      location_id: locationId,
      day: dateStr,
      scheduled_hours: Math.round(scheduledHours * 10) / 10,
      actual_hours: Math.round(actualHours * 10) / 10,
      labor_cost_est: Math.round(actualHours * avgHourlyCost * 100) / 100,
      overtime_hours: Math.round(Math.max(0, actualHours - scheduledHours) * 10) / 10,
      headcount: isWeekend ? 8 : 6,
    });

    // Item mix daily (top 10 items)
    menuItems.slice(0, 10).forEach((item, idx) => {
      const itemSales = dailySalesNet * (0.15 - idx * 0.015);
      const qty = Math.round(itemSales / item.price);

      data.itemMixDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: `item-${idx + 1}`,
        item_name: item.name,
        qty,
        revenue_net: Math.round(itemSales * 100) / 100,
        margin_est: item.margin,
        attach_rate: dailyTickets > 0 ? qty / dailyTickets : 0,
      });
    });

    // Inventory daily (top 5 ingredients)
    ['Salmón', 'Arroz', 'Jamón', 'Patatas', 'Aceite'].forEach((ingredient, idx) => {
      const baseStock = 100 - idx * 15;
      const dailyUse = 8 + dayRng() * 10;
      const delivery = (dayOffset % 3 === 0) ? 50 : 0;

      data.inventoryDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: `ingredient-${idx + 1}`,
        item_name: ingredient,
        stock_on_hand: baseStock - dailyUse * (dayOffset % 3) + delivery,
        stock_in: delivery,
        stock_out: dailyUse,
        waste_est: dailyUse * 0.03,
        stockout_flag: false,
      });
    });
  }

  console.log('[Data Generator v2] Generated:', {
    sales15m: data.sales15m.length,
    laborDaily: data.laborDaily.length,
    itemMixDaily: data.itemMixDaily.length,
    inventoryDaily: data.inventoryDaily.length,
  });

  return data;
}
