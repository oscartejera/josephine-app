/**
 * Year Data Generator
 * Genera 365 días de datos realistas para todos los módulos
 */

export function generateYearData(locationId: string, orgId: string = 'demo-org') {
  console.log('[Data Generator] Generating 365 days of data...');
  
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

  for (let dayOffset = 364; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const dateStr = date.toISOString().split('T')[0];

    // Realistic patterns
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
    const baseCovers = isWeekend ? 120 : 80;
    
    // Seasonal adjustments
    const summerLow = (month === 6 || month === 7) ? 0.75 : 1.0; // Jul-Aug slow
    const christmasHigh = (month === 11) ? 1.35 : 1.0; // December boost
    const seasonal = summerLow * christmasHigh;
    
    // Growth trend
    const growth = 1 + ((364 - dayOffset) / 365) * 0.18; // 18% annual growth
    
    // Random variation
    const random = 0.85 + Math.random() * 0.3; // ±15%
    
    const dailyCovers = Math.round(baseCovers * seasonal * growth * random);
    const avgTicket = 23 + Math.random() * 8;

    // Generate hourly sales (11:00-23:00)
    let dailySalesGross = 0;
    let dailySalesNet = 0;
    let dailyTickets = 0;

    for (let hour = 11; hour <= 23; hour++) {
      for (let minute of [0, 15, 30, 45]) {
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

        // Channel split
        const dineInPct = 0.62 + Math.random() * 0.08;
        const pickUpPct = 0.05 + Math.random() * 0.05;
        const deliveryPct = 1 - dineInPct - pickUpPct;

        const salesGross = slotSales;
        const salesNet = salesGross * 0.95; // 5% discounts

        data.sales15m.push({
          location_id: locationId,
          ts_bucket: ts.toISOString(),
          sales_gross: Math.round(salesGross * 100) / 100,
          sales_net: Math.round(salesNet * 100) / 100,
          tickets: slotTickets,
          covers: Math.round(slotCovers),
          discounts: Math.round(salesGross * 0.05 * 100) / 100,
          voids: Math.random() > 0.98 ? 15 : 0,
          comps: Math.random() > 0.97 ? 25 : 0,
          refunds: Math.random() > 0.99 ? 30 : 0,
          channel_dine_in: salesGross * dineInPct,
          channel_pickup: salesGross * pickUpPct,
          channel_delivery: salesGross * deliveryPct,
        });

        dailySalesGross += salesGross;
        dailySalesNet += salesNet;
        dailyTickets += slotTickets;
      }
    }

    // Labor daily
    const scheduledHours = isWeekend ? 48 : 38;
    const actualHours = scheduledHours * (0.95 + Math.random() * 0.1);
    
    data.laborDaily.push({
      location_id: locationId,
      day: dateStr,
      scheduled_hours: scheduledHours,
      actual_hours: Math.round(actualHours * 10) / 10,
      labor_cost_est: actualHours * 15, // €15/hour avg
      overtime_hours: Math.max(0, actualHours - scheduledHours),
      headcount: isWeekend ? 8 : 6,
    });

    // Item mix daily (top 10 items)
    menuItems.slice(0, 10).forEach((item, idx) => {
      const itemSales = dailySalesNet * (0.15 - idx * 0.015); // Declining share
      const qty = Math.round(itemSales / item.price);
      
      data.itemMixDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: `item-${idx + 1}`,
        item_name: item.name,
        qty,
        revenue_net: Math.round(itemSales * 100) / 100,
        margin_est: item.margin,
        attach_rate: qty / dailyTickets,
      });
    });

    // Inventory daily (top 5 ingredients)
    ['Salmón', 'Arroz', 'Jamón', 'Patatas', 'Aceite'].forEach((ingredient, idx) => {
      const baseStock = 100 - idx * 15;
      const dailyUse = 8 + Math.random() * 10;
      const delivery = (dayOffset % 3 === 0) ? 50 : 0; // Delivery every 3 days
      
      data.inventoryDaily.push({
        location_id: locationId,
        day: dateStr,
        item_id: `ingredient-${idx + 1}`,
        item_name: ingredient,
        stock_on_hand: baseStock - dailyUse * (dayOffset % 3) + delivery,
        stock_in: delivery,
        stock_out: dailyUse,
        waste_est: dailyUse * 0.03, // 3% waste
        stockout_flag: false,
      });
    });
  }

  console.log('[Data Generator] Generated:', {
    sales15m: data.sales15m.length,
    laborDaily: data.laborDaily.length,
    itemMixDaily: data.itemMixDaily.length,
    inventoryDaily: data.inventoryDaily.length,
  });

  return data;
}

export { generateYearData };
