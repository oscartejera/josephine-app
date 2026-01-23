import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
  fullName?: string;
}

interface VerifyOTPRequest {
  email: string;
  code: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(to: string, code: string, fullName?: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const name = fullName || "Usuario";
  
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Josephine <onboarding@resend.dev>",
      to: [to],
      subject: "Tu código de verificación - Josephine",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Josephine</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
                Hola ${name},
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
                Tu código de verificación es:
              </p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                Este código expira en 10 minutos.
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Si no solicitaste este código, puedes ignorar este email.
              </p>
            </div>
            <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Josephine. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend API error: ${res.status} - ${errorBody}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "send";

    if (action === "send") {
      const { email, fullName }: SendOTPRequest = await req.json();

      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Delete any existing OTPs for this email
      await supabase
        .from("email_otp_codes")
        .delete()
        .eq("email", email.toLowerCase());

      // Generate new OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      const { error: insertError } = await supabase
        .from("email_otp_codes")
        .insert({
          email: email.toLowerCase(),
          code,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error storing OTP:", insertError);
        throw new Error("Failed to generate verification code");
      }

      // Send email
      await sendEmail(email, code, fullName);

      console.log(`OTP sent to ${email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Verification code sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (action === "verify") {
      const { email, code }: VerifyOTPRequest = await req.json();

      if (!email || !code) {
        return new Response(
          JSON.stringify({ error: "Email and code are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find the OTP
      const { data: otpRecord, error: selectError } = await supabase
        .from("email_otp_codes")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("code", code)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (selectError || !otpRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired code", valid: false }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark as verified
      await supabase
        .from("email_otp_codes")
        .update({ verified: true })
        .eq("id", otpRecord.id);

      console.log(`OTP verified for ${email}`);

      return new Response(
        JSON.stringify({ success: true, valid: true, message: "Code verified" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: any) {
    console.error("Error in send_email_otp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
