import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublicReservationRequest {
  location_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  special_requests?: string;
}

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo más tarde." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: PublicReservationRequest = await req.json();
    const {
      location_id,
      guest_name,
      guest_email,
      guest_phone,
      party_size,
      reservation_date,
      reservation_time,
      special_requests,
    } = body;

    // Validate required fields
    if (!location_id || !guest_name || !guest_email || !party_size || !reservation_date || !reservation_time) {
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    if (!isValidEmail(guest_email)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate guest name
    if (guest_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "El nombre debe tener al menos 2 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch location and validate booking is enabled
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, name, public_name, booking_enabled, booking_min_party, booking_max_party, booking_advance_days, booking_time_slots, booking_closed_days")
      .eq("id", location_id)
      .eq("active", true)
      .single();

    if (locationError || !location) {
      return new Response(
        JSON.stringify({ error: "Ubicación no encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!location.booking_enabled) {
      return new Response(
        JSON.stringify({ error: "Las reservas online no están habilitadas para esta ubicación" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate party size
    const minParty = location.booking_min_party || 1;
    const maxParty = location.booking_max_party || 12;
    if (party_size < minParty || party_size > maxParty) {
      return new Response(
        JSON.stringify({ error: `El número de personas debe estar entre ${minParty} y ${maxParty}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate date is within allowed range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reservationDateObj = new Date(reservation_date);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + (location.booking_advance_days || 30));

    if (reservationDateObj < today) {
      return new Response(
        JSON.stringify({ error: "No se pueden hacer reservas para fechas pasadas" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (reservationDateObj > maxDate) {
      return new Response(
        JSON.stringify({ error: `Solo se pueden hacer reservas con ${location.booking_advance_days || 30} días de antelación` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate day is not closed
    const dayOfWeek = reservationDateObj.getDay();
    const closedDays = location.booking_closed_days || [];
    if (closedDays.includes(dayOfWeek)) {
      return new Response(
        JSON.stringify({ error: "Este día de la semana no está disponible para reservas" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate time slot is available
    const timeSlots = location.booking_time_slots || [];
    if (!timeSlots.includes(reservation_time)) {
      return new Response(
        JSON.stringify({ error: "Este horario no está disponible" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for existing reservations at the same time (optional: add capacity logic)
    const { data: existingReservations } = await supabase
      .from("reservations")
      .select("id")
      .eq("location_id", location_id)
      .eq("reservation_date", reservation_date)
      .eq("reservation_time", reservation_time)
      .in("status", ["pending", "confirmed", "seated"]);

    // Simple capacity check: max 10 reservations per slot
    if (existingReservations && existingReservations.length >= 10) {
      return new Response(
        JSON.stringify({ error: "Este horario ya está completo. Por favor, elige otro." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the reservation
    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        location_id,
        guest_name: guest_name.trim(),
        guest_email: guest_email.toLowerCase().trim(),
        guest_phone: guest_phone?.trim() || null,
        party_size,
        reservation_date,
        reservation_time,
        duration_minutes: 90,
        status: "pending",
        special_requests: special_requests?.trim() || null,
        notes: "Reserva online",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating reservation:", insertError);
      return new Response(
        JSON.stringify({ error: "Error al crear la reserva. Inténtalo de nuevo." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send confirmation email
    try {
      await supabase.functions.invoke("send_reservation_confirmation", {
        body: { reservationId: reservation.id, type: "confirmation" },
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the reservation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation: {
          id: reservation.id,
          guest_name: reservation.guest_name,
          reservation_date: reservation.reservation_date,
          reservation_time: reservation.reservation_time,
          party_size: reservation.party_size,
          location_name: location.public_name || location.name,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in public_reservation:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
