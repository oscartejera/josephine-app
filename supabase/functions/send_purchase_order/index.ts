import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

interface PurchaseOrderLine {
  id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

interface Supplier {
  id: string;
  name: string;
  integration_type: 'api' | 'edi' | 'email' | 'manual';
  api_endpoint?: string;
  api_format?: 'json' | 'xml' | 'edifact';
  order_email?: string;
  order_whatsapp?: string;
  customer_id?: string;
}

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  location_id: string;
  total_amount: number;
  expected_delivery_date: string;
  notes?: string;
  lines: PurchaseOrderLine[];
  supplier: Supplier;
}

/**
 * Format order for JSON API (Makro, Sysco, etc.)
 */
function formatOrderAsJson(order: PurchaseOrder): string {
  return JSON.stringify({
    customer_id: order.supplier.customer_id || 'PENDING',
    order_reference: order.id,
    delivery_date: order.expected_delivery_date,
    delivery_location: order.location_id,
    notes: order.notes || '',
    items: order.lines.map(line => ({
      sku: line.sku,
      product_name: line.product_name,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
    })),
    total_amount: order.total_amount,
    created_at: new Date().toISOString(),
  });
}

/**
 * Format order for EDIFACT (Transgourmet, etc.)
 */
function formatOrderAsEdifact(order: PurchaseOrder): string {
  const lines: string[] = [];
  const orderNum = order.id.substring(0, 14);
  const date = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 12);
  
  lines.push(`UNH+1+ORDERS:D:96A:UN'`);
  lines.push(`BGM+220+${orderNum}+9'`);
  lines.push(`DTM+137:${date}:102'`);
  lines.push(`NAD+BY+${order.supplier.customer_id || 'PENDING'}::91'`);
  
  order.lines.forEach((line, idx) => {
    lines.push(`LIN+${idx + 1}++${line.sku}:EN'`);
    lines.push(`QTY+21:${line.quantity}:${line.unit}'`);
    lines.push(`PRI+AAA:${line.unit_price}:CA'`);
  });
  
  lines.push(`UNS+S'`);
  lines.push(`MOA+86:${order.total_amount}'`);
  lines.push(`UNT+${lines.length + 1}+1'`);
  
  return lines.join('\n');
}

/**
 * Format order for XML
 */
function formatOrderAsXml(order: PurchaseOrder): string {
  const itemsXml = order.lines.map(line => `
    <Item>
      <SKU>${line.sku}</SKU>
      <ProductName>${line.product_name}</ProductName>
      <Quantity>${line.quantity}</Quantity>
      <Unit>${line.unit}</Unit>
      <UnitPrice>${line.unit_price}</UnitPrice>
    </Item>
  `).join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder>
  <OrderId>${order.id}</OrderId>
  <CustomerId>${order.supplier.customer_id || 'PENDING'}</CustomerId>
  <DeliveryDate>${order.expected_delivery_date}</DeliveryDate>
  <Notes>${order.notes || ''}</Notes>
  <Items>${itemsXml}</Items>
  <TotalAmount>${order.total_amount}</TotalAmount>
  <CreatedAt>${new Date().toISOString()}</CreatedAt>
</PurchaseOrder>`;
}

/**
 * Format order for email body (HTML)
 */
function formatOrderForEmail(order: PurchaseOrder): string {
  const itemsHtml = order.lines.map(line => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${line.product_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${line.sku}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${line.quantity} ${line.unit}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">€${line.unit_price.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">€${(line.quantity * line.unit_price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido ${order.id}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Nuevo Pedido</h1>
  
  <p><strong>Referencia:</strong> ${order.id}</p>
  <p><strong>Fecha de entrega solicitada:</strong> ${new Date(order.expected_delivery_date).toLocaleDateString('es-ES')}</p>
  ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
  
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 10px; text-align: left;">Producto</th>
        <th style="padding: 10px; text-align: left;">SKU</th>
        <th style="padding: 10px; text-align: center;">Cantidad</th>
        <th style="padding: 10px; text-align: right;">Precio Unit.</th>
        <th style="padding: 10px; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; background-color: #f9f9f9;">
        <td colspan="4" style="padding: 10px; text-align: right;">TOTAL:</td>
        <td style="padding: 10px; text-align: right;">€${order.total_amount.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  
  <p style="color: #666; font-size: 12px;">
    Este pedido ha sido generado automáticamente desde Josephine.
  </p>
</body>
</html>
  `;
}

