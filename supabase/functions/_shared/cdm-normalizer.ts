/**
 * CDM Normalizer
 * Converts Square data to Canonical Data Model
 */

export function normalizeSquareLocation(squareLoc: any, orgId: string) {
  return {
    org_id: orgId,
    name: squareLoc.name,
    address: squareLoc.address?.address_line_1 || null,
    timezone: squareLoc.timezone || 'UTC',
    external_provider: 'square',
    external_id: squareLoc.id,
    metadata: {
      currency: squareLoc.currency,
      country: squareLoc.country,
      business_name: squareLoc.business_name,
    },
  };
}

export function normalizeSquareItem(squareItem: any, orgId: string) {
  const variation = squareItem.item_data?.variations?.[0];
  
  return {
    org_id: orgId,
    name: squareItem.item_data?.name || 'Unknown',
    sku: variation?.item_variation_data?.sku || null,
    // Square provides category_id (UUID), not a human-readable name.
    // Store null so the sync step can assign a proper category from the products table.
    category_name: null,
    price: variation?.item_variation_data?.price_money?.amount 
      ? Number(variation.item_variation_data.price_money.amount) / 100 
      : 0,
    is_active: !squareItem.is_deleted,
    external_provider: 'square',
    external_id: squareItem.id,
    metadata: {
      variation_id: variation?.id,
      description: squareItem.item_data?.description,
    },
  };
}

export function normalizeSquareOrder(squareOrder: any, orgId: string, locationMap: Map<string, string>) {
  const locationId = locationMap.get(squareOrder.location_id) || null;

  // Extract discount total from Square order
  const discountTotal = squareOrder.total_discount_money?.amount
    ? Number(squareOrder.total_discount_money.amount) / 100
    : 0;

  // Extract refund total from Square refunds array
  let refundTotal = 0;
  if (squareOrder.refunds && Array.isArray(squareOrder.refunds)) {
    for (const refund of squareOrder.refunds) {
      if (refund.amount_money?.amount) {
        refundTotal += Number(refund.amount_money.amount) / 100;
      }
    }
  }

  // Extract payment method breakdown from tenders
  const tenderBreakdown = { cash: 0, card: 0, other: 0 };
  if (squareOrder.tenders && Array.isArray(squareOrder.tenders)) {
    for (const tender of squareOrder.tenders) {
      const amt = tender.amount_money?.amount ? Number(tender.amount_money.amount) / 100 : 0;
      if (tender.type === 'CASH') {
        tenderBreakdown.cash += amt;
      } else if (tender.type === 'CARD' || tender.type === 'SQUARE_GIFT_CARD') {
        tenderBreakdown.card += amt;
      } else {
        tenderBreakdown.other += amt;
      }
    }
  }

  return {
    order: {
      org_id: orgId,
      location_id: locationId,
      opened_at: squareOrder.created_at,
      closed_at: squareOrder.closed_at || null,
      gross_total: squareOrder.total_money?.amount ? Number(squareOrder.total_money.amount) / 100 : 0,
      net_total: squareOrder.net_amounts?.total_money?.amount ? Number(squareOrder.net_amounts.total_money.amount) / 100 : 0,
      tax_total: squareOrder.total_tax_money?.amount ? Number(squareOrder.total_tax_money.amount) / 100 : 0,
      tip_total: squareOrder.total_tip_money?.amount ? Number(squareOrder.total_tip_money.amount) / 100 : 0,
      discount_total: discountTotal,
      refund_total: refundTotal,
      status: squareOrder.state === 'COMPLETED' ? 'closed'
            : squareOrder.state === 'CANCELED' ? 'void'
            : squareOrder.state === 'DRAFT' ? 'draft'
            : 'open',
      source: squareOrder.source?.name || 'square',
      external_provider: 'square',
      external_id: squareOrder.id,
      metadata: {
        state: squareOrder.state,
        version: squareOrder.version,
        customer_id: squareOrder.customer_id || null,
        fulfillments: squareOrder.fulfillments || [],
        rounding_adjustment: squareOrder.rounding_adjustment_money?.amount
          ? Number(squareOrder.rounding_adjustment_money.amount) / 100
          : 0,
      },
    },
    tenderBreakdown,
    lines: (squareOrder.line_items || []).map((line: any) => ({
      name: line.name,
      quantity: Number(line.quantity),
      unit_price: line.base_price_money?.amount ? Number(line.base_price_money.amount) / 100 : 0,
      gross_line_total: line.gross_sales_money?.amount ? Number(line.gross_sales_money.amount) / 100 : 0,
      discount_total: line.total_discount_money?.amount ? Number(line.total_discount_money.amount) / 100 : 0,
      tax_total: line.total_tax_money?.amount ? Number(line.total_tax_money.amount) / 100 : 0,
      modifiers: line.modifiers || [],
      notes: line.note || null,
      external_id: line.uid,
    })),
  };
}

export function normalizeSquarePayment(squarePayment: any, orgId: string, locationMap?: Map<string, string>) {
  const locationId = locationMap?.get(squarePayment.location_id) || null;

  return {
    org_id: orgId,
    location_id: locationId,
    order_external_id: squarePayment.order_id || null,
    amount: squarePayment.amount_money?.amount ? Number(squarePayment.amount_money.amount) / 100 : 0,
    method: squarePayment.card_details ? 'card' : squarePayment.cash_details ? 'cash' : 'other',
    status: squarePayment.status === 'COMPLETED' ? 'completed' :
            squarePayment.status === 'FAILED' ? 'failed' : 'pending',
    paid_at: squarePayment.created_at,
    external_provider: 'square',
    external_id: squarePayment.id,
    metadata: {
      status: squarePayment.status,
      card_brand: squarePayment.card_details?.card?.card_brand,
    },
  };
}
