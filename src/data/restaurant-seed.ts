/**
 * Restaurant Realistic Seed Data
 * Datos ficticios realistas para un restaurante español
 */

export function generateRealisticCDMData(locationId: string, orgId: string = 'demo-org') {
  const today = new Date();
  const data = {
    locations: [],
    items: [],
    orders: [],
    orderLines: [],
    payments: [],
    factsSales15m: [],
    factsItemMixDaily: [],
    factsLaborDaily: [],
    factsInventoryDaily: [],
  };

  // 1) Location
  data.locations.push({
    id: locationId,
    org_id: orgId,
    name: 'La Taberna Centro',
    address: 'Calle Mayor 15, Salamanca',
    timezone: 'Europe/Madrid',
    external_provider: 'demo',
    external_id: `demo-${locationId}`,
    metadata: { city: 'Salamanca', capacity: 80 },
  });

  // 2) Items (30 productos típicos españoles)
  const categories = {
    entrantes: ['Jamón Ibérico', 'Croquetas de Jamón', 'Pimientos de Padrón', 'Tortilla Española', 'Ensalada Mixta', 'Gazpacho'],
    principales: ['Paella Valenciana', 'Chuletón de Buey', 'Bacalao al Pil-Pil', 'Pulpo a la Gallega', 'Cochinillo Asado', 'Lubina a la Sal'],
    bebidas: ['Coca-Cola', 'Agua Mineral', 'Cerveza Estrella Galicia', 'Tinto de Verano'],
    vinos: ['Ribera del Duero (Copa)', 'Albariño (Copa)', 'Rioja Reserva (Botella)'],
    postres: ['Tarta de Queso', 'Crema Catalana', 'Coulant de Chocolate', 'Tiramisú'],
  };

  let itemId = 1;
  const itemsMap: any = {};

  Object.entries(categories).forEach(([category, items]) => {
    items.forEach(name => {
      const id = `item-${itemId++}`;
      const price = category === 'entrantes' ? 8 + Math.random() * 6 :
                    category === 'principales' ? 18 + Math.random() * 15 :
                    category === 'bebidas' ? 2 + Math.random() * 3 :
                    category === 'vinos' ? 4 + Math.random() * 12 :
                    6 + Math.random() * 4;

      data.items.push({
        id,
        org_id: orgId,
        name,
        sku: `SKU-${itemId}`,
        category_name: category,
        price: Math.round(price * 100) / 100,
        is_active: true,
        external_provider: 'demo',
        external_id: `demo-item-${itemId}`,
        metadata: {},
      });

      itemsMap[name] = id;
    });
  });

  // 3) Generate 30 days of realistic data
  for (let day = -30; day <= 0; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Realistic daily patterns
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const baseCovers = isWeekend ? 120 : 80;
    const variation = Math.random() * 20 - 10;
    const dailyCovers = Math.round(baseCovers + variation);

    // facts_labor_daily
    data.factsLaborDaily.push({
      location_id: locationId,
      day: dateStr,
      scheduled_hours: isWeekend ? 45 : 35,
      actual_hours: isWeekend ? 48 : 36,
      labor_cost_est: isWeekend ? 720 : 540,
      overtime_hours: isWeekend ? 3 : 1,
      headcount: isWeekend ? 8 : 6,
    });

    // Generate hourly sales data (11:00-23:00)
    for (let hour = 11; hour <= 23; hour++) {
      for (let min of [0, 15, 30, 45]) {
        const ts = new Date(date);
        ts.setHours(hour, min, 0, 0);

        // Realistic hourly patterns
        let coversThisSlot = 0;
        if (hour >= 13 && hour <= 15) coversThisSlot = dailyCovers * 0.35 / 8; // Lunch
        if (hour >= 20 && hour <= 22) coversThisSlot = dailyCovers * 0.45 / 12; // Dinner
        if (hour === 12 || hour === 19) coversThisSlot = dailyCovers * 0.05 / 4; // Pre-service

        const avgTicket = 25 + Math.random() * 10;
        const sales = coversThisSlot * avgTicket;

        data.factsSales15m.push({
          location_id: locationId,
          ts_bucket: ts.toISOString(),
          sales_gross: Math.round(sales * 100) / 100,
          sales_net: Math.round(sales * 0.95 * 100) / 100, // 5% descuentos
          tickets: Math.round(coversThisSlot / 2.5),
          covers: Math.round(coversThisSlot),
          discounts: Math.round(sales * 0.05 * 100) / 100,
          voids: 0,
          comps: Math.random() > 0.95 ? 20 : 0,
          refunds: 0,
        });
      }
    }

    // facts_item_mix_daily
    ['Paella Valenciana', 'Jamón Ibérico', 'Croquetas de Jamón', 'Cerveza Estrella Galicia', 'Tarta de Queso'].forEach(itemName => {
      const itemId = itemsMap[itemName];
      if (!itemId) return;

      data.factsItemMixDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: itemId,
        qty: Math.round(10 + Math.random() * 20),
        revenue_net: Math.round((200 + Math.random() * 300) * 100) / 100,
        margin_est: 0.35 + Math.random() * 0.2,
        attach_rate: 0.15 + Math.random() * 0.25,
      });
    });

    // facts_inventory_daily
    ['Jamón Ibérico', 'Paella Valenciana', 'Cerveza Estrella Galicia'].forEach(itemName => {
      const itemId = itemsMap[itemName];
      if (!itemId) return;

      data.factsInventoryDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: itemId,
        stock_on_hand: 50 + Math.random() * 100,
        stock_in: day % 3 === 0 ? 50 : 0, // Delivery every 3 days
        stock_out: 10 + Math.random() * 15,
        waste_est: Math.random() * 3,
        stockout_flag: Math.random() > 0.95,
      });
    });
  }

  return data;
}