/**
 * Send order via API
 */
async function sendViaApi(
  order: PurchaseOrder
): Promise<{ success: boolean; externalOrderId?: string; error?: string }> {
  const supplier = order.supplier;
  
  if (!supplier.api_endpoint) {
    return { success: false, error: 'No API endpoint configured' };
  }
  
  // Get API key from environment (should be set per-supplier in secrets)
  const apiKey = Deno.env.get(`SUPPLIER_API_KEY_${supplier.id.replace(/-/g, '_').toUpperCase()}`) || '';
  
  // Format based on supplier's API format
  let body: string;
  let contentType: string;
  
  switch (supplier.api_format) {
    case 'xml':
      body = formatOrderAsXml(order);
      contentType = 'application/xml';
      break;
    case 'edifact':
      body = formatOrderAsEdifact(order);
      contentType = 'application/edifact';
      break;
    default:
      body = formatOrderAsJson(order);
      contentType = 'application/json';
  }
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const response = await fetch(supplier.api_endpoint, {
      method: 'POST',
      headers,
      body,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json().catch(() => ({}));
    return { 
      success: true, 
      externalOrderId: result.order_id || result.orderId || result.reference 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown API error' 
    };
  }
}

/**
 * Send order via email (using Resend or similar)
 */
async function sendViaEmail(
  order: PurchaseOrder
): Promise<{ success: boolean; error?: string }> {
  const supplier = order.supplier;
  
  if (!supplier.order_email) {
    return { success: false, error: 'No order email configured' };
  }
  
  // For now, we'll log the email that would be sent
  // In production, integrate with Resend, SendGrid, etc.
  console.log(`[EMAIL] Would send order ${order.id} to ${supplier.order_email}`);
  console.log(`[EMAIL] Subject: Nuevo Pedido - ${order.id}`);
  console.log(`[EMAIL] Body:`, formatOrderForEmail(order));
  
  // TODO: Integrate with email provider
  // const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  // if (RESEND_API_KEY) {
  //   const res = await fetch('https://api.resend.com/emails', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${RESEND_API_KEY}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       from: 'pedidos@josephine.app',
  //       to: supplier.order_email,
  //       subject: `Nuevo Pedido - ${order.id}`,
  //       html: formatOrderForEmail(order),
  //     }),
  //   });
  // }
  
  return { success: true };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { purchaseOrderId } = await req.json();

    if (!purchaseOrderId) {
      return new Response(
        JSON.stringify({ error: 'purchaseOrderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order with supplier and lines
    const { data: order, error: orderError } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        lines:purchase_order_lines(*)
      `)
      .eq('id', purchaseOrderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedOrder = order as unknown as PurchaseOrder;
    const supplier = typedOrder.supplier;

    let result: { 
      success: boolean; 
      method: string; 
      externalOrderId?: string; 
      error?: string 
    };

    // Dispatch based on integration type
    switch (supplier.integration_type) {
      case 'api': {
        const apiResult = await sendViaApi(typedOrder);
        result = { 
          ...apiResult, 
          method: 'api',
        };
        break;
      }
      
      case 'edi': {
        // EDI typically requires a specific gateway
        // For now, format and log
        console.log(`[EDI] Order for ${supplier.name}:`, formatOrderAsEdifact(typedOrder));
        result = { 
          success: true, 
          method: 'edi',
          externalOrderId: `EDI-${Date.now()}` 
        };
        break;
      }
      
      case 'email': {
        const emailResult = await sendViaEmail(typedOrder);
        result = { 
          ...emailResult, 
          method: 'email' 
        };
        break;
      }
      
      case 'manual':
      default: {
        result = { 
          success: true, 
          method: 'manual' 
        };
        break;
      }
    }

    // Update order with send status
    await supabaseAdmin
      .from('purchase_orders')
      .update({
        sent_at: result.success ? new Date().toISOString() : null,
        sent_method: result.method,
        external_order_id: result.externalOrderId || null,
        response_status: result.success ? 'sent' : 'failed',
        response_message: result.error || null,
      })
      .eq('id', purchaseOrderId);

    return new Response(
      JSON.stringify({
        success: result.success,
        method: result.method,
        externalOrderId: result.externalOrderId,
        error: result.error,
        supplierName: supplier.name,
      }),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[send_purchase_order] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
