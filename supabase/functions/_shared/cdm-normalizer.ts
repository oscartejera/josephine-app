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

export function normalizeSquareItem(
  squareItem: any,
  orgId: string,
  categoryMap?: Map<string, string>,
) {
  const variation = squareItem.item_data?.variations?.[0];

  // Square uses both legacy category_id and newer categories[] array
  const legacyCategoryId = squareItem.item_data?.category_id;
  const categoriesArray = squareItem.item_data?.categories;
  const primaryCategoryId = categoriesArray?.[0]?.id || legacyCategoryId;
  const categoryName = (primaryCategoryId && categoryMap?.get(primaryCategoryId)) || null;

  return {
    org_id: orgId,
    name: squareItem.item_data?.name || 'Unknown',
    sku: variation?.item_variation_data?.sku || null,
    category_name: categoryName,
    price: variation?.item_variation_data?.price_money?.amount
      ? Number(variation.item_variation_data.price_money.amount) / 100
      : 0,
    is_active: !squareItem.is_deleted,
    external_provider: 'square',
    external_id: squareItem.id,
    metadata: {
      variation_id: variation?.id,
      description: squareItem.item_data?.description,
      category_id: primaryCategoryId,
    },
  };
}

export function normalizeSquareOrder(squareOrder: any, orgId: string, locationMap: Map<string, string>) {
  const locationId = locationMap.get(squareOrder.location_id) || null;

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
      status: squareOrder.state === 'COMPLETED' ? 'closed' : squareOrder.state === 'CANCELED' ? 'void' : 'open',
      source: squareOrder.source?.name || 'square',
      external_provider: 'square',
      external_id: squareOrder.id,
      metadata: {
        state: squareOrder.state,
        version: squareOrder.version,
      },
    },
    lines: (squareOrder.line_items || []).map((line: any) => ({
      name: line.name,
      quantity: Number(line.quantity),
      unit_price: line.base_price_money?.amount ? Number(line.base_price_money.amount) / 100 : 0,
      gross_line_total: line.gross_sales_money?.amount ? Number(line.gross_sales_money.amount) / 100 : 0,
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
