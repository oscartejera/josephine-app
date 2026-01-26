import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReservationEmailRequest {
  reservationId: string;
  type: 'confirmation' | 'reminder' | 'cancellation';
}

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
    const { reservationId, type }: ReservationEmailRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        *,
        locations:location_id (name, city),
        pos_tables:pos_table_id (table_number)
      `)
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      throw new Error(`Reservation not found: ${fetchError?.message}`);
    }

    if (!reservation.guest_email) {
      return new Response(
        JSON.stringify({ success: false, message: 'No email address provided' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const dateStr = new Date(reservation.reservation_date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = reservation.reservation_time.substring(0, 5);
    const locationName = reservation.locations?.name || 'Nuestro restaurante';
    const tableName = reservation.pos_tables?.table_number || 'Por asignar';

    let subject = '';
    let htmlContent = '';

    switch (type) {
      case 'confirmation':
        subject = `✅ Reserva confirmada - ${locationName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Reserva Confirmada!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #374151;">Hola <strong>${reservation.guest_name}</strong>,</p>
              <p style="font-size: 16px; color: #374151;">Tu reserva ha sido confirmada:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <p style="margin: 8px 0;"><strong>📍 Restaurante:</strong> ${locationName}</p>
                <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${dateStr}</p>
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${timeStr}</p>
                <p style="margin: 8px 0;"><strong>👥 Personas:</strong> ${reservation.party_size}</p>
                <p style="margin: 8px 0;"><strong>🪑 Mesa:</strong> ${tableName}</p>
                ${reservation.special_requests ? `<p style="margin: 8px 0;"><strong>📝 Peticiones:</strong> ${reservation.special_requests}</p>` : ''}
              </div>
              <p style="font-size: 14px; color: #6b7280;">Si necesitas modificar o cancelar tu reserva, por favor contáctanos.</p>
              <p style="font-size: 16px; color: #374151;">¡Te esperamos!</p>
            </div>
          </div>
        `;
        break;

      case 'reminder':
        subject = `⏰ Recordatorio: Tu reserva es hoy - ${locationName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Tu reserva es hoy!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #374151;">Hola <strong>${reservation.guest_name}</strong>,</p>
              <p style="font-size: 16px; color: #374151;">Te recordamos que tienes una reserva:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${timeStr}</p>
                <p style="margin: 8px 0;"><strong>👥 Personas:</strong> ${reservation.party_size}</p>
                <p style="margin: 8px 0;"><strong>🪑 Mesa:</strong> ${tableName}</p>
              </div>
              <p style="font-size: 16px; color: #374151;">¡Te esperamos!</p>
            </div>
          </div>
        `;
        break;

      case 'cancellation':
        subject = `❌ Reserva cancelada - ${locationName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Reserva Cancelada</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #374151;">Hola <strong>${reservation.guest_name}</strong>,</p>
              <p style="font-size: 16px; color: #374151;">Tu reserva ha sido cancelada:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; opacity: 0.7;">
                <p style="margin: 8px 0; text-decoration: line-through;"><strong>📅 Fecha:</strong> ${dateStr}</p>
                <p style="margin: 8px 0; text-decoration: line-through;"><strong>⏰ Hora:</strong> ${timeStr}</p>
              </div>
              <p style="font-size: 14px; color: #6b7280;">Si deseas hacer una nueva reserva, estaremos encantados de atenderte.</p>
            </div>
          </div>
        `;
        break;
    }

    const emailResponse = await sendEmail(reservation.guest_email, subject, htmlContent);
    console.log("Email sent successfully:", emailResponse);

    const updateField = type === 'confirmation' ? 'confirmation_sent_at' : 
                        type === 'reminder' ? 'reminder_sent_at' : null;
    
    if (updateField) {
      await supabase
        .from('reservations')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', reservationId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error sending reservation email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
