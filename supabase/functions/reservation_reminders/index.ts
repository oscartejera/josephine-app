import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Josephine <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend API error: ${res.status} - ${errorBody}`);
  }

  return res.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time and 2 hours from now
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 15 * 60 * 1000); // 15 min buffer for missed checks

    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().substring(0, 5);
    const targetTimeStr = twoHoursFromNow.toTimeString().substring(0, 5);

    console.log(`Checking reservations for ${todayStr} between ${currentTimeStr} and ${targetTimeStr}`);

    // Find reservations:
    // - For today
    // - Status is confirmed or pending
    // - Reservation time is within the next 2 hours (but more than 1h45m away to avoid duplicate sends)
    // - No reminder sent yet
    const { data: reservations, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        *,
        locations:location_id (name, address),
        pos_tables:pos_table_id (table_number)
      `)
      .eq('reservation_date', todayStr)
      .in('status', ['confirmed', 'pending'])
      .is('reminder_sent_at', null)
      .gte('reservation_time', currentTimeStr)
      .lte('reservation_time', targetTimeStr);

    if (fetchError) {
      throw new Error(`Failed to fetch reservations: ${fetchError.message}`);
    }

    console.log(`Found ${reservations?.length || 0} reservations needing reminders`);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const reservation of reservations || []) {
      if (!reservation.guest_email) {
        results.push({ id: reservation.id, success: false, error: 'No email' });
        continue;
      }

      try {
        const timeStr = reservation.reservation_time.substring(0, 5);
        const locationName = reservation.locations?.name || 'Nuestro restaurante';
        const tableName = reservation.pos_tables?.table_number || 'Por asignar';

        const subject = `⏰ Recordatorio: Tu reserva es hoy a las ${timeStr} - ${locationName}`;
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Tu reserva es en 2 horas!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #374151;">Hola <strong>${reservation.guest_name}</strong>,</p>
              <p style="font-size: 16px; color: #374151;">Te recordamos que tienes una reserva para hoy:</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 8px 0;"><strong>📍 Restaurante:</strong> ${locationName}</p>
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${timeStr}</p>
                <p style="margin: 8px 0;"><strong>👥 Personas:</strong> ${reservation.party_size}</p>
                <p style="margin: 8px 0;"><strong>🪑 Mesa:</strong> ${tableName}</p>
                ${reservation.special_requests ? `<p style="margin: 8px 0;"><strong>📝 Peticiones:</strong> ${reservation.special_requests}</p>` : ''}
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">Si necesitas cancelar, por favor avísanos lo antes posible.</p>
              <p style="font-size: 16px; color: #374151;">¡Te esperamos!</p>
            </div>
          </div>
        `;

        await sendEmail(reservation.guest_email, subject, htmlContent);

        // Mark reminder as sent
        await supabase
          .from('reservations')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', reservation.id);

        results.push({ id: reservation.id, success: true });
        console.log(`Reminder sent for reservation ${reservation.id} (${reservation.guest_name})`);
      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : 'Unknown error';
        results.push({ id: reservation.id, success: false, error: errorMsg });
        console.error(`Failed to send reminder for ${reservation.id}:`, errorMsg);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        processed: results.length,
        success: successCount,
        failed: failCount,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in reservation reminders:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
